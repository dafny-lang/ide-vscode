"use strict";
import * as vscode from "vscode";
import { LanguageServerNotification } from "../stringResources/_StringResourcesModule";
import { INotifications } from "./INotifications";
import { LanguageClient } from "vscode-languageclient";

/**
 * VSCode UI Notifications
 * This notifications are triggerable by the server
 * If you need client side notifications, use vscde.window
 */
export class Notifications implements INotifications {
  private languageClient: LanguageClient;

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

  constructor(languageServer: LanguageClient) {
    this.languageClient = languageServer;
  }

  public registerNotifications() {
    for (const notification of this.notifications) {
      this.languageClient.onNotification(
        notification.method,
        notification.handler
      );
    }
  }
}
