import * as vscode from "vscode";
import DafnyLanguageServer from "../server/dafnyLanguageClient";
import { LanguageServerNotification } from "../stringRessources/languageServer";

/**
 * VSCode UI Notifications
 * This notifications are triggerable by the server
 * If you need client side notifications, use vscde.window
 */
export default class Notifications {
  private languageServer: DafnyLanguageServer;

  private notifications = [
    {
      method: LanguageServerNotification.Error,
      handler: vscode.window.showErrorMessage,
    },
    {
      method: LanguageServerNotification.Warning,
      handler: vscode.window.showWarningMessage,
    },
    {
      method: LanguageServerNotification.Info,
      handler: vscode.window.showInformationMessage,
    },
  ];

  constructor(languageServer: DafnyLanguageServer) {
    this.languageServer = languageServer;
  }

  public registerNotifications() {
    for (const notification of this.notifications) {
      this.languageServer.onNotification(
        notification.method,
        notification.handler
      );
    }
  }
}
