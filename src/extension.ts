"use strict";

import { platform } from "os";
import * as vscode from "vscode";

import DafnyLanguageServer from "./server/dafnyLanguageServer";
import Capabilities from "./localExecutionHelpers/executionCapabilities";
import { Warning, Error } from "./stringRessources/messages";
import { EnvironmentConfig } from "./stringRessources/commands";

/**
 * This is the plugins entry point (the "main" function)
 * It checks for the right way to start the language server (mono or not mono on windows)
 * and starts the language server with the DafnyLanguageServer class.
 */
export function activate(extensionContext: vscode.ExtensionContext) {
  if (vscode.workspace.workspaceFolders === undefined) {
    vscode.window.showWarningMessage(Warning.NoWorkspace);
  }

  if (!Capabilities.hasSupportedMonoVersion()) {
    // Promt the user to install Mono and stop extension execution.
    vscode.window
      .showErrorMessage(
        Error.NoSupportedMono,
        Error.ConfigureMonoExecutable,
        Error.GetMono
      )
      .then((selection) => {
        if (selection === Error.GetMono) {
          vscode.commands.executeCommand(
            "vscode.open",
            vscode.Uri.parse(Error.GetMonoUri)
          );
          let restartMessage;
          if (platform() === EnvironmentConfig.OSX) {
            // Mono adds a new folder to PATH; so give the easiest advice
            restartMessage = Error.RestartMacAfterMonoInstall;
          } else {
            restartMessage = Error.RestartCodeAfterMonoInstall;
          }
          vscode.window.showWarningMessage(restartMessage);
        }

        if (selection === Error.ConfigureMonoExecutable) {
          vscode.commands.executeCommand(
            "workbench.action.configureLanguageBasedSettings"
          );
        }
      });
    return;
  }

  const dafnyLanguageServer = new DafnyLanguageServer(extensionContext);
  dafnyLanguageServer.startLanguageServer();
  dafnyLanguageServer.registerServerRestartCommand();
}
