import * as ls from './_deps/vscode-languageserver-types/main';
import * as _ from './_deps/lodash/lodash';
var Uri = monaco.Uri;
var Range = monaco.Range;
var ClassificationKind = Kusto.Language.Editor.ClassificationKind;
// --- diagnostics ---
var DiagnosticsAdapter = /** @class */ (function () {
    function DiagnosticsAdapter(_monacoInstance, _languageId, _worker, defaults, onSchemaChange) {
        var _this = this;
        this._monacoInstance = _monacoInstance;
        this._languageId = _languageId;
        this._worker = _worker;
        this.defaults = defaults;
        this._disposables = [];
        this._contentListener = Object.create(null);
        this._configurationListener = Object.create(null);
        this._schemaListener = Object.create(null);
        var onModelAdd = function (model) {
            var modeId = model.getModeId();
            if (modeId !== _this._languageId) {
                return;
            }
            var debouncedValidation = _.debounce(function (intervals) { return _this._doValidate(model, modeId, intervals); }, 500);
            _this._contentListener[model.uri.toString()] = model.onDidChangeContent(function (e) {
                var intervalsToValidate = changeEventToIntervals(e);
                debouncedValidation(intervalsToValidate);
            });
            _this._configurationListener[model.uri.toString()] = _this.defaults.onDidChange(function () {
                self.setTimeout(function () { return _this._doValidate(model, modeId, []); }, 0);
            });
            _this._schemaListener[model.uri.toString()] = onSchemaChange(function () {
                self.setTimeout(function () { return _this._doValidate(model, modeId, []); }, 0);
            });
        };
        var onModelRemoved = function (model) {
            _this._monacoInstance.editor.setModelMarkers(model, _this._languageId, []);
            var uriStr = model.uri.toString();
            var contentListener = _this._contentListener[uriStr];
            if (contentListener) {
                contentListener.dispose();
                delete _this._contentListener[uriStr];
            }
            var configurationListener = _this._configurationListener[uriStr];
            if (configurationListener) {
                configurationListener.dispose();
                delete _this._configurationListener[uriStr];
            }
            var schemaListener = _this._schemaListener[uriStr];
            if (schemaListener) {
                schemaListener.dispose();
                delete _this._schemaListener[uriStr];
            }
        };
        this._disposables.push(this._monacoInstance.editor.onDidCreateModel(onModelAdd));
        this._disposables.push(this._monacoInstance.editor.onWillDisposeModel(onModelRemoved));
        this._disposables.push(this._monacoInstance.editor.onDidChangeModelLanguage(function (event) {
            onModelRemoved(event.model);
            onModelAdd(event.model);
        }));
        this._disposables.push({
            dispose: function () {
                for (var key in _this._contentListener) {
                    _this._contentListener[key].dispose();
                }
            },
        });
        this._monacoInstance.editor.getModels().forEach(onModelAdd);
    }
    DiagnosticsAdapter.prototype.dispose = function () {
        this._disposables.forEach(function (d) { return d && d.dispose(); });
        this._disposables = [];
    };
    DiagnosticsAdapter.prototype._doValidate = function (model, languageId, intervals) {
        var _this = this;
        if (model.isDisposed()) {
            return;
        }
        var resource = model.uri;
        var versionNumberBefore = model.getVersionId();
        this._worker(resource)
            .then(function (worker) {
            return worker.doValidation(resource.toString(), intervals);
        })
            .then(function (diagnostics) {
            var newModel = _this._monacoInstance.editor.getModel(resource);
            var versionId = newModel.getVersionId();
            if (versionId !== versionNumberBefore) {
                return;
            }
            var markers = diagnostics.map(function (d) { return toDiagnostics(resource, d); });
            var model = _this._monacoInstance.editor.getModel(resource);
            var oldDecorations = model.getAllDecorations()
                .filter(function (decoration) { return decoration.options.className == "squiggly-error"; })
                .map(function (decoration) { return decoration.id; });
            if (model && model.getModeId() === languageId) {
                var syntaxErrorAsMarkDown = _this.defaults.languageSettings.syntaxErrorAsMarkDown;
                if (!syntaxErrorAsMarkDown || !syntaxErrorAsMarkDown.enableSyntaxErrorAsMarkDown) {
                    // Remove previous syntax error decorations and set the new markers (for example, when disabling syntaxErrorAsMarkDown after it was enabled)                
                    model.deltaDecorations(oldDecorations, []);
                    _this._monacoInstance.editor.setModelMarkers(model, languageId, markers);
                }
                else {
                    // Add custom popup for syntax error: icon, header and message as markdown
                    var header = syntaxErrorAsMarkDown.header ? "**" + syntaxErrorAsMarkDown.header + "** \n\n" : "";
                    var icon = syntaxErrorAsMarkDown.icon ? "![](" + syntaxErrorAsMarkDown.icon + ")" : "";
                    var popupErrorHoverHeaderMessage_1 = icon + " " + header;
                    var newDecorations = markers.map(function (marker) {
                        return {
                            range: {
                                startLineNumber: marker.startLineNumber,
                                startColumn: marker.startColumn,
                                endLineNumber: marker.endLineNumber,
                                endColumn: marker.endColumn
                            },
                            options: {
                                hoverMessage: {
                                    value: popupErrorHoverHeaderMessage_1 + marker.message
                                },
                                className: "squiggly-error",
                                zIndex: 100,
                                overviewRuler: {
                                    // The color indication on the right ruler
                                    color: "rgb(255, 18, 18, 0.7)",
                                    position: monaco.editor.OverviewRulerLane.Right
                                },
                                minimap: {
                                    color: "rgb(255, 18, 18, 0.7)",
                                    position: monaco.editor.MinimapPosition.Inline
                                }
                            }
                        };
                    });
                    var oldMarkers = monaco.editor.getModelMarkers({
                        owner: languageId,
                        resource: resource
                    }).filter(function (marker) { return marker.severity == monaco.MarkerSeverity.Error; });
                    if (oldMarkers && oldMarkers.length > 0) {
                        // In case there were previous markers, remove their decorations (for example, when enabling syntaxErrorAsMarkDown after it was disabled)
                        oldDecorations = [];
                        // Remove previous markers
                        _this._monacoInstance.editor.setModelMarkers(model, languageId, []);
                    }
                    // Remove previous syntax error decorations and set the new decorations
                    model.deltaDecorations(oldDecorations, newDecorations);
                }
            }
        })
            .then(undefined, function (err) {
            console.error(err);
        });
    };
    return DiagnosticsAdapter;
}());
export { DiagnosticsAdapter };
function changeEventToIntervals(e) {
    return e.changes.map(function (change) { return ({
        start: change.rangeOffset,
        end: change.rangeOffset + change.text.length,
    }); });
}
function toSeverity(lsSeverity) {
    switch (lsSeverity) {
        case ls.DiagnosticSeverity.Error:
            return monaco.MarkerSeverity.Error;
        case ls.DiagnosticSeverity.Warning:
            return monaco.MarkerSeverity.Warning;
        case ls.DiagnosticSeverity.Information:
            return monaco.MarkerSeverity.Info;
        case ls.DiagnosticSeverity.Hint:
            return monaco.MarkerSeverity.Hint;
        default:
            return monaco.MarkerSeverity.Info;
    }
}
function toDiagnostics(resource, diag) {
    var code = typeof diag.code === 'number' ? String(diag.code) : diag.code;
    return {
        severity: toSeverity(diag.severity),
        startLineNumber: diag.range.start.line + 1,
        startColumn: diag.range.start.character + 1,
        endLineNumber: diag.range.end.line + 1,
        endColumn: diag.range.end.character + 1,
        message: diag.message,
        code: code,
        source: diag.source,
    };
}
// --- colorization ---
function fromIRange(range) {
    if (!range) {
        return undefined;
    }
    if (range instanceof monaco.Range) {
        return { start: fromPosition(range.getStartPosition()), end: fromPosition(range.getEndPosition()) };
    }
    var startLineNumber = range.startLineNumber, startColumn = range.startColumn, endLineNumber = range.endLineNumber, endColumn = range.endColumn;
    range = new monaco.Range(startLineNumber, startColumn, endLineNumber, endColumn);
}
// commented here is the color definitions are were defined by v1 intellisense terminology:
// { token: 'comment', foreground: '008000' }, // CommentToken Green
// { token: 'variable.predefined', foreground: '800080' }, // CalculatedColumnToken Purple
// { token: 'function', foreground: '0000FF' }, // FunctionNameToken Blue
// { token: 'operator.sql', foreground: 'FF4500' }, // OperatorToken OrangeRed (now changed to darker color CC3700 because wasn't accessible)
// { token: 'string', foreground: 'B22222' }, // StringLiteralToken Firebrick
// { token: 'operator.scss', foreground: '0000FF' }, // SubOperatorToken Blue
// { token: 'variable', foreground: 'C71585' }, // TableColumnToken MediumVioletRed
// { token: 'variable.parameter', foreground: '9932CC' }, // TableToken DarkOrchid
// { token: '', foreground: '000000' }, // UnknownToken, PlainTextToken  Black
// { token: 'type', foreground: '0000FF' }, // DataTypeToken Blue
// { token: 'tag', foreground: '0000FF' }, // ControlCommandToken Blue
// { token: 'annotation', foreground: '2B91AF' }, // QueryParametersToken FF2B91AF
// { token: 'keyword', foreground: '0000FF' }, // CslCommandToken, PluginToken Blue
// { token: 'number', foreground: '191970' }, // LetVariablesToken MidnightBlue
// { token: 'annotation', foreground: '9400D3' }, // ClientDirectiveToken DarkViolet
// { token: 'invalid', background: 'cd3131' },
var classificationToColorLight = {
    Column: 'C71585',
    Comment: '008000',
    Database: 'C71585',
    Function: '0000FF',
    Identifier: '000000',
    Keyword: '0000FF',
    Literal: 'B22222',
    ScalarOperator: '000000',
    MaterializedView: 'C71585',
    MathOperator: '000000',
    Command: '0000FF',
    Parameter: '2B91AF',
    PlainText: '000000',
    Punctuation: '000000',
    QueryOperator: 'CC3700',
    QueryParameter: 'CC3700',
    StringLiteral: 'B22222',
    Table: 'C71585',
    Type: '0000FF',
    Variable: '191970',
    Directive: '9400D3',
    ClientParameter: 'b5cea8',
    SchemaMember: 'C71585',
    SignatureParameter: '2B91AF',
    Option: '000000',
};
var classificationToColorDark = {
    Column: '4ec9b0',
    Comment: '608B4E',
    Database: 'c586c0',
    Function: 'dcdcaa',
    Identifier: 'd4d4d4',
    Keyword: '569cd6',
    Literal: 'ce9178',
    ScalarOperator: 'd4d4d4',
    MaterializedView: 'c586c0',
    MathOperator: 'd4d4d4',
    Command: 'd4d4d4',
    Parameter: '2B91AF',
    PlainText: 'd4d4d4',
    Punctuation: 'd4d4d4',
    QueryOperator: '9cdcfe',
    QueryParameter: '9cdcfe',
    StringLiteral: 'ce9178',
    Table: 'c586c0',
    Type: '569cd6',
    Variable: 'd7ba7d',
    Directive: 'b5cea8',
    ClientParameter: 'b5cea8',
    SchemaMember: '4ec9b0',
    SignatureParameter: '2B91AF',
    Option: 'd4d4d4',
};
var ColorizationAdapter = /** @class */ (function () {
    function ColorizationAdapter(_monacoInstance, _languageId, _worker, defaults, onSchemaChange) {
        var _this = this;
        this._monacoInstance = _monacoInstance;
        this._languageId = _languageId;
        this._worker = _worker;
        this._disposables = [];
        this._contentListener = Object.create(null);
        this._configurationListener = Object.create(null);
        this._schemaListener = Object.create(null);
        this.decorations = [];
        injectCss();
        var onModelAdd = function (model) {
            var modeId = model.getModeId();
            if (modeId !== _this._languageId) {
                return;
            }
            var debouncedColorization = _.debounce(function (intervals) { return _this._doColorization(model, modeId, intervals); }, 500);
            var handle;
            _this._contentListener[model.uri.toString()] = model.onDidChangeContent(function (e) {
                // Changes are represented as a range in doc before change, plus the text that it was replaced with.
                // We are interested in the range _after_ the change (since that's what we need to colorize).
                // folowing logic calculates that.
                var intervalsToColorize = changeEventToIntervals(e);
                debouncedColorization(intervalsToColorize);
            });
            _this._configurationListener[model.uri.toString()] = defaults.onDidChange(function () {
                self.setTimeout(function () { return _this._doColorization(model, modeId, []); }, 0);
            });
            _this._schemaListener[model.uri.toString()] = onSchemaChange(function () {
                self.setTimeout(function () { return _this._doColorization(model, modeId, []); }, 0);
            });
        };
        var onModelRemoved = function (model) {
            model.deltaDecorations(_this.decorations, []);
            var uriStr = model.uri.toString();
            var contentListener = _this._contentListener[uriStr];
            if (contentListener) {
                contentListener.dispose();
                delete _this._contentListener[uriStr];
            }
            var configurationListener = _this._configurationListener[uriStr];
            if (configurationListener) {
                configurationListener.dispose();
                delete _this._configurationListener[uriStr];
            }
            var schemaListener = _this._configurationListener[uriStr];
            if (schemaListener) {
                schemaListener.dispose();
                delete _this._schemaListener[uriStr];
            }
        };
        this._disposables.push(this._monacoInstance.editor.onDidCreateModel(onModelAdd));
        this._disposables.push(this._monacoInstance.editor.onWillDisposeModel(onModelRemoved));
        this._disposables.push(this._monacoInstance.editor.onDidChangeModelLanguage(function (event) {
            onModelRemoved(event.model);
            onModelAdd(event.model);
        }));
        this._disposables.push({
            dispose: function () {
                for (var key in _this._contentListener) {
                    _this._contentListener[key].dispose();
                }
            },
        });
        this._monacoInstance.editor.getModels().forEach(onModelAdd);
    }
    ColorizationAdapter.prototype.dispose = function () {
        this._disposables.forEach(function (d) { return d && d.dispose(); });
        this._disposables = [];
    };
    /**
     * Return true if the range doesn't intersect any of the line ranges.
     * @param range Range
     * @param impactedLineRanges an array of line ranges
     */
    ColorizationAdapter.prototype._rangeDoesNotIntersectAny = function (range, impactedLineRanges) {
        return impactedLineRanges.every(function (lineRange) {
            return range.startLineNumber > lineRange.lastImpactedLine || range.endLineNumber < lineRange.firstImpactedLine;
        });
    };
    ColorizationAdapter.prototype._doColorization = function (model, languageId, intervals) {
        var _this = this;
        if (model.isDisposed()) {
            return;
        }
        var resource = model.uri;
        var versionNumberBeforeColorization = model.getVersionId();
        this._worker(resource)
            .then(function (worker) {
            return worker.doColorization(resource.toString(), intervals);
        })
            .then(function (colorizationRanges) {
            var newModel = _this._monacoInstance.editor.getModel(model.uri);
            var versionId = newModel.getVersionId();
            // don't colorize an older version of the document.
            if (versionId !== versionNumberBeforeColorization) {
                return;
            }
            var decorationRanges = colorizationRanges.map(function (colorizationRange) {
                var decorations = colorizationRange.classifications
                    .map(function (classification) { return toDecoration(model, classification); })
                    // The following line will prevent things that aren't going to be colorized anyway to get a CSS class.
                    // This will prevent the case where the non-semantic colorizer already figured out that a keyword needs
                    // to be colorized, but the outdated semantic colorizer still thinks it's a plain text and wants it colored
                    // in black.
                    .filter(function (d) {
                    return d.options.inlineClassName !== 'PlainText' && d.options.inlineClassName != 'Identifier';
                });
                var firstImpactedLine = model.getPositionAt(colorizationRange.absoluteStart).lineNumber;
                var endPosition = model.getPositionAt(colorizationRange.absoluteEnd);
                // A token that ends in the first column of the next line is not considered to be part of that line.
                var lastImpactedLine = endPosition.column == 1 && endPosition.lineNumber > 1
                    ? endPosition.lineNumber - 1
                    : endPosition.lineNumber;
                return { decorations: decorations, firstImpactedLine: firstImpactedLine, lastImpactedLine: lastImpactedLine };
            });
            // Compute the previous decorations we want to replace with the new ones.
            var oldDecorations = decorationRanges
                .map(function (range) {
                return model
                    .getLinesDecorations(range.firstImpactedLine, range.lastImpactedLine)
                    .filter(function (d) { return classificationToColorLight[d.options.inlineClassName]; }) // Don't delete any other decorations
                    .map(function (d) { return d.id; });
            })
                .reduce(function (prev, curr) { return prev.concat(curr); }, []);
            // Flatten decoration groups to an array of decorations
            var newDecorations = decorationRanges.reduce(function (prev, next) { return prev.concat(next.decorations); }, []);
            if (model && model.getModeId() === languageId) {
                _this.decorations = model.deltaDecorations(oldDecorations, newDecorations);
            }
        })
            .then(undefined, function (err) {
            console.error(err);
        });
    };
    return ColorizationAdapter;
}());
export { ColorizationAdapter };
/**
 * Gets all keys of an enum (the string keys not the numeric values).
 * @param e Enum type
 */
function getEnumKeys(e) {
    return Object.keys(e).filter(function (k) { return typeof e[k] === 'number'; });
}
/**
 * Generates a mapping between ClassificationKind and color.
 */
function getClassificationColorTriplets() {
    var keys = getEnumKeys(ClassificationKind);
    var result = keys.map(function (key) { return ({
        classification: key,
        colorLight: classificationToColorLight[key],
        colorDark: classificationToColorDark[key],
    }); });
    return result;
}
/**
 * Returns a string which is a css describing all tokens and their colors.
 * looks a little bit something like this:
 *
 * .vs .Literal {color: '#000000';} .vs-dark .Literal {color: '#FFFFFF';}
 * .vs .Comment {color: '#111111';} .vs-dark .Comment {color: '#EEEEEE';}
 */
function getCssForClassification() {
    var classificationColorTriplets = getClassificationColorTriplets();
    var cssInnerHtml = classificationColorTriplets
        .map(function (pair) {
        return ".vs ." + pair.classification + " {color: #" + pair.colorLight + ";} .vs-dark ." + pair.classification + " {color: #" + pair.colorDark + ";}";
    })
        .join('\n');
    return cssInnerHtml;
}
/**
 * Inject a CSS sheet to the head of document, coloring kusto elements by classification.
 * TODO: make idempotent
 */
function injectCss() {
    var container = document.getElementsByTagName('head')[0];
    var style = document.createElement('style');
    style.type = 'text/css';
    style.media = 'screen';
    container.appendChild(style);
    ClassificationKind;
    style.innerHTML = getCssForClassification();
}
function toDecoration(model, classification) {
    var start = model.getPositionAt(classification.start);
    var end = model.getPositionAt(classification.start + classification.length);
    var range = new Range(start.lineNumber, start.column, end.lineNumber, end.column);
    var inlineClassName = ClassificationKind.$names[classification.kind];
    return {
        range: range,
        options: {
            inlineClassName: inlineClassName,
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
    };
}
// --- completion ------
function fromPosition(position) {
    if (!position) {
        return void 0;
    }
    return { character: position.column - 1, line: position.lineNumber - 1 };
}
function fromRange(range) {
    if (!range) {
        return void 0;
    }
    return { start: fromPosition(range.getStartPosition()), end: fromPosition(range.getEndPosition()) };
}
function toRange(range) {
    if (!range) {
        return void 0;
    }
    return new Range(range.start.line + 1, range.start.character + 1, range.end.line + 1, range.end.character + 1);
}
function toCompletionItemKind(kind) {
    var mItemKind = monaco.languages.CompletionItemKind;
    switch (kind) {
        case ls.CompletionItemKind.Text:
            return mItemKind.Text;
        case ls.CompletionItemKind.Method:
            return mItemKind.Method;
        case ls.CompletionItemKind.Function:
            return mItemKind.Function;
        case ls.CompletionItemKind.Constructor:
            return mItemKind.Constructor;
        case ls.CompletionItemKind.Field:
            return mItemKind.Field;
        case ls.CompletionItemKind.Variable:
            return mItemKind.Variable;
        case ls.CompletionItemKind.Class:
            return mItemKind.Class;
        case ls.CompletionItemKind.Interface:
            return mItemKind.Interface;
        case ls.CompletionItemKind.Module:
            return mItemKind.Module;
        case ls.CompletionItemKind.Property:
            return mItemKind.Property;
        case ls.CompletionItemKind.Unit:
            return mItemKind.Unit;
        case ls.CompletionItemKind.Value:
            return mItemKind.Value;
        case ls.CompletionItemKind.Enum:
            return mItemKind.Enum;
        case ls.CompletionItemKind.Keyword:
            return mItemKind.Keyword;
        case ls.CompletionItemKind.Snippet:
            return mItemKind.Snippet;
        case ls.CompletionItemKind.Color:
            return mItemKind.Color;
        case ls.CompletionItemKind.File:
            return mItemKind.File;
        case ls.CompletionItemKind.Reference:
            return mItemKind.Reference;
    }
    return mItemKind.Property;
}
function toTextEdit(textEdit) {
    if (!textEdit) {
        return void 0;
    }
    return {
        range: toRange(textEdit.range),
        text: textEdit.newText,
    };
}
var CompletionAdapter = /** @class */ (function () {
    function CompletionAdapter(_worker, languageSettings) {
        this._worker = _worker;
        this.languageSettings = languageSettings;
    }
    Object.defineProperty(CompletionAdapter.prototype, "triggerCharacters", {
        get: function () {
            return [' '];
        },
        enumerable: false,
        configurable: true
    });
    CompletionAdapter.prototype.provideCompletionItems = function (model, position, context, token) {
        var wordInfo = model.getWordUntilPosition(position);
        var wordRange = new Range(position.lineNumber, wordInfo.startColumn, position.lineNumber, wordInfo.endColumn);
        var resource = model.uri;
        var onDidProvideCompletionItems = this.languageSettings
            .onDidProvideCompletionItems;
        return this._worker(resource)
            .then(function (worker) {
            return worker.doComplete(resource.toString(), fromPosition(position));
        })
            .then(function (info) { return (onDidProvideCompletionItems ? onDidProvideCompletionItems(info) : info); })
            .then(function (info) {
            if (!info) {
                return;
            }
            var items = info.items.map(function (entry) {
                var item = {
                    label: entry.label,
                    insertText: entry.insertText,
                    sortText: entry.sortText,
                    filterText: entry.filterText,
                    documentation: entry.documentation,
                    detail: entry.detail,
                    range: wordRange,
                    kind: toCompletionItemKind(entry.kind),
                };
                if (entry.textEdit) {
                    item.range = toRange(entry.textEdit.range);
                    item.insertText = entry.textEdit.newText;
                }
                if (entry.insertTextFormat === ls.InsertTextFormat.Snippet) {
                    item.insertTextRules = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
                }
                return item;
            });
            return {
                isIncomplete: info.isIncomplete,
                suggestions: items,
            };
        });
    };
    return CompletionAdapter;
}());
export { CompletionAdapter };
function isMarkupContent(thing) {
    return thing && typeof thing === 'object' && typeof thing.kind === 'string';
}
function toMarkdownString(entry) {
    if (typeof entry === 'string') {
        return {
            value: entry,
        };
    }
    if (isMarkupContent(entry)) {
        if (entry.kind === 'plaintext') {
            return {
                value: entry.value.replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&'),
            };
        }
        return {
            value: entry.value,
        };
    }
    return { value: '```' + entry.value + '\n' + entry.value + '\n```\n' };
}
function toMarkedStringArray(contents) {
    if (!contents) {
        return void 0;
    }
    if (Array.isArray(contents)) {
        return contents.map(toMarkdownString);
    }
    return [toMarkdownString(contents)];
}
// --- definition ------
function toLocation(location) {
    return {
        uri: Uri.parse(location.uri),
        range: toRange(location.range),
    };
}
var DefinitionAdapter = /** @class */ (function () {
    function DefinitionAdapter(_worker) {
        this._worker = _worker;
    }
    DefinitionAdapter.prototype.provideDefinition = function (model, position, token) {
        var resource = model.uri;
        return this._worker(resource)
            .then(function (worker) {
            return worker.findDefinition(resource.toString(), fromPosition(position));
        })
            .then(function (definition) {
            if (!definition || definition.length == 0) {
                return;
            }
            return [toLocation(definition[0])];
        });
    };
    return DefinitionAdapter;
}());
export { DefinitionAdapter };
// --- references ------
var ReferenceAdapter = /** @class */ (function () {
    function ReferenceAdapter(_worker) {
        this._worker = _worker;
    }
    ReferenceAdapter.prototype.provideReferences = function (model, position, context, token) {
        var resource = model.uri;
        return this._worker(resource)
            .then(function (worker) {
            return worker.findReferences(resource.toString(), fromPosition(position));
        })
            .then(function (entries) {
            if (!entries) {
                return;
            }
            return entries.map(toLocation);
        });
    };
    return ReferenceAdapter;
}());
export { ReferenceAdapter };
// --- rename ------
function toWorkspaceEdit(edit) {
    if (!edit || !edit.changes) {
        return void 0;
    }
    var resourceEdits = [];
    for (var uri in edit.changes) {
        var _uri = Uri.parse(uri);
        for (var _i = 0, _a = edit.changes[uri]; _i < _a.length; _i++) {
            var e = _a[_i];
            resourceEdits.push({
                resource: _uri,
                edit: {
                    range: toRange(e.range),
                    text: e.newText,
                },
            });
        }
    }
    return {
        edits: resourceEdits,
    };
}
var RenameAdapter = /** @class */ (function () {
    function RenameAdapter(_worker) {
        this._worker = _worker;
    }
    RenameAdapter.prototype.provideRenameEdits = function (model, position, newName, token) {
        var resource = model.uri;
        return this._worker(resource)
            .then(function (worker) {
            return worker.doRename(resource.toString(), fromPosition(position), newName);
        })
            .then(function (edit) {
            return toWorkspaceEdit(edit);
        });
    };
    return RenameAdapter;
}());
export { RenameAdapter };
// --- document symbols ------
function toSymbolKind(kind) {
    var mKind = monaco.languages.SymbolKind;
    switch (kind) {
        case ls.SymbolKind.File:
            return mKind.Array;
        case ls.SymbolKind.Module:
            return mKind.Module;
        case ls.SymbolKind.Namespace:
            return mKind.Namespace;
        case ls.SymbolKind.Package:
            return mKind.Package;
        case ls.SymbolKind.Class:
            return mKind.Class;
        case ls.SymbolKind.Method:
            return mKind.Method;
        case ls.SymbolKind.Property:
            return mKind.Property;
        case ls.SymbolKind.Field:
            return mKind.Field;
        case ls.SymbolKind.Constructor:
            return mKind.Constructor;
        case ls.SymbolKind.Enum:
            return mKind.Enum;
        case ls.SymbolKind.Interface:
            return mKind.Interface;
        case ls.SymbolKind.Function:
            return mKind.Function;
        case ls.SymbolKind.Variable:
            return mKind.Variable;
        case ls.SymbolKind.Constant:
            return mKind.Constant;
        case ls.SymbolKind.String:
            return mKind.String;
        case ls.SymbolKind.Number:
            return mKind.Number;
        case ls.SymbolKind.Boolean:
            return mKind.Boolean;
        case ls.SymbolKind.Array:
            return mKind.Array;
    }
    return mKind.Function;
}
// --- formatting -----
var DocumentFormatAdapter = /** @class */ (function () {
    function DocumentFormatAdapter(_worker) {
        this._worker = _worker;
    }
    DocumentFormatAdapter.prototype.provideDocumentFormattingEdits = function (model, options, token) {
        var resource = model.uri;
        return this._worker(resource).then(function (worker) {
            return worker.doDocumentFormat(resource.toString()).then(function (edits) { return edits.map(function (edit) { return toTextEdit(edit); }); });
        });
    };
    return DocumentFormatAdapter;
}());
export { DocumentFormatAdapter };
var FormatAdapter = /** @class */ (function () {
    function FormatAdapter(_worker) {
        this._worker = _worker;
    }
    FormatAdapter.prototype.provideDocumentRangeFormattingEdits = function (model, range, options, token) {
        var resource = model.uri;
        return this._worker(resource).then(function (worker) {
            return worker
                .doRangeFormat(resource.toString(), fromRange(range))
                .then(function (edits) { return edits.map(function (edit) { return toTextEdit(edit); }); });
        });
    };
    return FormatAdapter;
}());
export { FormatAdapter };
// --- Folding ---
var FoldingAdapter = /** @class */ (function () {
    function FoldingAdapter(_worker) {
        this._worker = _worker;
    }
    FoldingAdapter.prototype.provideFoldingRanges = function (model, context, token) {
        var resource = model.uri;
        return this._worker(resource).then(function (worker) {
            return worker
                .doFolding(resource.toString())
                .then(function (foldingRanges) {
                return foldingRanges.map(function (range) { return toFoldingRange(range); });
            });
        });
    };
    return FoldingAdapter;
}());
export { FoldingAdapter };
function toFoldingRange(range) {
    return {
        start: range.startLine + 1,
        end: range.endLine + 1,
        kind: monaco.languages.FoldingRangeKind.Region,
    };
}
// --- hover ------
var HoverAdapter = /** @class */ (function () {
    function HoverAdapter(_worker) {
        this._worker = _worker;
    }
    HoverAdapter.prototype.provideHover = function (model, position, token) {
        var resource = model.uri;
        return this._worker(resource)
            .then(function (worker) {
            return worker.doHover(resource.toString(), fromPosition(position));
        })
            .then(function (info) {
            if (!info) {
                return;
            }
            return {
                range: toRange(info.range),
                contents: toMarkedStringArray(info.contents),
            };
        });
    };
    return HoverAdapter;
}());
export { HoverAdapter };
