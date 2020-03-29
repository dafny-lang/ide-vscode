"use strict";
import * as vscode from "vscode";
import { ICounterExamples, ICounterExample } from "../typeInterfaces/ICounterExampleResult";
import { Warning } from "../stringRessources/messages";
import { CounterExample } from "../server/commandsLogic/counterExample";
import { LanguageClient } from "vscode-languageclient";
import { DafnyUiManager } from "./dafnyUiManager";
import { EnvironmentConfig } from "../stringRessources/commands";

export class CounterModelProvider {
    private fileHasVisibleCounterModel: { [docPathName: string]: boolean } = {}; 
    private decorators: { [docPathName: string]: vscode.TextEditorDecorationType } = {};

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

    public update(languageServer: LanguageClient, provider: DafnyUiManager): void {
        if(this.fileHasVisibleCounterModel[this.getActiveFileName()] === true){
            this.hideCounterModel(); 
            CounterExample.showCounterExample(languageServer, provider);
        } 
    }

    private getDisplay(): vscode.TextEditorDecorationType {
        const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(EnvironmentConfig.Dafny);
        const customOptions: {backgroundColor: string, fontColor: string } | undefined = config.get("colorCounterExamples");

        // not realy optimized yet since it loads every time the config file
        const displayOptions: vscode.DecorationRenderOptions = {
            dark: {
                after: {
                    backgroundColor: customOptions?.backgroundColor || "#0d47a1",
                    color: customOptions?.fontColor || "#e3f2fd",
                    margin: "0 0 0 30px",
                },
            },
            light: {
                after: {
                    backgroundColor: customOptions?.backgroundColor || "#bbdefb",
                    color: customOptions?.fontColor || "#102027",
                    margin: "0 0 0 30px",
                },
            },
        };
        
        return vscode.window.createTextEditorDecorationType(displayOptions);
    }

    private getActiveFileName(): string {
        return vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.document?.uri?.toString() 
            : "";
    }

}
