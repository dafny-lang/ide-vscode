"use strict";
import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient";
import { TextDocumentItem } from "vscode-languageserver-types";
import { CounterModelProvider } from "./ui/counterModelProvider";
import { Statusbar } from "./ui/statusbar";
import { Config, EnvironmentConfig } from "./stringRessources/commands";
import { LanguageServerNotification } from "./stringRessources/languageServer";

/*
* This is kinda the "main manager" for basic instances like statusbar and a filewatcher. 
* Needs to be refactored => 2do 
* Instance is created on server start and passed to many components. 
*/
export class DafnyClientProvider {
    private dafnyStatusbar: Statusbar;
    private counterModelProvider: CounterModelProvider;
    
    // config vars 
    private automaticShowCounterExample: boolean = false; // hmm noch einbauen oder löschen? 

    constructor(public vsCodeContext: vscode.ExtensionContext, public languageServer: LanguageClient) {
        this.loadConfig();
        this.dafnyStatusbar = new Statusbar(this.languageServer);
        this.counterModelProvider = new CounterModelProvider();
    }

    public registerEventListener(): void {
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                this.activeDocumentTabChanged(); 
            }
        }, this);

        vscode.workspace.onDidChangeTextDocument((arg) => this.docChanged(arg), this);
        vscode.workspace.onDidChangeTextDocument( () => this.counterModelProvider.hideCounterModel(), this);

        vscode.workspace.onDidCloseTextDocument(this.counterModelProvider.hideCounterModel, this);
        vscode.workspace.onDidChangeConfiguration(this.loadConfig, this);
    }

    private loadConfig() {
        // some config vars are loaded all over the place tho => 2do 
        const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(EnvironmentConfig.Dafny);
        this.automaticShowCounterExample = config.get<boolean>(Config.AutomaticShowCounterExample)!;
    }

    // hmm... 2do... counter model is spread all over the place. no good
    public getCounterModelProvider() {
        return this.counterModelProvider;
    }

    private sendDocument(textDocument: vscode.TextDocument, type: string): void {
        if (textDocument !== null && textDocument.languageId === EnvironmentConfig.Dafny) {
            const tditem = JSON.stringify(TextDocumentItem.create(textDocument.uri.toString(),
                textDocument.languageId, textDocument.version, textDocument.getText()));
            this.languageServer.sendNotification(type, tditem);
        }
    }

    private activeDocumentTabChanged() {
        vscode.window.showWarningMessage("Troll")
        this.dafnyStatusbar.update(); // not working... force update :/ 
        this.counterModelProvider.hideCounterModel(); 

    }

    private docChanged(change: vscode.TextDocumentChangeEvent): void {
        if (change !== null && change.document !== null && change.document.languageId === EnvironmentConfig.Dafny) {
            const docName: string = change.document.fileName;
            vscode.window.showWarningMessage("Troll2 "+docName)
        }
    }
}
