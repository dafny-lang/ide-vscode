"use strict";
import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient";

import { DafnyUiManager } from "./dafnyUiManager";
import { DafnyRunner } from "../localExecutionHelpers/dafnyRunner";
import { Compile } from "../server/commandsLogic/compile";
import { CounterExample } from "../server/commandsLogic/counterExample";
import { CommandStrings } from "../stringRessources/commands";

/**
 * Registers commands for VSCode UI. Actual logic is contained in /server/commandsLogic/<feature> 
 * to keep this file as simple as possible.
 * Only register UI commands in this file and delgate logic to a command-class-file.
 */
export default class Commands {
    private extensionContext: vscode.ExtensionContext;
    private languageServer: LanguageClient;
    private provider: DafnyUiManager;
    private runner: DafnyRunner;

    private commands = [
        { name: CommandStrings.Compile, callback: () => Compile.doCompile(this.languageServer, this.runner, false)},
        { name: CommandStrings.CompileCustomArgs, callback: () => Compile.doCompile(this.languageServer, this.runner, false, true)},
        { name: CommandStrings.CompileAndRun, callback: () => Compile.doCompile(this.languageServer, this.runner, true)},
        { name: CommandStrings.ShowCounterExample, callback: () => CounterExample.showCounterExample(this.languageServer, this.provider) },
        { name: CommandStrings.HideCounterExample, callback: () => CounterExample.hideCounterExample(this.provider) },
        /* Please note that the command "RestartServer" is registered in dafnyLanguageServer for a higher cohesion */ 
        
        {   // 2do what is this?? ticket#9042
            name: CommandStrings.EditText,
            callback: (uri: string, version: number, edits: vscode.TextEdit[]) => this.applyTextEdits(uri, version, edits),
        },
    ];

    constructor(extensionContext: vscode.ExtensionContext, languageServer: LanguageClient, provider: DafnyUiManager, runner: DafnyRunner) {
        this.languageServer = languageServer;
        this.provider = provider;
        this.runner = runner;
        this.extensionContext = extensionContext;
    }

    public registerCommands() {
        for (const cmd of this.commands) {
            const disposable = vscode.commands.registerCommand(cmd.name, cmd.callback);
            this.extensionContext.subscriptions.push(disposable);
        }
    }
    
    // mby useful for renaming / refactoring tools 
    // 2do what the hell is this and when is it used?!? mybe useful for replacing text? test it || delete ticket#9042
    private applyTextEdits(uri: string, documentVersion: number, edits: vscode.TextEdit[]) {
        const textEditor = vscode.window.activeTextEditor;

        if (textEditor && textEditor.document.uri.toString() === uri) {
            if (textEditor.document.version !== documentVersion) {
                console.log("Versions of doc are different");
            }
            textEditor.edit((mutator: vscode.TextEditorEdit) => {
                for (const edit of edits) {
                    mutator.replace(this.languageServer.protocol2CodeConverter.asRange(edit.range), edit.newText);
                }
            }).then((success) => {
                if (!success) {
                    vscode.window.showErrorMessage("Failed to apply changes to the document.");
                }
            });
        }
    }
}
