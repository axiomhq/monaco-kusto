var Emitter = monaco.Emitter;
import KustoCommandHighlighter from './commandHighlighter';
import KustoCommandFormatter from './commandFormatter';
import { extend } from './extendedEditor';
// --- Kusto configuration and defaults ---------
var LanguageServiceDefaultsImpl = /** @class */ (function () {
    function LanguageServiceDefaultsImpl(languageSettings) {
        this._onDidChange = new Emitter();
        this.setLanguageSettings(languageSettings);
        // default to never kill worker when idle.
        // reason: when killing worker - schema gets lost. We transmit the schema back to main process when killing
        // the worker, but in some extreme cases web worker runs out of memory while stringifying the schema.
        // This stems from the fact that web workers have much more limited memory that the main process.
        // An alternative solution (not currently implemented) is to just save the schema in the main process whenever calling
        // setSchema. That way we don't need to stringify the schema on the worker side when killing the web worker.
        this._workerMaxIdleTime = 0;
    }
    Object.defineProperty(LanguageServiceDefaultsImpl.prototype, "onDidChange", {
        get: function () {
            return this._onDidChange.event;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(LanguageServiceDefaultsImpl.prototype, "languageSettings", {
        get: function () {
            return this._languageSettings;
        },
        enumerable: false,
        configurable: true
    });
    LanguageServiceDefaultsImpl.prototype.setLanguageSettings = function (options) {
        this._languageSettings = options || Object.create(null);
        this._onDidChange.fire(this);
    };
    LanguageServiceDefaultsImpl.prototype.setMaximumWorkerIdleTime = function (value) {
        // doesn't fire an event since no
        // worker restart is required here
        this._workerMaxIdleTime = value;
    };
    LanguageServiceDefaultsImpl.prototype.getWorkerMaxIdleTime = function () {
        return this._workerMaxIdleTime;
    };
    return LanguageServiceDefaultsImpl;
}());
export { LanguageServiceDefaultsImpl };
var defaultLanguageSettings = {
    includeControlCommands: true,
    newlineAfterPipe: true,
    openSuggestionDialogAfterPreviousSuggestionAccepted: true,
    useIntellisenseV2: true,
    useSemanticColorization: true,
    useTokenColorization: true,
    enableHover: true,
    formatter: {
        indentationSize: 4,
        pipeOperatorStyle: 'Smart'
    },
    syntaxErrorAsMarkDown: {
        enableSyntaxErrorAsMarkDown: false
    }
};
function getKustoWorker() {
    return new Promise(function (resolve, reject) {
        withMode(function (mode) {
            mode.getKustoWorker().then(resolve, reject);
        });
    });
}
function withMode(callback) {
    require(['vs/language/kusto/kustoMode'], callback);
}
export function setupMonacoKusto(monacoInstance) {
    var kustoDefaults = new LanguageServiceDefaultsImpl(defaultLanguageSettings);
    function createAPI() {
        return {
            kustoDefaults: kustoDefaults,
            getKustoWorker: getKustoWorker,
        };
    }
    monacoInstance.languages.kusto = createAPI();
    monacoInstance.languages.onLanguage('kusto', function () {
        withMode(function (mode) { return mode.setupMode(kustoDefaults, monacoInstance); });
    });
    monacoInstance.languages.register({
        id: 'kusto',
        extensions: ['.csl', '.kql'],
    });
    // TODO: asked if there's a cleaner way to register an editor contribution. looks like monaco has an internal contribution regstrar but it's no exposed in the API.
    // https://stackoverflow.com/questions/46700245/how-to-add-an-ieditorcontribution-to-monaco-editor
    var commandHighlighter;
    var commandFormatter;
    monacoInstance.editor.defineTheme('kusto-light', {
        base: 'vs',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '008000' },
            { token: 'variable.predefined', foreground: '800080' },
            { token: 'function', foreground: '0000FF' },
            { token: 'operator.sql', foreground: 'CC3700' },
            { token: 'string', foreground: 'B22222' },
            { token: 'operator.scss', foreground: '0000FF' },
            { token: 'variable', foreground: 'C71585' },
            { token: 'variable.parameter', foreground: '9932CC' },
            { token: '', foreground: '000000' },
            { token: 'type', foreground: '0000FF' },
            { token: 'tag', foreground: '0000FF' },
            { token: 'annotation', foreground: '2B91AF' },
            { token: 'keyword', foreground: '0000FF' },
            { token: 'number', foreground: '191970' },
            { token: 'annotation', foreground: '9400D3' },
            { token: 'invalid', background: 'cd3131' },
        ],
        colors: {},
    });
    monacoInstance.editor.defineTheme('kusto-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '608B4E' },
            { token: 'variable.predefined', foreground: '4ec9b0' },
            { token: 'function', foreground: 'dcdcaa' },
            { token: 'operator.sql', foreground: '9cdcfe' },
            { token: 'string', foreground: 'ce9178' },
            { token: 'operator.scss', foreground: '569cd6' },
            { token: 'variable', foreground: '4ec9b0' },
            { token: 'variable.parameter', foreground: 'c586c0' },
            { token: '', foreground: 'd4d4d4' },
            { token: 'type', foreground: '569cd6' },
            { token: 'tag', foreground: '569cd6' },
            { token: 'annotation', foreground: '9cdcfe' },
            { token: 'keyword', foreground: '569cd6' },
            { token: 'number', foreground: 'd7ba7d' },
            { token: 'annotation', foreground: 'b5cea8' },
            { token: 'invalid', background: 'cd3131' },
        ],
        colors: {},
    });
    monacoInstance.editor.defineTheme('kusto-dark2', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: { 'editor.background': '#1B1A19' },
    });
    // Initialize kusto specific language features that don't currently have a natural way to extend using existing apis.
    // Most other language features are initialized in kustoMode.ts
    monacoInstance.editor.onDidCreateEditor(function (editor) {
        // hook up extension methods to editor.
        extend(editor);
        commandHighlighter = new KustoCommandHighlighter(editor);
        if (isStandaloneCodeEditor(editor)) {
            commandFormatter = new KustoCommandFormatter(editor);
        }
        triggerSuggestDialogWhenCompletionItemSelected(editor);
    });
    function triggerSuggestDialogWhenCompletionItemSelected(editor) {
        editor.onDidChangeCursorSelection(function (event) {
            // checking the condition inside the event makes sure we will stay up to date whne kusto configuration changes at runtime.
            if (kustoDefaults &&
                kustoDefaults.languageSettings &&
                kustoDefaults.languageSettings.openSuggestionDialogAfterPreviousSuggestionAccepted) {
                var didAcceptSuggestion = event.source === 'modelChange' && event.reason === monaco.editor.CursorChangeReason.RecoverFromMarkers;
                if (!didAcceptSuggestion) {
                    return;
                }
                event.selection;
                var completionText = editor.getModel().getValueInRange(event.selection);
                if (completionText[completionText.length - 1] === ' ') {
                    // OK so now we in a situation where we know a suggestion was selected and we want to trigger another one.
                    // the only problem is that the suggestion widget itself listens to this same event in order to know it needs to close.
                    // The only problem is that we're ahead in line, so we're triggering a suggest operation that will be shut down once
                    // the next callback is called. This is why we're waiting here - to let all the callbacks run synchronously and be
                    // the 'last' subscriber to run. Granted this is hacky, but until monaco provides a specific event for suggestions,
                    // this is the best we have.
                    setTimeout(function () { return editor.trigger('monaco-kusto', 'editor.action.triggerSuggest', {}); }, 10);
                }
            }
        });
    }
}
function isStandaloneCodeEditor(editor) {
    return editor.addAction !== undefined;
}
// --- Registration to monaco editor ---
if (monaco.editor) {
    setupMonacoKusto(monaco);
}
