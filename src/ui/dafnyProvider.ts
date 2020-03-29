"use strict";
import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient";
import { CounterModelProvider } from "./counterModelProvider";
import { Statusbar } from "./statusbar";
import { EnvironmentConfig } from "../stringRessources/commands";

/*
* This is kinda the "main ui manager" for basic instances like statusbar and a filewatcher. 
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
    }

    public getCounterModelProvider() {
        return this.counterModelProvider;
    }

    private activeDocumentTabChanged(editor: vscode.TextEditor | undefined) {
        this.triggerUIupdates(editor);
    }

    private openDocumentChanged(change: vscode.TextDocumentChangeEvent): void {
        this.triggerUIupdates(change);
    }

    private triggerUIupdates(documentreference: vscode.TextEditor | vscode.TextDocumentChangeEvent | undefined) : void {
        if (documentreference && this.isDafnyFile(documentreference.document)) {
            this.dafnyStatusbar.update();
            this.counterModelProvider.update(this.languageServer, this); 
        }
    }

    private isDafnyFile(document: vscode.TextDocument) {
        return document !== null && document.languageId === EnvironmentConfig.Dafny; 
    }
}
