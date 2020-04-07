"use strict";
import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient";

import { LanguageServerNotification } from "../stringRessources/languageServer";
import { StatusbarStrings } from "../stringRessources/messages";
import { EnvironmentConfig } from "../stringRessources/commands";
import { DafnyFileChecker } from "./dafnyFileChecker";

/**
 * This component adds additional information to the status bare like
 * if the Dafny file is valid or not and how many errors were found. 
 * It shows also the information if the server has been startet and the Dafny version received from the server. 
 * There exists only one instance of this component (created in the dafnyUiManager). 
 */
export class Statusbar {
    private dafnyerrors: { [docPathName: string]: number } = {}; 
    private dafnyversion: string | undefined;
    private activeDocument: vscode.Uri | undefined;
    private serverStatusBar: vscode.StatusBarItem;
    private currentDocumentStatucBar: vscode.StatusBarItem;

    constructor(languageServer: LanguageClient) {
        const priority: number = 10; 
        this.currentDocumentStatucBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, priority);
        this.serverStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, priority);

        // Sent once when server has started (and after every server restart has been triggered)
        languageServer.onNotification(LanguageServerNotification.ServerStarted, (serverversion: string) => {
            vscode.window.showInformationMessage(StatusbarStrings.Started)
            this.dafnyversion = serverversion;
            this.update();
        });

        // Set from the verifiaction service; this gets triggered by every server side buffer update 
        languageServer.onNotification(LanguageServerNotification.ActiveVerifiyingDocument, (activeDocument: vscode.Uri) => {
            this.activeDocument = activeDocument;
            this.update();
        });

        // This update gets called by server-side events when new dafny file error informations are available 
        languageServer.onNotification(
            LanguageServerNotification.UpdateStatusbar,
            (countedErrors: number) => {
                this.dafnyerrors[DafnyFileChecker.getActiveFileName()] = countedErrors; 
                this.update();
            }
        );
    }

    public update(): void {
        const editor = vscode.window.activeTextEditor;
        const editorsOpen: number = vscode.window.visibleTextEditors.length;
        if (!editor || editorsOpen === 0 || editor.document.languageId !== EnvironmentConfig.Dafny) {
            this.hide();
        } else {
            const errors = this.dafnyerrors[DafnyFileChecker.getActiveFileName()]; 
            this.currentDocumentStatucBar.text = (this.dafnyerrors && errors > 0)
                ? `${StatusbarStrings.NotVerified} - ${StatusbarStrings.Errors}: ${errors}`
                : StatusbarStrings.Verified;

            if (this.dafnyversion) {
                this.serverStatusBar.text = `${StatusbarStrings.DafnyVersion}: ${this.dafnyversion.trim()}`;
                this.serverStatusBar.tooltip = this.activeDocument 
                    ? `${StatusbarStrings.CurrentDocument}: ${this.activeDocument.toString()}` 
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
