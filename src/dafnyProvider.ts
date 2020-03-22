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
    private docChangeVerify: boolean = false;
    private docChangeDelay: number = 0;
    private automaticShowCounterExample: boolean = false;

    // some update verification arrays? useful or delete 
    private docChangeTimers: { [docPathName: string]: NodeJS.Timer } = {};

    constructor(public vsCodeContext: vscode.ExtensionContext, public languageServer: LanguageClient) {
        this.loadConfig();
        this.dafnyStatusbar = new Statusbar(this.languageServer);
        this.counterModelProvider = new CounterModelProvider();
    }

    public activate(): void {
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                this.dafnyStatusbar.update();
            }
        }, this);
        vscode.workspace.onDidOpenTextDocument(this.doVerify, this);

        if (this.docChangeVerify) {
            vscode.workspace.onDidChangeTextDocument(this.docChanged, this);
        } else {
           // vscode.workspace.onDidChangeTextDocument((arg) => this.docChanged(arg), this);
           // 2do
           vscode.workspace.onDidChangeTextDocument( () => this.counterModelProvider.hideCounterModel(), this);
        }
        // vscode.workspace.onDidChangeTextDocument( () => this.counterModelProvider.hideCounterModel());

        
        vscode.workspace.onDidSaveTextDocument(this.doVerify, this);
        vscode.workspace.onDidCloseTextDocument(this.counterModelProvider.hideCounterModel, this);
        vscode.workspace.onDidChangeConfiguration(this.loadConfig, this);
    }

    private loadConfig() {
        // some config vars are loaded all over the place tho => 2do 
        const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(EnvironmentConfig.Dafny);
        this.docChangeVerify = config.get<boolean>(Config.AutomaticVerification)!;
        this.docChangeDelay = config.get<number>(Config.AutomaticVerificationDelay)!;
        this.automaticShowCounterExample = config.get<boolean>(Config.AutomaticShowCounterExample)!;
    }

    private doVerify(textDocument: vscode.TextDocument): void {
        this.counterModelProvider.hideCounterModel();
        if (this.automaticShowCounterExample) {
            this.sendDocument(textDocument, LanguageServerNotification.CounterExample);
        } else {
            this.sendDocument(textDocument, LanguageServerNotification.Verify);
        }

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

    // 2do mby useful || delete
    private docChanged(change: vscode.TextDocumentChangeEvent): void {
        // gets not triggered at all... why? 
        this.counterModelProvider.hideCounterModel(); 

        if (change !== null && change.document !== null && change.document.languageId === EnvironmentConfig.Dafny) {
            const docName: string = change.document.fileName;
            if (this.docChangeTimers[docName]) {
                clearTimeout(this.docChangeTimers[docName]);
            }
            this.docChangeTimers[docName] = setTimeout(() => {
                this.doVerify(change.document);
            }, this.docChangeDelay);
        }
    }
}
