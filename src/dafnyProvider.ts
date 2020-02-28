"use strict";
import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient";
import { TextDocumentItem } from "vscode-languageserver-types";
import { Context } from "./context";
import { CounterModelProvider } from "./counterModelProvider";
import { Statusbar } from "./dafnyStatusbar";
import { Config, EnvironmentConfig, LanguageServerNotification } from "./stringRessources";

export class DafnyClientProvider {
    public dafnyStatusbar: Statusbar;
    private docChangeTimers: { [docPathName: string]: NodeJS.Timer } = {};
    private docChangeVerify: boolean = false;
    private docChangeDelay: number = 0;
    private automaticShowCounterExample: boolean = false;
    private subscriptions: vscode.Disposable[] = [];

    private counterModelProvider: CounterModelProvider;
    private context: Context;

    constructor(public vsCodeContext: vscode.ExtensionContext, public languageServer: LanguageClient) {
        this.loadConfig();
        this.context = new Context();
        this.dafnyStatusbar = new Statusbar(this.languageServer);
        this.counterModelProvider = new CounterModelProvider();

        languageServer.onNotification(LanguageServerNotification.UpdateStatusbar,
            (counter: number) => {
                this.dafnyStatusbar.update();
                this.dafnyStatusbar.updateStatusbarText(counter);
            });
    }

    public activate(subs: vscode.Disposable[]): void {
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                this.dafnyStatusbar.update();
            }
        }, this);
        this.subscriptions = subs;
        vscode.workspace.onDidOpenTextDocument(this.doVerify, this);

        if (this.docChangeVerify) {
            vscode.workspace.onDidChangeTextDocument(this.docChanged, this);
        }
        vscode.workspace.onDidSaveTextDocument(this.doVerify, this);
        vscode.workspace.onDidCloseTextDocument(this.counterModelProvider.hideCounterModel, this);
        vscode.workspace.onDidChangeConfiguration(this.loadConfig, this);

        if (Context.unitTest) { Context.unitTest.activated(); }
    }

    public dispose(): void {
        this.dafnyStatusbar.hide();
        if (this.subscriptions && this.subscriptions.length > 0) {
            for (const subscription of this.subscriptions) {
                subscription.dispose();
            }
        }
    }

    private loadConfig() {
        const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(EnvironmentConfig.Dafny);
        this.docChangeVerify = config.get<boolean>(Config.AutomaticVerification)!;
        this.docChangeDelay = config.get<number>(Config.AutomaticVerificationDelay)!;
        this.automaticShowCounterExample = config.get<boolean>(Config.AutomaticShowCounterExample)!;
    }

    private doVerify(textDocument: vscode.TextDocument): void {
        this.counterModelProvider.hideCounterModel();
        console.log("Try to verify... ")
        if (this.automaticShowCounterExample) {
            this.sendDocument(textDocument, LanguageServerNotification.CounterExample);
        } else {
            this.sendDocument(textDocument, LanguageServerNotification.Verify);
        }

    }

    public getCounterModelProvider() {
        return this.counterModelProvider;
    }

    private sendDocument(textDocument: vscode.TextDocument, type: string): void {
        if (textDocument !== null && textDocument.languageId === EnvironmentConfig.Dafny) {
            this.context.localQueue.add(textDocument.uri.toString());
            const tditem = JSON.stringify(TextDocumentItem.create(textDocument.uri.toString(),
                textDocument.languageId, textDocument.version, textDocument.getText()));
            this.languageServer.sendNotification(type, tditem);
        }
    }

    private docChanged(change: vscode.TextDocumentChangeEvent): void {
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
