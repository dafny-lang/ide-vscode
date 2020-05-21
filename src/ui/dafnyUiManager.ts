"use strict";
import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient";

import {
  ICounterModelProvider,
  CounterModelProvider,
  ICodeLensProvider,
  CodeLensProvider,
  IStatusbarProvider,
  StatusbarProvider,
} from "./providers/_ProvidersModule";

import { IDafnyUiManager } from "./IDafnyUiManager";
import { DafnyFileChecker } from "./dafnyFileChecker";

/*
 * This is kinda the "main ui manager" for basic instances like statusbar and a filewatcher.
 * Instance is created on server start and passed to many components.
 */
export class DafnyUiManager implements IDafnyUiManager {
  private dafnyStatusbar: IStatusbarProvider;
  private counterModelProvider: ICounterModelProvider;
  private codeLensProvider: ICodeLensProvider;

  constructor(
    public vsCodeContext: vscode.ExtensionContext,
    public languageServer: LanguageClient
  ) {
    this.dafnyStatusbar = new StatusbarProvider(this.languageServer);
    this.counterModelProvider = new CounterModelProvider();
    this.codeLensProvider = new CodeLensProvider();
  }

  public registerEventListener(): void {
    vscode.window.onDidChangeActiveTextEditor(
      (editor) => this.activeDocumentTabChanged(editor),
      this
    );
    vscode.workspace.onDidChangeTextDocument(
      (arg) => this.openDocumentChanged(arg),
      this
    );
  }

  public getCounterModelProvider(): ICounterModelProvider {
    return this.counterModelProvider;
  }

  public getCodeLensProvider(): ICodeLensProvider {
    return this.codeLensProvider;
  }

  private activeDocumentTabChanged(editor: vscode.TextEditor | undefined) {
    this.triggerUIupdates(editor);
  }

  private openDocumentChanged(change: vscode.TextDocumentChangeEvent): void {
    this.triggerUIupdates(change);
  }

  private triggerUIupdates(
    documentreference:
      | vscode.TextEditor
      | vscode.TextDocumentChangeEvent
      | undefined
  ): void {
    if (
      documentreference &&
      DafnyFileChecker.isDafnyFile(documentreference.document)
    ) {
      this.dafnyStatusbar.update();
      this.counterModelProvider.update(this.languageServer);
    }
  }
}
