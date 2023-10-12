define('vs/language/kusto/commandFormatter',["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var KustoCommandFormatter = /** @class */ (function () {
        function KustoCommandFormatter(editor) {
            var _this = this;
            this.editor = editor;
            this.actionAdded = false;
            // selection also represents no selection - for example the event gets triggered when moving cursor from point
            // a to point b. in the case start position will equal end position.
            editor.onDidChangeCursorSelection(function (changeEvent) {
                if (_this.editor.getModel().getLanguageId() !== 'kusto') {
                    return;
                }
                // Theoretically you would expect this code to run only once in onDidCreateEditor.
                // Turns out that onDidCreateEditor is fired before the IStandaloneEditor is completely created (it is emmited by
                // the super ctor before the child ctor was able to fully run).
                // Thus we don't have  a key binding provided yet when onDidCreateEditor is run, which is essential to call addAction.
                // By adding the action here in onDidChangeCursorSelection we're making sure that the editor has a key binding provider,
                // and we just need to make sure that this happens only once.
                if (!_this.actionAdded) {
                    editor.addAction({
                        id: 'editor.action.kusto.formatCurrentCommand',
                        label: 'Format Command Under Cursor',
                        keybindings: [
                            monaco.KeyMod.chord(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF),
                        ],
                        run: function (ed) {
                            editor.trigger('KustoCommandFormatter', 'editor.action.formatSelection', null);
                        },
                        contextMenuGroupId: '1_modification',
                    });
                    _this.actionAdded = true;
                }
            });
        }
        return KustoCommandFormatter;
    }());
    exports.default = KustoCommandFormatter;
});

/// <reference path="../node_modules/monaco-editor-core/monaco.d.ts" />
define('vs/language/kusto/extendedEditor',["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.extend = void 0;
    /**
     * Extending ICode editor to contain additional kusto-speicifc methods.
     * note that the extend method needs to be called at least once to take affect, otherwise this here code is useless.
     */
    function extend(editor) {
        var proto = Object.getPrototypeOf(editor);
        proto.getCurrentCommandRange = function (cursorPosition) {
            var editor = this;
            var zeroBasedCursorLineNumber = cursorPosition.lineNumber - 1;
            var lines = this.getModel().getLinesContent();
            var commandOrdinal = 0;
            var linesWithCommandOrdinal = [];
            for (var lineNumber = 0; lineNumber < lines.length; lineNumber++) {
                var isEmptyLine = lines[lineNumber].trim() === '';
                if (isEmptyLine) {
                    // increase commandCounter - we'll be starting a new command.
                    linesWithCommandOrdinal.push({ commandOrdinal: commandOrdinal++, lineNumber: lineNumber });
                }
                else {
                    linesWithCommandOrdinal.push({ commandOrdinal: commandOrdinal, lineNumber: lineNumber });
                }
                // No need to keep scanning if we're past our line and we've seen an empty line.
                if (lineNumber > zeroBasedCursorLineNumber && commandOrdinal > linesWithCommandOrdinal[zeroBasedCursorLineNumber].commandOrdinal) {
                    break;
                }
            }
            var currentCommandOrdinal = linesWithCommandOrdinal[zeroBasedCursorLineNumber].commandOrdinal;
            var currentCommandLines = linesWithCommandOrdinal.filter(function (line) { return line.commandOrdinal === currentCommandOrdinal; });
            var currentCommandStartLine = currentCommandLines[0].lineNumber + 1;
            var currentCommandEndLine = currentCommandLines[currentCommandLines.length - 1].lineNumber + 1;
            // End-column of 1 means no characters will be highlighted - since columns are 1-based in monaco apis.
            // Start-column of 1 and End column of 2 means 1st character is selected.
            // Thus if a line has n column and we need to provide n+1 so that the entire line will be highlighted.
            var commandEndColumn = lines[currentCommandEndLine - 1].length + 1;
            return new monaco.Range(currentCommandStartLine, 1, currentCommandEndLine, commandEndColumn);
        };
    }
    exports.extend = extend;
});

define('vs/language/kusto/monaco.contribution',["require", "exports", "./commandFormatter", "./extendedEditor"], function (require, exports, commandFormatter_1, extendedEditor_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.setupMonacoKusto = exports.LanguageServiceDefaultsImpl = void 0;
    var Emitter = monaco.Emitter;
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
    exports.LanguageServiceDefaultsImpl = LanguageServiceDefaultsImpl;
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
            pipeOperatorStyle: 'Smart',
        },
        syntaxErrorAsMarkDown: {
            enableSyntaxErrorAsMarkDown: false,
        },
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
    function setupMonacoKusto(monacoInstance) {
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
            colors: {
            // see: https://code.visualstudio.com/api/references/theme-color#editor-widget-colors
            // 'editor.background': '#1B1A19', // gray 200
            // 'editorSuggestWidget.selectedBackground': '#004E8C',
            },
        });
        monacoInstance.editor.defineTheme('kusto-dark2', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                // see: https://code.visualstudio.com/api/references/theme-color#editor-widget-colors
                'editor.background': '#1B1A19',
                'editorSuggestWidget.selectedBackground': '#004E8C',
            },
        });
        // Initialize kusto specific language features that don't currently have a natural way to extend using existing apis.
        // Most other language features are initialized in kustoMode.ts
        monacoInstance.editor.onDidCreateEditor(function (editor) {
            // hook up extension methods to editor.
            extendedEditor_1.extend(editor);
            if (isStandaloneCodeEditor(editor)) {
                commandFormatter = new commandFormatter_1.default(editor);
            }
            triggerSuggestDialogWhenCompletionItemSelected(editor);
        });
        function triggerSuggestDialogWhenCompletionItemSelected(editor) {
            editor.onDidChangeCursorSelection(function (event) {
                // checking the condition inside the event makes sure we will stay up to date whne kusto configuration changes at runtime.
                if (kustoDefaults &&
                    kustoDefaults.languageSettings &&
                    kustoDefaults.languageSettings.openSuggestionDialogAfterPreviousSuggestionAccepted) {
                    var didAcceptSuggestion = event.source === 'snippet' && event.reason === monaco.editor.CursorChangeReason.NotSet;
                    if (!didAcceptSuggestion) {
                        return;
                    }
                    event.selection;
                    // OK so now we in a situation where we know a suggestion was selected and we want to trigger another one.
                    // the only problem is that the suggestion widget itself listens to this same event in order to know it needs to close.
                    // The only problem is that we're ahead in line, so we're triggering a suggest operation that will be shut down once
                    // the next callback is called. This is why we're waiting here - to let all the callbacks run synchronously and be
                    // the 'last' subscriber to run. Granted this is hacky, but until monaco provides a specific event for suggestions,
                    // this is the best we have.
                    setTimeout(function () { return editor.trigger('monaco-kusto', 'editor.action.triggerSuggest', {}); }, 10);
                }
            });
        }
    }
    exports.setupMonacoKusto = setupMonacoKusto;
    function isStandaloneCodeEditor(editor) {
        return editor.addAction !== undefined;
    }
    // --- Registration to monaco editor ---
    if (monaco.editor) {
        setupMonacoKusto(monaco);
    }
});

