/*
 * Puente nativo para la app Android (Capacitor).
 *
 * El WebView de Android no trae algunas APIs que TrenTurnos usa en el
 * navegador. Este archivo las rellena con los plugins nativos, sin tocar
 * el código de index.html:
 *   - navigator.share / navigator.canShare  → hoja "Compartir" de Android
 *   - descargas <a download> (p. ej. XLSX.writeFile) → se guardan y se
 *     abre "Compartir" para mandarlas a Drive, WhatsApp, Archivos…
 *   - window.Notification → notificaciones locales del sistema
 *
 * En el navegador normal (web/PWA) no hace nada.
 */
(function () {
  var Cap = window.Capacitor;
  if (!Cap || !Cap.isNativePlatform || !Cap.isNativePlatform()) return;
  var P = Cap.Plugins || {};
  var Share = P.Share, Filesystem = P.Filesystem, LocalNotifications = P.LocalNotifications;

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(blob);
    });
  }

  function safeName(name) {
    return String(name || 'archivo').replace(/[\\/:*?"<>|]+/g, '_');
  }

  // Guarda un Blob en la caché de la app y devuelve su URI nativa.
  function writeCacheFile(blob, name) {
    return blobToBase64(blob).then(function (data) {
      return Filesystem.writeFile({
        path: 'compartir/' + Date.now() + '-' + safeName(name),
        data: data,
        directory: 'CACHE',
        recursive: true
      });
    }).then(function (res) { return res.uri; });
  }

  function shareBlob(blob, name, title) {
    return writeCacheFile(blob, name).then(function (uri) {
      return Share.share({ title: title || name, files: [uri], dialogTitle: 'Guardar o compartir' });
    });
  }

  function isCancel(err) {
    return /cancel/i.test(String((err && err.message) || err));
  }

  // ── navigator.share / canShare ───────────────────────────────
  if (Share && Filesystem) {
    navigator.canShare = function () { return true; };
    navigator.share = function (data) {
      data = data || {};
      var files = Array.prototype.slice.call(data.files || []);
      return Promise.all(files.map(function (f) { return writeCacheFile(f, f.name); }))
        .then(function (uris) {
          var opts = { dialogTitle: 'Compartir' };
          if (data.title) opts.title = data.title;
          if (data.text) opts.text = data.text;
          if (data.url) opts.url = data.url;
          if (uris.length) opts.files = uris;
          return Share.share(opts);
        })
        .then(function () {}, function (err) {
          // Mismo contrato que la API web: cancelar = AbortError.
          var e = new Error(String((err && err.message) || err));
          e.name = isCancel(err) ? 'AbortError' : 'NotAllowedError';
          throw e;
        });
    };

    // ── Descargas <a download href="blob:…|data:…"> ────────────
    var nativeClick = HTMLAnchorElement.prototype.click;
    function handleDownload(a) {
      var href = a.href || '';
      if (!a.hasAttribute('download') || !/^(blob|data):/.test(href)) return false;
      var name = a.getAttribute('download') || 'archivo';
      fetch(href).then(function (r) { return r.blob(); })
        .then(function (blob) { return shareBlob(blob, name); })
        .catch(function (err) {
          if (!isCancel(err)) alert('No se pudo guardar el archivo: ' + ((err && err.message) || err));
        });
      return true;
    }
    HTMLAnchorElement.prototype.click = function () {
      if (handleDownload(this)) return;
      return nativeClick.apply(this, arguments);
    };
    document.addEventListener('click', function (ev) {
      var a = ev.target && ev.target.closest && ev.target.closest('a[download]');
      if (a && handleDownload(a)) ev.preventDefault();
    }, true);
  }

  // ── window.Notification → notificaciones locales ────────────
  if (LocalNotifications) {
    var nextId = 1;
    function NativeNotification(title, options) {
      options = options || {};
      this.title = title;
      this.body = options.body || '';
      if (NativeNotification.permission !== 'granted') return;
      LocalNotifications.schedule({
        notifications: [{
          id: (Date.now() % 2000000000) + (nextId++),
          title: String(title || 'TrenTurnos'),
          body: String(options.body || '')
        }]
      }).catch(function () {});
    }
    NativeNotification.prototype.close = function () {};
    NativeNotification.permission = 'default';
    NativeNotification.requestPermission = function (cb) {
      return LocalNotifications.requestPermissions().then(function (r) {
        var p = r.display === 'granted' ? 'granted' : (r.display === 'denied' ? 'denied' : 'default');
        NativeNotification.permission = p;
        if (typeof cb === 'function') cb(p);
        return p;
      });
    };
    LocalNotifications.checkPermissions().then(function (r) {
      NativeNotification.permission = r.display === 'granted' ? 'granted' : (r.display === 'denied' ? 'denied' : 'default');
    }).catch(function () {});
    window.Notification = NativeNotification;
  }
})();
