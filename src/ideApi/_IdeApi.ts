"use strict";
/*
 * Module for encapsulation of the IDE API.
 * Allows simple implementation of adapter components for other IDEs.
 */
export {
  window,
  commands,
  workspace,
  WorkspaceConfiguration,
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

export {
  LanguageClient,
  ServerOptions as ClientServerOptions,
} from "vscode-languageclient/node";

export {
  LanguageClientOptions,
  ResponseError,
  TextDocumentIdentifier,
} from "vscode-languageclient";

export { URI } from "vscode-uri";
export { Trace } from "vscode-jsonrpc";
