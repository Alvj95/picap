package com.mianillo.app;

import android.app.Notification;
import android.content.Context;
import android.content.SharedPreferences;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * Forwards phone notifications (calls, WhatsApp, SMS…) to the ring so it lights up / vibrates.
 * The user grants access once in Android settings; nothing leaves the phone.
 */
public class RingNotificationListener extends NotificationListenerService {

    static final Set<String> DEFAULT_KINDS = new HashSet<>(Arrays.asList("call", "whatsapp", "sms"));

    /** Ring notification types used by QRing-protocol rings (command 0x73). */
    private static final Map<String, Integer> TYPE = new HashMap<>();
    private static final Map<String, String> PACKAGES = new HashMap<>();

    static {
        TYPE.put("call", 0x01);
        TYPE.put("sms", 0x03);
        TYPE.put("social", 0x04);
        TYPE.put("email", 0x05);
        TYPE.put("whatsapp", 0x08);
        TYPE.put("other", 0x04);

        for (String p : new String[] { "com.whatsapp", "com.whatsapp.w4b" }) PACKAGES.put(p, "whatsapp");
        for (String p : new String[] { "com.google.android.apps.messaging", "com.samsung.android.messaging", "com.android.mms", "com.android.messaging" }) PACKAGES.put(p, "sms");
        for (String p : new String[] {
            "org.telegram.messenger", "com.instagram.android", "com.facebook.orca", "com.facebook.katana", "com.twitter.android",
            "com.zhiliaoapp.musically", "com.snapchat.android", "com.discord", "org.thoughtcrime.securesms"
        }) PACKAGES.put(p, "social");
        for (String p : new String[] { "com.google.android.gm", "com.microsoft.office.outlook", "com.samsung.android.email.provider", "com.yahoo.mobile.client.android.mail" }) PACKAGES.put(p, "email");
    }

    private long lastSent = 0;

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || getPackageName().equals(sbn.getPackageName())) return;
        SharedPreferences sp = getSharedPreferences(RingBlePlugin.PREFS, Context.MODE_PRIVATE);
        if (!sp.getBoolean("enabled", false)) return;

        Notification n = sbn.getNotification();
        boolean isCall = Notification.CATEGORY_CALL.equals(n.category);
        // Skip silent updates: ongoing notifications (music, downloads) and group summaries, except incoming calls.
        if (!isCall && ((n.flags & Notification.FLAG_ONGOING_EVENT) != 0 || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0)) return;

        String kind = isCall ? "call" : PACKAGES.getOrDefault(sbn.getPackageName(), "other");
        Set<String> kinds = sp.getStringSet("kinds", DEFAULT_KINDS);
        if (!kinds.contains(kind)) return;

        long now = System.currentTimeMillis();
        if (now - lastSent < 4000) return; // a chat burst should not buzz the ring ten times
        lastSent = now;

        RingBlePlugin plugin = RingBlePlugin.instance;
        boolean delivered = false;
        if (plugin != null) {
            delivered = plugin.sendFromNative(RingBlePlugin.packet(0x73, TYPE.getOrDefault(kind, 0x04)));
            // "Find ring" makes every model react visibly, even ones that ignore the notification command.
            if (delivered && sp.getBoolean("strong", true)) plugin.sendFromNative(RingBlePlugin.packet(0x50, 0x55, 0xaa));
            plugin.reportPhoneNotification(sbn.getPackageName(), kind, delivered);
        }
    }
}
