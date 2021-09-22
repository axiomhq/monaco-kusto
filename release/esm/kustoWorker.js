import * as kustoService from './languageService/kustoLanguageService';
import * as ls from './_deps/vscode-languageserver-types/main';
var KustoWorker = /** @class */ (function () {
    function KustoWorker(ctx, createData) {
        this._ctx = ctx;
        this._languageSettings = createData.languageSettings;
        this._languageService = kustoService.getKustoLanguageService();
        this._languageService.configure(this._languageSettings);
    }
    // --- language service host ---------------
    KustoWorker.prototype.setSchema = function (schema) {
        return this._languageService.setSchema(schema);
    };
    KustoWorker.prototype.setSchemaFromShowSchema = function (schema, clusterConnectionString, databaseInContextName) {
        return this._languageService.setSchemaFromShowSchema(schema, clusterConnectionString, databaseInContextName);
    };
    KustoWorker.prototype.normalizeSchema = function (schema, clusterConnectionString, databaseInContextName) {
        return this._languageService.normalizeSchema(schema, clusterConnectionString, databaseInContextName);
    };
    KustoWorker.prototype.getSchema = function () {
        return this._languageService.getSchema();
    };
    KustoWorker.prototype.getCommandInContext = function (uri, cursorOffset) {
        var document = this._getTextDocument(uri);
        if (!document) {
            console.error("getCommandInContext: document is " + document + ". uri is " + uri);
            return null;
        }
        var commandInContext = this._languageService.getCommandInContext(document, cursorOffset);
        if (commandInContext === undefined) {
            return null;
        }
        return commandInContext;
    };
    KustoWorker.prototype.getQueryParams = function (uri, cursorOffset) {
        var document = this._getTextDocument(uri);
        if (!document) {
            console.error("getQueryParams: document is " + document + ". uri is " + uri);
            return null;
        }
        var queryParams = this._languageService.getQueryParams(document, cursorOffset);
        if (queryParams === undefined) {
            return null;
        }
        return queryParams;
    };
    KustoWorker.prototype.getGlobalParams = function (uri) {
        var document = this._getTextDocument(uri);
        if (!document) {
            console.error("getGLobalParams: document is " + document + ". uri is " + uri);
            return null;
        }
        var globalParams = this._languageService.getGlobalParams(document);
        if (globalParams === undefined) {
            return null;
        }
        return globalParams;
    };
    KustoWorker.prototype.getReferencedGlobalParams = function (uri, cursorOffest) {
        var document = this._getTextDocument(uri);
        if (!document) {
            console.error("getReferencedGlobalParams: document is " + document + ". uri is " + uri);
            return null;
        }
        var referencedParams = this._languageService.getReferencedGlobalParams(document, cursorOffest);
        if (referencedParams === undefined) {
            return null;
        }
        return referencedParams;
    };
    KustoWorker.prototype.getRenderInfo = function (uri, cursorOffset) {
        var document = this._getTextDocument(uri);
        if (!document) {
            console.error("getRenderInfo: document is " + document + ". uri is " + uri);
        }
        return this._languageService.getRenderInfo(document, cursorOffset).then(function (result) {
            if (!result) {
                return null;
            }
            return result;
        });
    };
    /**
     * Get command in context and the command range.
     * This method will basically convert generate microsoft language service interface to monaco interface.
     * @param uri document URI
     * @param cursorOffset offset from start of document to cursor
     */
    KustoWorker.prototype.getCommandAndLocationInContext = function (uri, cursorOffset) {
        var document = this._getTextDocument(uri);
        if (!document) {
            console.error("getCommandAndLocationInContext: document is " + document + ". uri is " + uri);
            return Promise.resolve(null);
        }
        return this._languageService.getCommandAndLocationInContext(document, cursorOffset).then(function (result) {
            if (!result) {
                return null;
            }
            // convert to monaco object.
            var text = result.text, _a = result.location.range, start = _a.start, end = _a.end;
            var range = new monaco.Range(start.line + 1, start.character + 1, end.line + 1, end.character + 1);
            return {
                range: range,
                text: text,
            };
        });
    };
    KustoWorker.prototype.getCommandsInDocument = function (uri) {
        var document = this._getTextDocument(uri);
        if (!document) {
            console.error("getCommandInDocument: document is " + document + ". uri is " + uri);
            return null;
        }
        return this._languageService.getCommandsInDocument(document);
    };
    KustoWorker.prototype.doComplete = function (uri, position) {
        var document = this._getTextDocument(uri);
        if (!document) {
            return null;
        }
        var completions = this._languageService.doComplete(document, position);
        return completions;
    };
    KustoWorker.prototype.doValidation = function (uri, intervals) {
        var document = this._getTextDocument(uri);
        var diagnostics = this._languageService.doValidation(document, intervals);
        return diagnostics;
    };
    KustoWorker.prototype.doRangeFormat = function (uri, range) {
        var document = this._getTextDocument(uri);
        var formatted = this._languageService.doRangeFormat(document, range);
        return formatted;
    };
    KustoWorker.prototype.doFolding = function (uri) {
        var document = this._getTextDocument(uri);
        var folding = this._languageService.doFolding(document);
        return folding;
    };
    KustoWorker.prototype.doDocumentFormat = function (uri) {
        var document = this._getTextDocument(uri);
        var formatted = this._languageService.doDocumentFormat(document);
        return formatted;
    };
    KustoWorker.prototype.doCurrentCommandFormat = function (uri, caretPosition) {
        var document = this._getTextDocument(uri);
        var formatted = this._languageService.doCurrentCommandFormat(document, caretPosition);
        return formatted;
    };
    // Colorize document. if offsets provided, will only colorize commands at these offsets. otherwise - will color the entire document.
    KustoWorker.prototype.doColorization = function (uri, colorizationIntervals) {
        var document = this._getTextDocument(uri);
        var colorizationInfo = this._languageService.doColorization(document, colorizationIntervals);
        return colorizationInfo;
    };
    KustoWorker.prototype.getClientDirective = function (text) {
        return this._languageService.getClientDirective(text);
    };
    KustoWorker.prototype.getAdminCommand = function (text) {
        return this._languageService.getAdminCommand(text);
    };
    KustoWorker.prototype.findDefinition = function (uri, position) {
        var document = this._getTextDocument(uri);
        var definition = this._languageService.findDefinition(document, position);
        return definition;
    };
    KustoWorker.prototype.findReferences = function (uri, position) {
        var document = this._getTextDocument(uri);
        var references = this._languageService.findReferences(document, position);
        return references;
    };
    KustoWorker.prototype.doRename = function (uri, position, newName) {
        var document = this._getTextDocument(uri);
        var workspaceEdit = this._languageService.doRename(document, position, newName);
        return workspaceEdit;
    };
    KustoWorker.prototype.doHover = function (uri, position) {
        var document = this._getTextDocument(uri);
        var hover = this._languageService.doHover(document, position);
        return hover;
    };
    KustoWorker.prototype.setParameters = function (parameters) {
        return this._languageService.setParameters(parameters);
    };
    KustoWorker.prototype.getTimeFilterInfo = function (uri, cursorOffset) {
        var document = this._getTextDocument(uri);
        return this._languageService.getTimeFilterInfo(document, cursorOffset);
    };
    ;
    KustoWorker.prototype._getTextDocument = function (uri) {
        var models = this._ctx.getMirrorModels();
        for (var _i = 0, models_1 = models; _i < models_1.length; _i++) {
            var model = models_1[_i];
            if (model.uri.toString() === uri) {
                return ls.TextDocument.create(uri, this._languageId, model.version, model.getValue());
            }
        }
        return null;
    };
    return KustoWorker;
}());
export { KustoWorker };
export function create(ctx, createData) {
    return new KustoWorker(ctx, createData);
}
