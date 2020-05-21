"use strict";
import * as vscode from "vscode";
import { Trace } from "vscode-jsonrpc";

import {
  Commands,
  Notifications,
  DafnyUiManager,
  ICommands,
  IDafnyUiManager,
  INotifications,
} from "../ui/_UiModule";
import {
  DafnyRunner,
  IDafnyRunner,
} from "../localExecution/_LocalExecutionModule";
import {
  CommandStrings,
  Error,
  Information,
} from "../stringRessources/_StringRessourcesModule";

import { ILanguageServer } from "./ILanguageServer";
import ServerOptions from "./serverOptions";

/**
 * This starts basicly the Dafny language server and has been extracted from the extension.ts ("Main").
 * It does also provide command registration for "restart language server".
 */
export class ServerInitializer implements ILanguageServer {
  private languageServer: ServerOptions | undefined;
  private languageServerDisposable: vscode.Disposable | undefined;
  private runner: IDafnyRunner;
  private extensionContext: vscode.ExtensionContext;

  constructor(extensionContext: vscode.ExtensionContext) {
    this.runner = new DafnyRunner();
    this.extensionContext = extensionContext;
  }

  public startLanguageServer(): void {
    this.languageServer = new ServerOptions();
    this.languageServer.trace = Trace.Verbose;

    this.languageServer.onReady().then(() => {
      if (this.languageServer) {
        const provider: IDafnyUiManager = new DafnyUiManager(
          this.extensionContext,
          this.languageServer
        );

        const commands: ICommands = new Commands(
          this.extensionContext,
          this.languageServer,
          provider,
          this.runner
        );
        commands.registerCommands();

        const notifications: INotifications = new Notifications(
          this.languageServer
        );
        notifications.registerNotifications();

        provider.registerEventListener();
      }
    });

    // Push the disposable to the context's subscriptions so that the
    // client can be deactivated on extension deactivation
    this.languageServerDisposable = this.languageServer.start();
    this.extensionContext.subscriptions.push(this.languageServerDisposable);
  }

  // This function is not registered in commands.ts since it has a higher cohesion here
  public registerServerRestartCommand(): void {
    this.extensionContext.subscriptions.push(
      vscode.commands.registerCommand(
        CommandStrings.RestartServer,
        async () => {
          vscode.window.showErrorMessage(Error.ServerStopped);
          await this.languageServer?.stop();
          this.languageServerDisposable = this.languageServerDisposable?.dispose();

          vscode.window.showInformationMessage(Information.StartingServer);
          this.startLanguageServer();
        }
      )
    );
  }
}
