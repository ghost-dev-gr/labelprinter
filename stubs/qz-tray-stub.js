// QZ Tray stub — a minimal mock to allow testing without QZ Tray desktop app
(function(scope) {
    if (scope.qz) return;
    var qz = {};
    qz.version = "2.2.4-stub";
    qz.websocket = {
        _ws: null,
        _connectPromise: null,
        _active: false,
        isActive: function() { return qz.websocket._active; },
        disconnect: function() {
            return new Promise(function(resolve) {
                qz.websocket._active = false;
                qz.websocket._ws = null;
                resolve();
            });
        },
        connect: function(options) {
            return new Promise(function(resolve, reject) {
                setTimeout(function() {
                    console.warn("QZ Tray stub: simulating connection");
                    qz.websocket._active = true;
                    resolve();
                }, 100);
            });
        },
        onMessage: null
    };

    qz.printers = {
        find: function(query) {
            console.log("QZ Tray stub: printers.find", query);
            return Promise.resolve(["HPRT HT600 (stub)", "Zebra ZD410 (stub)", "Generic Thermal (stub)"]);
        }
    };

    qz.configs = {
        create: function(printerName, options) {
            return {
                printerName: printerName,
                options: options || {}
            };
        }
    };

    qz.print = function(config, data) {
        console.log("QZ Tray stub: print dispatched", config, data);
        return Promise.resolve();
    };

    qz.security = {
        setCertificatePromise: function(fn) { qz.security._certFn = fn; },
        setSignatureAlgorithm: function(alg) { qz.security._alg = alg; },
        setSignaturePromise: function(fn) { qz.security._sigFn = fn; }
    };

    scope.qz = qz;
    console.log("QZ Tray stub initialized");
})(window);
