/// <reference path="../node_modules/monaco-editor-core/monaco.d.ts" />
/**
 * Extending ICode editor to contain additional kusto-speicifc methods.
 * note that the extend method needs to be called at least once to take affect, otherwise this here code is useless.
 */
export function extend(editor) {
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
