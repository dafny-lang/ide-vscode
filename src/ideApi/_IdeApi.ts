"use strict";
/*
 * Module for encapsulation of the IDE API.
 * Allows simple to implement adapter components for other IDEs.
 */
export * as ide from "vscode"; // eliminate this

export { workspace, WorkspaceConfiguration, window } from "vscode";

export { LanguageClientOptions } from "vscode-languageclient/lib/client";
export {
  LanguageClient,
  ResponseError,
  ServerOptions as ClientServerOptions,
} from "vscode-languageclient";

export * as uri from "vscode-uri";
export { Trace } from "vscode-jsonrpc";
