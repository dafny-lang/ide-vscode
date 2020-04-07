"use strict";
import * as vscode from "vscode";
import { ICounterExamples, ICounterExample } from "../typeInterfaces/ICounterExampleResult";
import { Warning } from "../stringRessources/messages";
import { CounterExample } from "../server/commandsLogic/counterExample";
import { LanguageClient } from "vscode-languageclient";
import { DafnyUiManager } from "./dafnyUiManager";
import { EnvironmentConfig } from "../stringRessources/commands";
import { DafnyFileChecker } from "./dafnyFileChecker";

export class CounterModelProvider {
    private fileHasVisibleCounterModel: { [docPathName: string]: boolean } = {}; 
    private decorators: { [docPathName: string]: vscode.TextEditorDecorationType } = {};
    private displayOptions: vscode.DecorationRenderOptions = {};
    private readonly defaultDarkBackgroundColor: string = "#0d47a1";
    private readonly defaultDarkFontColor = "#e3f2fd";
    private readonly defaultLightBackgroundColor = "#bbdefb";
    private readonly defaultLightFontColor = "#102027";
    private readonly defaultMargin = "0 0 0 30px";

    constructor() {
        this.loadDisplayOptions(); 
        vscode.workspace.onDidChangeConfiguration(this.loadDisplayOptions, this);
    }

    public hideCounterModel(): void {
        if (this.decorators[DafnyFileChecker.getActiveFileName()]) {
            this.decorators[DafnyFileChecker.getActiveFileName()].dispose();
            this.fileHasVisibleCounterModel[DafnyFileChecker.getActiveFileName()] = false; 
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

        this.fileHasVisibleCounterModel[DafnyFileChecker.getActiveFileName()] = true; 
        const shownTextTemplate = this.getDisplay();
        this.decorators[DafnyFileChecker.getActiveFileName()] = shownTextTemplate;
        editor.setDecorations(shownTextTemplate, arrayOfDecorations);
    }

    public update(languageServer: LanguageClient, provider: DafnyUiManager): void {
        if(this.fileHasVisibleCounterModel[DafnyFileChecker.getActiveFileName()] === true){
            this.hideCounterModel(); 
            CounterExample.showCounterExample(languageServer, provider);
        } 
    }

    private getDisplay(): vscode.TextEditorDecorationType {
        return vscode.window.createTextEditorDecorationType(this.displayOptions);
    }

    private loadDisplayOptions(): void {
        const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(EnvironmentConfig.Dafny);
        const customOptions: {backgroundColor: string, fontColor: string } | undefined = config.get("colorCounterExamples");

        this.displayOptions = {
            dark: {
                after: {
                    backgroundColor: customOptions?.backgroundColor || this.defaultDarkBackgroundColor,
                    color: customOptions?.fontColor || this.defaultDarkFontColor,
                    margin: this.defaultMargin,
                },
            },
            light: {
                after: {
                    backgroundColor: customOptions?.backgroundColor || this.defaultLightBackgroundColor,
                    color: customOptions?.fontColor || this.defaultLightFontColor,
                    margin: this.defaultMargin,
                },
            },
        };
    }
}
