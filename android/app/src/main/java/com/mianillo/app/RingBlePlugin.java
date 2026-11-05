package com.mianillo.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.provider.Settings;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayDeque;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Minimal BLE bridge for QRing-style smart rings (Colmi R0x protocol and clones such as the Leotec Kör Mau).
 * It only knows how to scan, connect, write raw bytes and forward notifications; the protocol lives in TypeScript.
 *
 * Channels: "main" = Nordic-UART-like command service, "big" = big-data service (sleep and other long payloads).
 */
@SuppressLint("MissingPermission")
@CapacitorPlugin(
    name = "RingBle",
    permissions = {
        @Permission(alias = "bleModern", strings = { Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT }),
        @Permission(alias = "bleLegacy", strings = { Manifest.permission.ACCESS_FINE_LOCATION })
    }
)
public class RingBlePlugin extends Plugin {

    static final UUID MAIN_SERVICE = UUID.fromString("6e40fff0-b5a3-f393-e0a9-e50e24dcca9e");
    static final UUID MAIN_WRITE = UUID.fromString("6e400002-b5a3-f393-e0a9-e50e24dcca9e");
    static final UUID MAIN_NOTIFY = UUID.fromString("6e400003-b5a3-f393-e0a9-e50e24dcca9e");
    static final UUID BIG_SERVICE = UUID.fromString("de5bf728-d711-4e47-af26-65e3012a5dc7");
    static final UUID BIG_WRITE = UUID.fromString("de5bf72a-d711-4e47-af26-65e3012a5dc7");
    static final UUID BIG_NOTIFY = UUID.fromString("de5bf729-d711-4e47-af26-65e3012a5dc7");
    static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    private final Handler main = new Handler(Looper.getMainLooper());

    /** The live plugin, so the notification listener can reach the ring while the app is in the background. */
    static volatile RingBlePlugin instance;
    static final String PREFS = "ring_notify";

    private BluetoothLeScanner scanner;
    private ScanCallback scanCallback;
    private PluginCall scanCall;
    private final Set<String> seen = new HashSet<>();

    private BluetoothGatt gatt;
    private PluginCall connectCall;
    private BluetoothGattCharacteristic mainWrite;
    private BluetoothGattCharacteristic bigWrite;

    /** GATT allows one outstanding operation at a time, so writes (and CCCD setup) go through this queue. */
    private final ArrayDeque<Runnable> queue = new ArrayDeque<>();
    private boolean busy = false;

    @Override
    public void load() {
        instance = this;
    }

    // ---------- permissions ----------

    private String permAlias() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? "bleModern" : "bleLegacy";
    }

    private boolean ensurePermissions(PluginCall call) {
        String alias = permAlias();
        if (getPermissionState(alias) == PermissionState.GRANTED) return true;
        requestPermissionForAlias(alias, call, "permissionCallback");
        return false;
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        if (getPermissionState(permAlias()) != PermissionState.GRANTED) {
            call.reject("Necesito permiso de Bluetooth (dispositivos cercanos) para hablar con el anillo.", "PERMISSION");
            return;
        }
        if ("scan".equals(call.getMethodName())) scan(call);
        else if ("connect".equals(call.getMethodName())) connect(call);
        else call.resolve();
    }

    private BluetoothAdapter adapter() {
        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        return manager == null ? null : manager.getAdapter();
    }

    @PluginMethod
    public void isEnabled(PluginCall call) {
        BluetoothAdapter a = adapter();
        JSObject ret = new JSObject();
        ret.put("enabled", a != null && a.isEnabled());
        call.resolve(ret);
    }

    // ---------- scan ----------

    @PluginMethod
    public void scan(PluginCall call) {
        if (!ensurePermissions(call)) return;
        BluetoothAdapter a = adapter();
        if (a == null || !a.isEnabled()) {
            call.reject("El Bluetooth está apagado. Actívalo e inténtalo de nuevo.", "BT_OFF");
            return;
        }
        stopScanInternal();
        scanner = a.getBluetoothLeScanner();
        if (scanner == null) {
            call.reject("No se pudo iniciar la búsqueda Bluetooth.", "NO_SCANNER");
            return;
        }
        seen.clear();
        scanCall = call;
        call.setKeepAlive(true);
        scanCallback = new ScanCallback() {
            @Override
            public void onScanResult(int callbackType, ScanResult result) {
                BluetoothDevice d = result.getDevice();
                String name = result.getScanRecord() != null ? result.getScanRecord().getDeviceName() : null;
                if (name == null) name = d.getName();
                if (name == null || name.isEmpty()) return; // rings always advertise a name
                if (!seen.add(d.getAddress())) return;
                JSObject ev = new JSObject();
                ev.put("deviceId", d.getAddress());
                ev.put("name", name);
                ev.put("rssi", result.getRssi());
                notifyListeners("device", ev);
            }

            @Override
            public void onScanFailed(int errorCode) {
                PluginCall c = scanCall;
                stopScanInternal();
                if (c != null) {
                    c.setKeepAlive(false);
                    c.reject("La búsqueda Bluetooth falló (código " + errorCode + ").", "SCAN_FAILED");
                }
            }
        };
        ScanSettings settings = new ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build();
        scanner.startScan(null, settings, scanCallback);
        int timeout = call.getInt("timeoutMs", 12000);
        main.postDelayed(scanTimeout, timeout);
    }

    private void finishScan() {
        PluginCall c = scanCall;
        stopScanInternal();
        if (c != null) {
            c.setKeepAlive(false);
            c.resolve();
        }
    }

    @PluginMethod
    public void stopScan(PluginCall call) {
        finishScan();
        call.resolve();
    }

    private final Runnable scanTimeout = this::finishScan;

    private void stopScanInternal() {
        main.removeCallbacks(scanTimeout);
        if (scanner != null && scanCallback != null) {
            try {
                scanner.stopScan(scanCallback);
            } catch (Exception ignored) {}
        }
        scanCallback = null;
        scanCall = null;
    }

    // ---------- connection ----------

    @PluginMethod
    public void connect(PluginCall call) {
        if (!ensurePermissions(call)) return;
        String id = call.getString("deviceId");
        BluetoothAdapter a = adapter();
        if (a == null || !a.isEnabled()) {
            call.reject("El Bluetooth está apagado. Actívalo e inténtalo de nuevo.", "BT_OFF");
            return;
        }
        if (id == null || !BluetoothAdapter.checkBluetoothAddress(id)) {
            call.reject("Dirección del anillo no válida.", "BAD_ID");
            return;
        }
        stopScanInternal();
        closeGatt();
        connectCall = call;
        BluetoothDevice device = a.getRemoteDevice(id);
        gatt = device.connectGatt(getContext(), false, callback, BluetoothDevice.TRANSPORT_LE);
        main.postDelayed(() -> {
            if (connectCall == call) {
                connectCall = null;
                closeGatt();
                call.reject("El anillo no respondió. Acércalo al teléfono y comprueba que la app QRing no esté conectada.", "TIMEOUT");
            }
        }, 20000);
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        closeGatt();
        call.resolve();
    }

    @PluginMethod
    public void write(PluginCall call) {
        String channel = call.getString("channel", "main");
        String hex = call.getString("value", "");
        BluetoothGattCharacteristic ch = "big".equals(channel) ? bigWrite : mainWrite;
        BluetoothGatt g = gatt;
        if (g == null || ch == null) {
            call.reject("El anillo no está conectado.", "NOT_CONNECTED");
            return;
        }
        byte[] data = fromHex(hex);
        enqueue(() -> {
            boolean ok = writeChar(g, ch, data);
            if (ok) call.resolve();
            else {
                call.reject("No se pudo enviar el comando.", "WRITE_FAILED");
                next();
            }
        });
    }

    private boolean writeChar(BluetoothGatt g, BluetoothGattCharacteristic ch, byte[] data) {
        int type = (ch.getProperties() & BluetoothGattCharacteristic.PROPERTY_WRITE) != 0
            ? BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
            : BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return g.writeCharacteristic(ch, data, type) == BluetoothGatt.GATT_SUCCESS;
        }
        ch.setWriteType(type);
        ch.setValue(data);
        return g.writeCharacteristic(ch);
    }

    private boolean enableNotify(BluetoothGatt g, BluetoothGattCharacteristic ch) {
        g.setCharacteristicNotification(ch, true);
        BluetoothGattDescriptor d = ch.getDescriptor(CCCD);
        if (d == null) return false;
        byte[] v = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return g.writeDescriptor(d, v) == BluetoothGatt.GATT_SUCCESS;
        }
        d.setValue(v);
        return g.writeDescriptor(d);
    }

    private synchronized void enqueue(Runnable op) {
        queue.add(op);
        if (!busy) next();
    }

    private synchronized void next() {
        Runnable op = queue.poll();
        busy = op != null;
        if (op != null) main.post(op);
    }

    private synchronized void closeGatt() {
        queue.clear();
        busy = false;
        mainWrite = null;
        bigWrite = null;
        if (gatt != null) {
            try {
                gatt.disconnect();
                gatt.close();
            } catch (Exception ignored) {}
            gatt = null;
        }
    }

    private void failConnect(String msg) {
        PluginCall c = connectCall;
        connectCall = null;
        closeGatt();
        if (c != null) c.reject(msg, "CONNECT_FAILED");
    }

    private final BluetoothGattCallback callback = new BluetoothGattCallback() {
        @Override
        public void onConnectionStateChange(BluetoothGatt g, int status, int newState) {
            if (g != gatt) return;
            if (newState == BluetoothProfile.STATE_CONNECTED && status == BluetoothGatt.GATT_SUCCESS) {
                // A bigger MTU lets the big-data channel send longer chunks; fall back if refused.
                main.post(() -> {
                    if (!g.requestMtu(247)) g.discoverServices();
                });
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED || status != BluetoothGatt.GATT_SUCCESS) {
                if (connectCall != null) {
                    failConnect("No se pudo conectar con el anillo (estado " + status + "). Inténtalo otra vez.");
                    return;
                }
                closeGatt();
                notifyListeners("disconnected", new JSObject());
            }
        }

        @Override
        public void onMtuChanged(BluetoothGatt g, int mtu, int status) {
            if (g == gatt) main.post(g::discoverServices);
        }

        @Override
        public void onServicesDiscovered(BluetoothGatt g, int status) {
            if (g != gatt) return;
            BluetoothGattService ms = g.getService(MAIN_SERVICE);
            if (status != BluetoothGatt.GATT_SUCCESS || ms == null) {
                failConnect("Este dispositivo no parece un anillo compatible con QRing.");
                return;
            }
            mainWrite = ms.getCharacteristic(MAIN_WRITE);
            BluetoothGattCharacteristic mainNotify = ms.getCharacteristic(MAIN_NOTIFY);
            if (mainWrite == null || mainNotify == null) {
                failConnect("El anillo no expone el canal de comandos esperado.");
                return;
            }
            BluetoothGattService bs = g.getService(BIG_SERVICE);
            BluetoothGattCharacteristic bigNotify = null;
            if (bs != null) {
                bigWrite = bs.getCharacteristic(BIG_WRITE);
                bigNotify = bs.getCharacteristic(BIG_NOTIFY);
            }
            final BluetoothGattCharacteristic bn = bigNotify;
            enqueue(() -> {
                if (!enableNotify(g, mainNotify)) next();
            });
            if (bn != null) {
                enqueue(() -> {
                    if (!enableNotify(g, bn)) next();
                });
            }
            enqueue(() -> {
                PluginCall c = connectCall;
                connectCall = null;
                if (c != null) {
                    JSObject ret = new JSObject();
                    ret.put("deviceId", g.getDevice().getAddress());
                    ret.put("name", g.getDevice().getName());
                    ret.put("bigData", bigWrite != null && bn != null);
                    c.resolve(ret);
                }
                next();
            });
        }

        @Override
        public void onDescriptorWrite(BluetoothGatt g, BluetoothGattDescriptor d, int status) {
            next();
        }

        @Override
        public void onCharacteristicWrite(BluetoothGatt g, BluetoothGattCharacteristic ch, int status) {
            next();
        }

        @Override
        public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic ch, byte[] value) {
            emit(ch, value);
        }

        @Override
        @SuppressWarnings("deprecation")
        public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic ch) {
            // Pre-Android 13 path; on 13+ only the overload above is called.
            emit(ch, ch.getValue());
        }
    };

    private void emit(BluetoothGattCharacteristic ch, byte[] value) {
        if (value == null) return;
        JSObject ev = new JSObject();
        ev.put("channel", BIG_NOTIFY.equals(ch.getUuid()) ? "big" : "main");
        ev.put("value", toHex(value));
        notifyListeners("notify", ev);
    }

    @Override
    protected void handleOnDestroy() {
        stopScanInternal();
        closeGatt();
        if (instance == this) instance = null;
    }

    // ---------- phone notifications -> ring ----------

    static byte[] packet(int... bytes) {
        byte[] p = new byte[16];
        int sum = 0;
        for (int i = 0; i < Math.min(15, bytes.length); i++) p[i] = (byte) bytes[i];
        for (int i = 0; i < 15; i++) sum += p[i] & 0xff;
        p[15] = (byte) sum;
        return p;
    }

    /** Called from RingNotificationListener. Returns false when the ring is not connected. */
    boolean sendFromNative(byte[] data) {
        BluetoothGatt g = gatt;
        BluetoothGattCharacteristic ch = mainWrite;
        if (g == null || ch == null) return false;
        enqueue(() -> {
            if (!writeChar(g, ch, data)) next();
        });
        return true;
    }

    void reportPhoneNotification(String app, String kind, boolean delivered) {
        JSObject ev = new JSObject();
        ev.put("app", app);
        ev.put("kind", kind);
        ev.put("delivered", delivered);
        notifyListeners("phoneNotification", ev);
    }

    /** False in the "lite" APK, which leaves the listener service out of the manifest. */
    private boolean listenerDeclared() {
        try {
            getContext().getPackageManager().getServiceInfo(new ComponentName(getContext(), RingNotificationListener.class), 0);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean hasNotificationAccess() {
        String flat = Settings.Secure.getString(getContext().getContentResolver(), "enabled_notification_listeners");
        ComponentName me = new ComponentName(getContext(), RingNotificationListener.class);
        return flat != null && flat.contains(me.flattenToString());
    }

    @PluginMethod
    public void getNotifyConfig(PluginCall call) {
        SharedPreferences sp = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSObject ret = new JSObject();
        ret.put("enabled", sp.getBoolean("enabled", false));
        ret.put("strong", sp.getBoolean("strong", true));
        JSArray kinds = new JSArray();
        for (String k : sp.getStringSet("kinds", RingNotificationListener.DEFAULT_KINDS)) kinds.put(k);
        ret.put("kinds", kinds);
        ret.put("access", hasNotificationAccess());
        ret.put("supported", listenerDeclared());
        call.resolve(ret);
    }

    @PluginMethod
    public void setNotifyConfig(PluginCall call) {
        SharedPreferences.Editor e = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        if (call.hasOption("enabled")) e.putBoolean("enabled", Boolean.TRUE.equals(call.getBoolean("enabled")));
        if (call.hasOption("strong")) e.putBoolean("strong", Boolean.TRUE.equals(call.getBoolean("strong")));
        JSArray kinds = call.getArray("kinds");
        if (kinds != null) {
            Set<String> set = new HashSet<>();
            try {
                List<String> list = kinds.toList();
                set.addAll(list);
            } catch (Exception ignored) {}
            e.putStringSet("kinds", set);
        }
        e.apply();
        getNotifyConfig(call);
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Intent i = new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS");
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    // ---------- hex helpers ----------

    private static String toHex(byte[] b) {
        StringBuilder sb = new StringBuilder(b.length * 2);
        for (byte x : b) sb.append(String.format("%02x", x & 0xff));
        return sb.toString();
    }

    private static byte[] fromHex(String s) {
        int n = s.length() / 2;
        byte[] out = new byte[n];
        for (int i = 0; i < n; i++) out[i] = (byte) Integer.parseInt(s.substring(i * 2, i * 2 + 2), 16);
        return out;
    }
}
