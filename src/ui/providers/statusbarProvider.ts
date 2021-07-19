"use strict";
import {
  window,
  workspace,
  Uri,
  StatusBarItem,
  StatusBarAlignment,
  LanguageClient,
} from "../../ideApi/_IdeApi";
import { CompilationStatus } from "../../stringResources/languageServer";
import {
  LanguageServerNotification,
  StatusbarStrings,
  EnvironmentConfig,
} from "../../stringResources/_StringResourcesModule";

import { IStatusbarProvider } from "./IStatusbarProvider";

const COMPILATION_STATUS_MESSAGE_MAPPINGS = {
  [CompilationStatus.ParsingFailed]: StatusbarStrings.ParsingFailed,
  [CompilationStatus.ResolutionFailed]: StatusbarStrings.ResolutionFailed,
  [CompilationStatus.CompilationSucceeded]: StatusbarStrings.CompilationSucceeded,
  [CompilationStatus.VerificationStarted]: StatusbarStrings.Verifying,
  [CompilationStatus.VerificationSucceeded]: StatusbarStrings.VerificationSucceeded,
  [CompilationStatus.VerificationFailed]: StatusbarStrings.VerificationFailed
};

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

    // Sent when there are any changes to the compilation status of a document.
    languageServer.onNotification(
      LanguageServerNotification.CompilationStatus,
      ({ uri, status }: { uri: string, status: CompilationStatus }) => {
        this.verificationMessage[Uri.parse(uri).toString()] =
          COMPILATION_STATUS_MESSAGE_MAPPINGS[status];
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
