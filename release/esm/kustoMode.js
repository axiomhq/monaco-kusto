var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import { WorkerManager } from './workerManager';
import { KustoLanguageDefinition } from './languageService/kustoMonarchLanguageDefinition';
import * as languageFeatures from './languageFeatures';
var kustoWorker;
var resolveWorker;
var rejectWorker;
var workerPromise = new Promise(function (resolve, reject) {
    resolveWorker = resolve;
    rejectWorker = reject;
});
/**
 * Called when Kusto language is first needed (a model has the language set)
 * @param defaults
 */
export function setupMode(defaults, monacoInstance) {
    var onSchemaChange = new monaco.Emitter();
    // TODO: when should we dispose of these? seems like monaco-css and monaco-typescript don't dispose of these.
    var disposables = [];
    var monarchTokensProvider;
    var client = new WorkerManager(monacoInstance, defaults);
    disposables.push(client);
    var workerAccessor = function (first) {
        var more = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            more[_i - 1] = arguments[_i];
        }
        var augmentedSetSchema = function (schema, worker, globalParameters) {
            var workerPromise = worker.setSchema(schema);
            workerPromise.then(function () {
                onSchemaChange.fire(schema);
            });
        };
        var worker = client.getLanguageServiceWorker.apply(client, [first].concat(more));
        return worker.then(function (worker) {
            return (__assign(__assign({}, worker), { setSchema: function (schema) { return augmentedSetSchema(schema, worker); }, setSchemaFromShowSchema: function (schema, connection, database, globalParameters) {
                    worker
                        .normalizeSchema(schema, connection, database)
                        .then(function (schema) { return (globalParameters ? __assign(__assign({}, schema), { globalParameters: globalParameters }) : schema); })
                        .then(function (normalized) { return augmentedSetSchema(normalized, worker); });
                } }));
        });
    };
    var language = 'kusto';
    disposables.push(monacoInstance.languages.registerCompletionItemProvider(language, new languageFeatures.CompletionAdapter(workerAccessor, defaults.languageSettings)));
    // Monaco tokenization runs in main thread so we're using a quick schema-unaware tokenization.
    // a web worker will run semantic colorization in the background (ColorizationAdapter).
    if (defaults.languageSettings.useTokenColorization) {
        monarchTokensProvider = monacoInstance.languages.setMonarchTokensProvider(language, KustoLanguageDefinition);
    }
    // listen to configuration changes and if we're switching from semantic to monarch colorization, do the switch.
    defaults.onDidChange(function (e) {
        if (!e.languageSettings.useTokenColorization && monarchTokensProvider !== undefined) {
            monarchTokensProvider.dispose();
            monarchTokensProvider = undefined;
        }
        if (e.languageSettings.useTokenColorization && monarchTokensProvider == undefined) {
            monarchTokensProvider = monacoInstance.languages.setMonarchTokensProvider(language, KustoLanguageDefinition);
        }
    });
    disposables.push(new languageFeatures.DiagnosticsAdapter(monacoInstance, language, workerAccessor, defaults, onSchemaChange.event));
    disposables.push(new languageFeatures.ColorizationAdapter(monacoInstance, language, workerAccessor, defaults, onSchemaChange.event));
    disposables.push(monacoInstance.languages.registerDocumentRangeFormattingEditProvider(language, new languageFeatures.FormatAdapter(workerAccessor)));
    disposables.push(monacoInstance.languages.registerFoldingRangeProvider(language, new languageFeatures.FoldingAdapter(workerAccessor)));
    disposables.push(monacoInstance.languages.registerDefinitionProvider(language, new languageFeatures.DefinitionAdapter(workerAccessor)));
    disposables.push(monacoInstance.languages.registerRenameProvider(language, new languageFeatures.RenameAdapter(workerAccessor)));
    disposables.push(monacoInstance.languages.registerReferenceProvider(language, new languageFeatures.ReferenceAdapter(workerAccessor)));
    if (defaults.languageSettings.enableHover) {
        disposables.push(monacoInstance.languages.registerHoverProvider(language, new languageFeatures.HoverAdapter(workerAccessor)));
    }
    monacoInstance.languages.registerDocumentFormattingEditProvider(language, new languageFeatures.DocumentFormatAdapter(workerAccessor));
    kustoWorker = workerAccessor;
    resolveWorker(workerAccessor);
    monacoInstance.languages.setLanguageConfiguration(language, {
        folding: {
            offSide: false,
            markers: { start: /^\s*[\r\n]/gm, end: /^\s*[\r\n]/gm },
        },
        comments: {
            lineComment: '//',
            blockComment: null,
        },
    });
    return kustoWorker;
}
export function getKustoWorker() {
    return workerPromise.then(function () { return kustoWorker; });
}
