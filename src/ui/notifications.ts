"use strict";
import { window, LanguageClient } from "../ideApi/_IdeApi";
import { LanguageServerNotification } from "../stringResources/_StringResourcesModule";
import { INotifications } from "./INotifications";

/**
 * Registers notifications that can are triggerable by the server.
 */
export class Notifications implements INotifications {
  private languageClient: LanguageClient;

  private notifications = [
    {
      method: LanguageServerNotification.Error,
      handler: window.showErrorMessage,
    },
    {
      method: LanguageServerNotification.Warning,
      handler: window.showWarningMessage,
    },
    {
      method: LanguageServerNotification.Info,
      handler: window.showInformationMessage,
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
