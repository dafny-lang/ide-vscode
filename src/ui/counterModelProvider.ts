"use strict";
import * as vscode from "vscode";
import { ICounterExamples, ICounterExample } from "../typeInterfaces/ICounterExample";
import { Warning } from "../stringRessources/messages";

export class CounterModelProvider {
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
        }
    }

    public showCounterModel(allCounterExamples: ICounterExamples): void {
        const editor: vscode.TextEditor = vscode.window.activeTextEditor!;
        let arrayOfDecorations: vscode.DecorationOptions[] = []
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

        const shownTextTemplate = this.getDisplay();
        this.decorators[this.getActiveFileName()] = shownTextTemplate;
        editor.setDecorations(shownTextTemplate, arrayOfDecorations);
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
