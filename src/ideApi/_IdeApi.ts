"use strict";
/*
 * Module for encapsulation of the IDE API.
 * Allows simple to implement adapter components for other IDEs.
 */
export {
  workspace,
  WorkspaceConfiguration,
  window,
  commands,
  ExtensionContext,
  Disposable,
  Uri,
  Position,
  Range,
  Location,
  TextDocument,
  TextEditor,
  TextDocumentChangeEvent,
  DecorationOptions,
  TextEditorDecorationType,
  DecorationRenderOptions,
  InputBoxOptions,
  StatusBarItem,
  StatusBarAlignment,
} from "vscode";

export { LanguageClientOptions } from "vscode-languageclient/lib/client";
export {
  LanguageClient,
  ResponseError,
  ServerOptions as ClientServerOptions,
} from "vscode-languageclient";

export * as uri from "vscode-uri";
export { Trace } from "vscode-jsonrpc";
