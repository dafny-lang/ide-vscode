"use strict";
import { ExtensionContext, workspace, window } from "./ideApi/_IdeApi";
import { ServerInitializer } from "./dafnyLanguageServerStartup/_DafnyLanguageServerStartupModule";
import { ExecutionCapabilities } from "./localExecution/_LocalExecutionModule";
import { Warning, Error } from "./stringResources/_StringResourcesModule";

/**
 * This is the plugin's entry point (the "main" function)
 * It starts the language server with the DafnyLanguageServer class.
 */
export function activate(extensionContext: ExtensionContext) {
  if (workspace.workspaceFolders === undefined) {
    window.showWarningMessage(Warning.NoWorkspace);
  }

  const exeCapabilities = new ExecutionCapabilities();
  if (!exeCapabilities.hasSupportedDotnetVersion()) {
    // Promt the user to install dotnet and stop extension execution.
    window
      .showErrorMessage(
        Error.NoSupportedDotnet,
        Error.ConfigureDotnetExecutable,
        Error.GetDotnet
      )
      .then((selection: string | undefined) => {
        if (selection !== undefined) {
          exeCapabilities.getDotnet(selection);
        }
      });
    return;
  }

  const dafnyLanguageServer = new ServerInitializer(extensionContext);
  dafnyLanguageServer.startLanguageServer();
  dafnyLanguageServer.registerServerRestartCommand();
}
