// Augments monaco global types with Kusto api. Should be imported if you're
// using amd modules, or if you've set `MonacoEnvironment.globalApi` to true.

/// <reference types="monaco-editor/monaco" />

declare namespace monaco.editor {
    export interface ICodeEditor {
        getCurrentCommandRange(cursorPosition: monaco.Position): monaco.Range;
    }
}

// No easy way to declare a namespace that matches an existing module right
// now
// https://github.com/microsoft/TypeScript/issues/10187

// Export everything but the types
declare namespace monaco.languages {
    export const kusto: typeof import('@axiomhq/monaco-apl');
}

// Types must be manually re-exported right now :(
declare namespace monaco.languages.kusto {
    export type LanguageSettings = import('@axiomhq/monaco-apl').LanguageSettings;
    export type SyntaxErrorAsMarkDownOptions = import('@axiomhq/monaco-apl').SyntaxErrorAsMarkDownOptions;
    export type QuickFixCodeActionOptions = import('@axiomhq/monaco-apl').QuickFixCodeActionOptions;
    export type FormatterOptions = import('@axiomhq/monaco-apl').FormatterOptions;
    export type FormatterPlacementStyle = import('@axiomhq/monaco-apl').FormatterPlacementStyle;
    export type LanguageServiceDefaults = import('@axiomhq/monaco-apl').LanguageServiceDefaults;
    export type KustoWorker = import('@axiomhq/monaco-apl').KustoWorker;
    export type WorkerAccessor = import('@axiomhq/monaco-apl').WorkerAccessor;
    export type Column = import('@axiomhq/monaco-apl').Column;
    export type Table = import('@axiomhq/monaco-apl').Table;
    export type ScalarParameter = import('@axiomhq/monaco-apl').ScalarParameter;
    export type TabularParameter = import('@axiomhq/monaco-apl').TabularParameter;
    export type InputParameter = import('@axiomhq/monaco-apl').InputParameter;
    export type Function = import('@axiomhq/monaco-apl').Function;
    export type Database = import('@axiomhq/monaco-apl').Database;
    export type EngineSchema = import('@axiomhq/monaco-apl').EngineSchema;
    export type ClusterMangerSchema = import('@axiomhq/monaco-apl').ClusterMangerSchema;
    export type DataManagementSchema = import('@axiomhq/monaco-apl').DataManagementSchema;
    export type Schema = import('@axiomhq/monaco-apl').Schema;
    export type VisualizationType = import('@axiomhq/monaco-apl').VisualizationType;
    export type Scale = import('@axiomhq/monaco-apl').Scale;
    export type LegendVisibility = import('@axiomhq/monaco-apl').LegendVisibility;
    export type YSplit = import('@axiomhq/monaco-apl').YSplit;
    export type Kind = import('@axiomhq/monaco-apl').Kind;
    export type RenderOptions = import('@axiomhq/monaco-apl').RenderOptions;
    export type RenderInfo = import('@axiomhq/monaco-apl').RenderInfo;
    export type DatabaseReference = import('@axiomhq/monaco-apl').DatabaseReference;
    export type ClusterReference = import('@axiomhq/monaco-apl').ClusterReference;
    export type OnDidProvideCompletionItems = import('@axiomhq/monaco-apl').OnDidProvideCompletionItems;
}
