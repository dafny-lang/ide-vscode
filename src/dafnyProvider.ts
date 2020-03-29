"use strict";
import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient";
import { CounterModelProvider } from "./ui/counterModelProvider";
import { Statusbar } from "./ui/statusbar";
import { EnvironmentConfig } from "./stringRessources/commands";

/*
* This is kinda the "main manager" for basic instances like statusbar and a filewatcher. 
* Instance is created on server start and passed to many components. 
*/
export class DafnyProvider {
    private dafnyStatusbar: Statusbar;
    private counterModelProvider: CounterModelProvider;

    constructor(public vsCodeContext: vscode.ExtensionContext, public languageServer: LanguageClient) {
        this.dafnyStatusbar = new Statusbar(this.languageServer);
        this.counterModelProvider = new CounterModelProvider();
    }

    public registerEventListener(): void {
        vscode.window.onDidChangeActiveTextEditor((editor) => this.activeDocumentTabChanged(editor), this);

        vscode.workspace.onDidChangeTextDocument((arg) => this.openDocumentChanged(arg), this);
        vscode.workspace.onDidCloseTextDocument(this.counterModelProvider.hideCounterModel, this);
    }

    public getCounterModelProvider() {
        return this.counterModelProvider;
    }

    private activeDocumentTabChanged(editor: vscode.TextEditor | undefined) {
        if (editor && this.isDafnyFile(editor.document)) {
            this.dafnyStatusbar.update();
            this.counterModelProvider.hideCounterModel(); 
        }
    }

    private openDocumentChanged(change: vscode.TextDocumentChangeEvent): void {
        this.counterModelProvider.hideCounterModel();
        if (change !== null && this.isDafnyFile(change.document)) {
            //const docName: string = change.document.fileName;
            this.dafnyStatusbar.update();
        }
    }

    private isDafnyFile(document: vscode.TextDocument) {
        return document !== null && document.languageId === EnvironmentConfig.Dafny; 
    }
}
