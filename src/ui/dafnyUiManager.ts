"use strict";
import {
  window,
  workspace,
  LanguageClient,
  TextEditor,
  TextDocumentChangeEvent,
} from "../ideApi/_IdeApi";
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

/**
 * This is the ui manager for basic instances like statusbar and a filewatcher.
 */
export class DafnyUiManager implements IDafnyUiManager {
  private dafnyStatusbar: IStatusbarProvider;
  private counterModelProvider: ICounterModelProvider;
  private codeLensProvider: ICodeLensProvider;

  constructor(public languageServer: LanguageClient) {
    this.dafnyStatusbar = new StatusbarProvider(this.languageServer);
    this.counterModelProvider = new CounterModelProvider();
    this.codeLensProvider = new CodeLensProvider();
  }

  public registerEventListener(): void {
    window.onDidChangeActiveTextEditor(
      (editor) => this.activeDocumentTabChanged(editor),
      this
    );
    workspace.onDidChangeTextDocument(
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

  public disposeUi(): void {
    this.dafnyStatusbar.dispose();
  }

  private activeDocumentTabChanged(editor: TextEditor | undefined) {
    this.triggerUIupdates(editor);
  }

  private openDocumentChanged(change: TextDocumentChangeEvent): void {
    this.triggerUIupdates(change);
  }

  private triggerUIupdates(
    documentreference: TextEditor | TextDocumentChangeEvent | undefined
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
