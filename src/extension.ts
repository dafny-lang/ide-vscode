"use strict";
import { ide } from "./ideApi/_IdeApi";
import { ServerInitializer } from "./dafnyLanguageServerStartup/_DafnyLanguageServerStartupModule";
import { ExecutionCapabilities } from "./localExecution/_LocalExecutionModule";
import { Warning, Error } from "./stringResources/_StringResourcesModule";

/**
 * This is the plugin's entry point (the "main" function)
 * It checks for the right way to start the language server (mono or not mono on Windows)
 * and starts the language server with the DafnyLanguageServer class.
 */
export function activate(extensionContext: ide.ExtensionContext) {
  if (ide.workspace.workspaceFolders === undefined) {
    ide.window.showWarningMessage(Warning.NoWorkspace);
  }

  const exeCapabilities = new ExecutionCapabilities();
  if (!exeCapabilities.hasSupportedMonoVersion()) {
    // Promt the user to install Mono and stop extension execution.
    ide.window
      .showErrorMessage(
        Error.NoSupportedMono,
        Error.ConfigureMonoExecutable,
        Error.GetMono
      )
      .then((selection: string | undefined) => {
        if (selection !== undefined) {
          exeCapabilities.getMono(selection);
        }
      });
    return;
  }

  const dafnyLanguageServer = new ServerInitializer(extensionContext);
  dafnyLanguageServer.startLanguageServer();
  dafnyLanguageServer.registerServerRestartCommand();
}
