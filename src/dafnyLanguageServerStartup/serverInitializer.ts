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
    this.installLanguageServerIfNotExists()
      .then(() => {
        vscode.window.showInformationMessage(Information.StartingServer);

        this.languageServer = new ServerOptions();
        this.languageServer.trace = Trace.Verbose;

        this.languageServer
          .onReady()
          .then(() => {
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
          })
          .catch((errorStart) => {
            vscode.window.showErrorMessage(
              "Could not start Danfy Language Server. " + errorStart
            );
          });

        // Push the disposable to the context's subscriptions so that the
        // client can be deactivated on extension deactivation
        this.languageServerDisposable = this.languageServer.start();
        this.extensionContext.subscriptions.push(this.languageServerDisposable);
      })
      .catch((errorInstall) => {
        vscode.window.showErrorMessage(
          "Could not install Danfy Language Server. " + errorInstall
        );
      });
  }

  private async stopLanguageServer(): Promise<void> {
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
            this.startLanguageServer();
          });
        }
      )
    );
  }

  // Sent once when server has started (and after every server restart has been triggered)
  private registerServerVersionNotification(): void {
    if (this.languageServer) {
      this.languageServer.onNotification(
        LanguageServerNotification.DafnyLanguageServerVersionReceived,
        (serverversion: string) => {
          this.installLatestLanguageServer(serverversion);
        }
      );
    }
  }

  private async installLanguageServerIfNotExists(): Promise<boolean> {
    const installer: ILanguageServerInstaller = new LanguageServerInstaller();
    if (!installer.anyVersionInstalled()) {
      vscode.window.showInformationMessage(
        "Installing latest Dafny Language Server..."
      );
      return await installer.installLatestVersion();
    }
    return Promise.resolve(true);
  }

  private installLatestLanguageServer(serverversion: string): void {
    const installer: ILanguageServerInstaller = new LanguageServerInstaller();
    installer
      .latestVersionInstalled(serverversion)
      .then((latestVersionInstalled: boolean) => {
        if (!latestVersionInstalled) {
          this.stopLanguageServer().then(() => {
            vscode.window.showErrorMessage(Error.ServerStopped);

            vscode.window.showInformationMessage(
              "Updating Dafny Language Server to latest version..."
            );
            installer.installLatestVersion().then(() => {
              this.startLanguageServer();
            });
          });
        }
      });
  }
}
