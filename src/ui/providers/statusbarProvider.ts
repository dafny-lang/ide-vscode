"use strict";
import {
  window,
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

import { DafnyFileChecker } from "../dafnyFileChecker";
import { IStatusbarProvider } from "./IStatusbarProvider";

/**
 * This component adds additional information to the status bar like
 * if the Dafny file is valid or not and how many errors were found.
 * It also shows the information if the server has been started and the Dafny version received from the server.
 */
export class StatusbarProvider implements IStatusbarProvider {
  private dafnyerrors: { [docPathName: string]: number } = {};
  private dafnyLanguageServerVersion: string | undefined;
  private activeDocument: Uri | undefined;
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
        window.showInformationMessage(StatusbarStrings.Started);
        this.dafnyLanguageServerVersion = serverversion;
        this.update();
      }
    );

    // Set from the verifiaction service; this gets triggered by every server side Dafny file buffer update
    languageServer.onNotification(
      LanguageServerNotification.ActiveVerifiyingDocument,
      (activeDocument: Uri) => {
        this.activeDocument = activeDocument;
        this.update();
      }
    );

    // This update gets called by server-side events when new Dafny file error informations are available
    languageServer.onNotification(
      LanguageServerNotification.UpdateStatusbar,
      (countedErrors: number) => {
        this.dafnyerrors[DafnyFileChecker.getActiveFileName()] = countedErrors;
        this.update();
      }
    );
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
      const errors = this.dafnyerrors[DafnyFileChecker.getActiveFileName()];
      this.currentDocumentStatucBar.text =
        this.dafnyerrors && errors > 0
          ? `${StatusbarStrings.NotVerified} - ${StatusbarStrings.Errors}: ${errors}`
          : StatusbarStrings.Verified;

      if (this.dafnyLanguageServerVersion) {
        this.serverStatusBar.text = `${
          StatusbarStrings.DafnyVersion
        }: ${this.dafnyLanguageServerVersion.trim()}`;
        this.serverStatusBar.tooltip = this.activeDocument
          ? `${
              StatusbarStrings.CurrentDocument
            }: ${this.activeDocument.toString()}`
          : StatusbarStrings.NoDocumentSelected;
      } else {
        this.currentDocumentStatucBar.text = StatusbarStrings.Pending;
      }
      this.show();
    }
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
