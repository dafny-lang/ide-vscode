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
  LanguageServerNotification,
} from "../stringRessources/_StringRessourcesModule";

import { ILanguageServer } from "./ILanguageServer";
import ServerOptions from "./serverOptions";
import { ILanguageServerInstaller } from "./ILanguageServerInstaller";
import { LanguageServerInstaller } from "./languageServerInstaller";

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
    this.getLanguageServerIfNotExists();

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
        this.registerServerVersionNotification();
      }
    });

    // Push the disposable to the context's subscriptions so that the
    // client can be deactivated on extension deactivation
    this.languageServerDisposable = this.languageServer.start();
    this.extensionContext.subscriptions.push(this.languageServerDisposable);
  }

  private async stopLanguageServer() {
    await this.languageServer?.stop();
    this.languageServerDisposable = this.languageServerDisposable?.dispose();
  }

  // This function is not registered in commands.ts since it has a higher cohesion here
  public registerServerRestartCommand(): void {
    this.extensionContext.subscriptions.push(
      vscode.commands.registerCommand(
        CommandStrings.RestartServer,
        async () => {
          this.stopLanguageServer().then(() => {
            vscode.window.showErrorMessage(Error.ServerStopped);
            vscode.window.showInformationMessage(Information.StartingServer);
            this.startLanguageServer();
          });
        }
      )
    );
  }

  private registerServerVersionNotification(): void {
    if (this.languageServer) {
      this.languageServer.onNotification(
        LanguageServerNotification.ServerStarted,
        (serverversion: string) => {
          this.installLatestLanguageServer(serverversion);
        }
      );
    }
  }

  private getLanguageServerIfNotExists(): void {
    const installer: ILanguageServerInstaller = new LanguageServerInstaller();
    if (!installer.anyVersionInstalled()) {
      installer.installLatestVersion();
    }
  }

  private installLatestLanguageServer(serverversion: string): void {
    const installer: ILanguageServerInstaller = new LanguageServerInstaller();
    if (!installer.latestVersionInstalled(serverversion)) {
      this.stopLanguageServer().then(() => {
        vscode.window.showErrorMessage(Error.ServerStopped);

        installer.installLatestVersion().then((newVersion: string) => {
          vscode.window.showInformationMessage(
            Information.StartingServer + newVersion
          );
          this.startLanguageServer();
        });
      });
    }
  }
}
