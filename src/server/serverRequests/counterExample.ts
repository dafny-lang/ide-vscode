"use strict";
import * as vscode from "vscode";
import { LanguageClient, ResponseError } from "vscode-languageclient";

import { LanguageServerRequest } from "../../stringRessources/languageServer";
import { Error } from "../../stringRessources/messages";
import { ICounterExamples } from "../../typeInterfaces/ICounterExampleResult";
import { ICounterExampleArguments } from "../../typeInterfaces/ICounterExampleArguments";
import { CounterModelProvider } from "../../ui/counterModelProvider";

/*
* Provides Counter Example provided by the Dafny language server. 
*/
export class CounterExample {
    private static timeout: NodeJS.Timer;
    private static readonly timeoutDuration: number = 500; //ms
     
    static createCounterExample(languageServer: LanguageClient, provider: CounterModelProvider, autoTriggered: Boolean = false) {
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
                provider.showCounterModel(allCounterExamples, autoTriggered);
            }, (error: ResponseError<void>) => {
                vscode.window.showErrorMessage(`${Error.CanNotGetCounterExample}: ${error.message}`);
            })
        }, autoTriggered ? this.timeoutDuration : 1);
    }
}