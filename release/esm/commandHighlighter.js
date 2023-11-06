/**
 * Highlights the command that surround cursor location
 */
var KustoCommandHighlighter = /** @class */ (function () {
    /**
     * Register to cursor movement and seleciton events.
     * @param editor monaco editor instance
     */
    function KustoCommandHighlighter(editor) {
        var _this = this;
        this.editor = editor;
        this.disposables = [];
        this.decorations = [];
        // Note that selection update is triggered not only for selection changes, but also just when no text selection is occuring and cursor just moves around.
        // This case is counted as a 0-length selection starting and ending on the cursor position.
        this.editor.onDidChangeCursorSelection(function (changeEvent) {
            if (_this.editor.getModel().getLanguageId() !== 'kusto') {
                return;
            }
            _this.highlightCommandUnderCursor(changeEvent);
        });
    }
    KustoCommandHighlighter.prototype.getId = function () {
        return KustoCommandHighlighter.ID;
    };
    KustoCommandHighlighter.prototype.dispose = function () {
        this.disposables.forEach(function (d) { return d.dispose(); });
    };
    KustoCommandHighlighter.prototype.highlightCommandUnderCursor = function (changeEvent) {
        // Looks like the user selected a bunch of text. we don't want to highlight the entire command in this case - since highlighting
        // the text is more helpful.
        if (!changeEvent.selection.isEmpty()) {
            this.decorations = this.editor.deltaDecorations(this.decorations, []);
            return;
        }
        var commandRange = this.editor.getCurrentCommandRange(changeEvent.selection.getStartPosition());
        var decorations = [
            {
                range: commandRange,
                options: KustoCommandHighlighter.CURRENT_COMMAND_HIGHLIGHT,
            },
        ];
        this.decorations = this.editor.deltaDecorations(this.decorations, decorations);
    };
    KustoCommandHighlighter.ID = 'editor.contrib.kustoCommandHighliter';
    KustoCommandHighlighter.CURRENT_COMMAND_HIGHLIGHT = {
        className: 'selectionHighlight',
    };
    return KustoCommandHighlighter;
}());
export default KustoCommandHighlighter;
