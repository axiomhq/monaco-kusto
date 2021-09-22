var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var WorkerManager = /** @class */ (function () {
    function WorkerManager(_monacoInstance, defaults) {
        var _this = this;
        this._monacoInstance = _monacoInstance;
        this._defaults = defaults;
        this._worker = null;
        this._idleCheckInterval = self.setInterval(function () { return _this._checkIfIdle(); }, 30 * 1000);
        this._lastUsedTime = 0;
        this._configChangeListener = this._defaults.onDidChange(function () { return _this._saveStateAndStopWorker(); });
    }
    WorkerManager.prototype._stopWorker = function () {
        if (this._worker) {
            this._worker.dispose();
            this._worker = null;
        }
        this._client = null;
    };
    WorkerManager.prototype._saveStateAndStopWorker = function () {
        var _this = this;
        if (!this._worker) {
            return;
        }
        this._worker.getProxy().then(function (proxy) {
            proxy.getSchema().then(function (schema) {
                _this._storedState = { schema: schema };
                _this._stopWorker();
            });
        });
    };
    WorkerManager.prototype.dispose = function () {
        clearInterval(this._idleCheckInterval);
        this._configChangeListener.dispose();
        this._stopWorker();
    };
    WorkerManager.prototype._checkIfIdle = function () {
        if (!this._worker) {
            return;
        }
        var maxIdleTime = this._defaults.getWorkerMaxIdleTime();
        var timePassedSinceLastUsed = Date.now() - this._lastUsedTime;
        if (maxIdleTime > 0 && timePassedSinceLastUsed > maxIdleTime) {
            this._saveStateAndStopWorker();
        }
    };
    WorkerManager.prototype._getClient = function () {
        var _this = this;
        this._lastUsedTime = Date.now();
        // Since onDidProvideCompletionItems is not used in web worker, and since functions cannot be trivially serialized (throws exception unable to clone), We remove it here.
        var _a = this._defaults.languageSettings, onDidProvideCompletionItems = _a.onDidProvideCompletionItems, languageSettings = __rest(_a, ["onDidProvideCompletionItems"]);
        if (!this._client) {
            this._worker = this._monacoInstance.editor.createWebWorker({
                // module that exports the create() method and returns a `KustoWorker` instance
                moduleId: 'vs/language/kusto/kustoWorker',
                label: 'kusto',
                // passed in to the create() method
                createData: {
                    languageSettings: languageSettings,
                    languageId: 'kusto',
                },
            });
            this._client = this._worker.getProxy().then(function (proxy) {
                // push state we held onto before killing the client.
                if (_this._storedState) {
                    return proxy.setSchema(_this._storedState.schema).then(function () { return proxy; });
                }
                else {
                    return proxy;
                }
            });
        }
        return this._client;
    };
    WorkerManager.prototype.getLanguageServiceWorker = function () {
        var _this = this;
        var resources = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            resources[_i] = arguments[_i];
        }
        var _client;
        return this._getClient()
            .then(function (client) {
            _client = client;
        })
            .then(function (_) {
            return _this._worker.withSyncedResources(resources);
        })
            .then(function (_) { return _client; });
    };
    return WorkerManager;
}());
export { WorkerManager };
