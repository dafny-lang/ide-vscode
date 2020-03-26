"use strict";
import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient";

import { DafnyClientProvider } from "../../dafnyProvider";
import { LanguageServerRequest } from "../../stringRessources/languageServer";
// import { ICounterExamples } from "../../typeInterfaces/ICounterExample";

/*
* Provides Counter Example provided by the Dafny language server. 
*/
export class CounterExample {
    static showCounterExample(languageServer: LanguageClient, provider: DafnyClientProvider) {
        if (!vscode.window.activeTextEditor) {
            return;
        }
        vscode.window.activeTextEditor.document.save();
        const arg = { DafnyFile: vscode.window.activeTextEditor.document.fileName }

        languageServer.sendRequest(LanguageServerRequest.CounterExample, arg)
            .then((allCounterExamples: any) => { // 2do  ICounterExamples schluckt er nicht //tom: ich glaub is wegen key-value store, hatte da auch schonmal was versucht... sonst lassen wir das hier halt ausnahmsweise.
                provider.getCounterModelProvider().showCounterModel(allCounterExamples);
            })
    }

    static hideCounterExample(provider: DafnyClientProvider) {
        provider.getCounterModelProvider().hideCounterModel()
    }
}