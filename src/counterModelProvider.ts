"use strict";

import * as vscode from "vscode";

export class CounterModelProvider {

    private decorators: { [docPathName: string]: vscode.TextEditorDecorationType } = {};

    public hideCounterModel(): void {
        if (this.decorators[this.getActiveFileName()]) {
            this.decorators[this.getActiveFileName()].dispose();
        }
    }

    public showCounterModel(allCounterExamples: any): void {
        const editor: vscode.TextEditor = vscode.window.activeTextEditor!;
        let arrayOfDecorations: vscode.DecorationOptions[] = []

        for (let i = 0; i < allCounterExamples.counterExamples.length; i++) {

            let currentCounterExample: any = allCounterExamples.counterExamples[i];
            let line = currentCounterExample.line - 1;
            let col = currentCounterExample.col;
            if (line < 0) { return }

            let shownText = "";
            for (let [key, value] of Object.entries(currentCounterExample.variables)) {
                shownText += key + " = " + value + "; ";
            }

            const renderOptions: vscode.DecorationRenderOptions = {
                after: {
                    contentText: shownText,
                },
            };

            let decorator: vscode.DecorationOptions = {
                range: new vscode.Range(new vscode.Position(line, col), new vscode.Position(line, Number.MAX_VALUE)),
                renderOptions,
            };

            arrayOfDecorations.push(decorator);
        }

        const shownTextTemplate = this.getDisplay();
        this.decorators[this.getActiveFileName()] = shownTextTemplate;
        editor.setDecorations(shownTextTemplate, arrayOfDecorations);
    }

    private getDisplay(): vscode.TextEditorDecorationType {
        return vscode.window.createTextEditorDecorationType({
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
        })
    }

    private getActiveFileName(): string {
        if (!vscode.window.activeTextEditor) return "";
        return vscode.window.activeTextEditor.document.uri.toString();
    }

}
