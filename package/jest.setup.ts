require('@kusto/language-service/bridge.min');
require('@kusto/language-service/Kusto.JavaScript.Client.min');
require('@kusto/language-service/newtonsoft.json.min');
require('@axiomhq/language-service-next/Kusto.Language.Bridge.min');

jest.mock('monaco-editor/esm/vs/editor/editor.api', () => require('./tests/unit/mocks/monaco-editor'));
