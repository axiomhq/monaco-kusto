var KustoCommandFormatter = /** @class */ (function () {
    function KustoCommandFormatter(editor) {
        var _this = this;
        this.editor = editor;
        this.actionAdded = false;
        // selection also represents no selection - for example the event gets triggered when moving cursor from point
        // a to point b. in the case start position will equal end position.
        editor.onDidChangeCursorSelection(function (changeEvent) {
            if (_this.editor.getModel().getModeId() !== 'kusto') {
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
                    keybindings: [monaco.KeyMod.chord(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_K, monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_F)],
                    run: function (ed) {
                        editor.trigger('KustoCommandFormatter', 'editor.action.formatSelection', null);
                    },
                    contextMenuGroupId: '1_modification'
                });
                _this.actionAdded = true;
            }
        });
    }
    return KustoCommandFormatter;
}());
export default KustoCommandFormatter;
