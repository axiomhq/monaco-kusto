import * as worker from 'monaco-editor-core/esm/vs/editor/editor.worker';
import { KustoWorker } from './kustoWorker';
self.onmessage = function () {
    // ignore the first message
    worker.initialize(function (ctx, createData) {
        return new KustoWorker(ctx, createData);
    });
};
