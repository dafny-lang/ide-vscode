"use strict";
import * as vscode from "vscode";
import { ICounterExamples, ICounterExample } from "../typeInterfaces/ICounterExampleResult";
import { Warning } from "../stringRessources/messages";
import { CounterExample } from "../server/commandsLogic/counterExample";
import { LanguageClient } from "vscode-languageclient";
import { DafnyProvider } from "../dafnyProvider";

export class CounterModelProvider {
    private fileHasVisibleCounterModel: { [docPathName: string]: boolean } = {}; 
    private decorators: { [docPathName: string]: vscode.TextEditorDecorationType } = {};
    private displayOptions: vscode.DecorationRenderOptions = {
        // 2do
        dark: {
            after: {
                backgroundColor: "#0300ad",
                color: "#cccccc",
                margin: "0 0 0 30px",
            },
        },
        light: {
            after: {
                backgroundColor: "#161616",
                color: "#cccccc",
            },
        },
    };

    public hideCounterModel(): void {
        if (this.decorators[this.getActiveFileName()]) {
            this.decorators[this.getActiveFileName()].dispose();
            this.fileHasVisibleCounterModel[this.getActiveFileName()] = false; 
        }
    }

    public showCounterModel(allCounterExamples: ICounterExamples): void {
        const editor: vscode.TextEditor = vscode.window.activeTextEditor!;
        const arrayOfDecorations: vscode.DecorationOptions[] = [];
        let hasReferences: boolean = false;

        for (let i = 0; i < allCounterExamples.counterExamples.length; i++) {
            let currentCounterExample: ICounterExample = allCounterExamples.counterExamples[i];
            let line = currentCounterExample.line;
            let col = currentCounterExample.col;
            if (line < 0) { return }
            
            let shownText = '';
            for (let [key, value] of Object.entries(currentCounterExample.variables)) {
                shownText += `${key} = ${value}; `;

                if (value == "[Object Reference]") {
                    hasReferences = true;
                }
            }
            const renderOptions: vscode.DecorationRenderOptions = {
                after: {
                    contentText: shownText,
                },
            };

            let decorator: vscode.DecorationOptions = {
                range: new vscode.Range(new vscode.Position(line, col + 1), new vscode.Position(line, Number.MAX_VALUE)),
                renderOptions,
            };

            arrayOfDecorations.push(decorator);
        }
        
        if (hasReferences) {
            vscode.window.showWarningMessage(Warning.ReferencesInCounterExample)
        }

        if (allCounterExamples.counterExamples.length == 0) {
            vscode.window.showWarningMessage(Warning.NoCounterExamples);
        }

        this.fileHasVisibleCounterModel[this.getActiveFileName()] = true; 
        const shownTextTemplate = this.getDisplay();
        this.decorators[this.getActiveFileName()] = shownTextTemplate;
        editor.setDecorations(shownTextTemplate, arrayOfDecorations);
    }

    public update(languageServer: LanguageClient, provider: DafnyProvider): void {
        if(this.fileHasVisibleCounterModel[this.getActiveFileName()] === true){
            this.hideCounterModel(); 
            CounterExample.showCounterExample(languageServer, provider);
        } 
    }

    private getDisplay(): vscode.TextEditorDecorationType {
        return vscode.window.createTextEditorDecorationType(this.displayOptions);
    }

    private getActiveFileName(): string {
        return vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.document?.uri?.toString() 
            : "";
    }

}
