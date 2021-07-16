"use strict";
import {
  window,
  workspace,
  Uri,
  StatusBarItem,
  StatusBarAlignment,
  LanguageClient,
} from "../../ideApi/_IdeApi";
import {
  LanguageServerNotification,
  StatusbarStrings,
  EnvironmentConfig,
} from "../../stringResources/_StringResourcesModule";

import { IStatusbarProvider } from "./IStatusbarProvider";

/**
 * This component adds additional information to the status bar like
 * if the Dafny file is valid or not and how many errors were found.
 * It also shows the information if the server has been started and the Dafny version received from the server.
 */
export class StatusbarProvider implements IStatusbarProvider {
  private verificationMessage: { [documentUri: string]: string } = {};
  private dafnyLanguageServerVersion: string | undefined;
  private serverStatusBar: StatusBarItem;
  private currentDocumentStatucBar: StatusBarItem;

  constructor(languageServer: LanguageClient) {
    const priority: number = 10;
    this.currentDocumentStatucBar = window.createStatusBarItem(
      StatusBarAlignment.Left,
      priority
    );
    this.serverStatusBar = window.createStatusBarItem(
      StatusBarAlignment.Right,
      priority
    );

    // Sent once when server has started (and after every server restart has been triggered)
    languageServer.onNotification(
      LanguageServerNotification.ServerStarted,
      (serverversion: string) => {
        this.dafnyLanguageServerVersion = serverversion;
        this.update();
      }
    );

    // Sent when the verification of a document started
    languageServer.onNotification(
      LanguageServerNotification.VerificationStarted,
      ({ uri }: { uri: string }) => {
        this.verificationMessage[Uri.parse(uri).toString()] =
          StatusbarStrings.Verifying;
        this.update();
      }
    );

    // Sent when the verification of a document completed
    languageServer.onNotification(
      LanguageServerNotification.VerificationCompleted,
      ({ uri, verified }: { uri: string; verified: boolean }) => {
        this.verificationMessage[Uri.parse(uri).toString()] = verified
          ? StatusbarStrings.Verified
          : StatusbarStrings.NotVerified;
        this.update();
      }
    );

    workspace.onDidChangeTextDocument(event => {
      this.verificationMessage[event.document.uri.toString()] = StatusbarStrings.NotVerified;
    });
  }

  public dispose(): void {
    this.serverStatusBar.dispose();
    this.currentDocumentStatucBar.dispose();
  }

  public update(): void {
    const editor = window.activeTextEditor;
    const editorsOpen: number = window.visibleTextEditors.length;
    if (
      !editor ||
      editorsOpen === 0 ||
      editor.document.languageId !== EnvironmentConfig.Dafny
    ) {
      this.hide();
    } else {
      this.currentDocumentStatucBar.text = this.getVerificationText();
      if (this.dafnyLanguageServerVersion) {
        this.serverStatusBar.text = `${
          StatusbarStrings.DafnyVersion
        }: ${this.dafnyLanguageServerVersion.trim()}`;
      } else {
        this.currentDocumentStatucBar.text = StatusbarStrings.Pending;
      }
      this.show();
    }
  }

  private getVerificationText(): string {
    if (!window.activeTextEditor) {
      return "";
    }
    const activeDocument = window.activeTextEditor?.document.uri.toString();
    return this.verificationMessage[activeDocument] ?? "";
  }

  private hide(): void {
    this.serverStatusBar.hide();
    this.currentDocumentStatucBar.hide();
  }

  private show(): void {
    this.serverStatusBar.show();
    this.currentDocumentStatucBar.show();
  }
}
