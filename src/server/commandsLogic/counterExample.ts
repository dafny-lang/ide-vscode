"use strict";
import * as vscode from "vscode";
import { LanguageClient, ResponseError } from "vscode-languageclient";

import { DafnyUiManager } from "../../ui/dafnyUiManager";
import { LanguageServerRequest } from "../../stringRessources/languageServer";
import { Error } from "../../stringRessources/messages";
import { ICounterExamples } from "../../typeInterfaces/ICounterExampleResult";
import { ICounterExampleArguments } from "../../typeInterfaces/ICounterExampleArguments";

/*
* Provides Counter Example provided by the Dafny language server. 
*/
export class CounterExample {
    private static timeout: NodeJS.Timer;
    private static readonly timeoutDuration: number = 500; //ms
     
    static showCounterExample(languageServer: LanguageClient, provider: DafnyUiManager, autoTriggered: Boolean = false) {
        if (!vscode.window.activeTextEditor) {
            return;
        }
        vscode.window.activeTextEditor.document.save();
        
        const arg: ICounterExampleArguments = { 
            DafnyFile: vscode.window.activeTextEditor.document.fileName 
        };

        // This timeout makes sure, that max 2 server requests each second were sent. 
        // Otherwise - if a user would tipping verry fast - there would be a huge, unnecessary request overhead.
        clearTimeout( this.timeout )
        this.timeout = setTimeout(function() {
            languageServer.sendRequest<ICounterExamples>(LanguageServerRequest.CounterExample, arg)
            .then((allCounterExamples: ICounterExamples) => {
                provider.getCounterModelProvider().showCounterModel(allCounterExamples, autoTriggered);
            }, (error: ResponseError<void>) => {
                vscode.window.showErrorMessage(`${Error.CanNotGetCounterExample}: ${error.message}`);
            })
        }, autoTriggered ? this.timeoutDuration : 1);
    }

    static hideCounterExample(provider: DafnyUiManager) {
        provider.getCounterModelProvider().hideCounterModel();
    }
}