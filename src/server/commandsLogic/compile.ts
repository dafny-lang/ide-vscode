"use strict";
import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient";

import { ICompilerResult } from "../../typeInterfaces/ICompilerResult";
import { DafnyRunner } from "../../localExecutionHelpers/dafnyRunner";
import { Information, Error } from "../../stringRessources/messages";
import { EnvironmentConfig } from "../../stringRessources/commands";
import { LanguageServerRequest } from "../../stringRessources/languageServer";

/*
* Request the DafnyServer to compile Dafny code. 
* Compiled files can be executed through the DafnyRunner (a helper class 
    that can be injected with the "runner" argument)
*/
export class Compile {
    // 2do - weniger argumente oO 
    static doCompile(languageServer: LanguageClient, runner: DafnyRunner, run : boolean = false, customArgs: boolean = false) {
        function compile(document: vscode.TextDocument | undefined, run: boolean): void {
            if (!document) {
                return; // Skip if user closed everything in the meantime
            }
            document.save();
            vscode.window.showInformationMessage(Information.CompilationStarted);
    
            const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(EnvironmentConfig.Dafny);
            let compilationArgs : string[]  = config.get("compilationArgs") || [];

            if(customArgs === true) {
                // 2do 
                let opt: vscode.InputBoxOptions = {
                    placeHolder: Information.CustomCompileArgsPlaceHolder,
                    prompt: Information.CustomCompileArgsLabel
                }
                vscode.window.showInputBox(opt).then((args) => {
                    if(args) {
                        Array.prototype.push.apply(compilationArgs, args.split(" "))
                        vscode.window.showInformationMessage("Args: " + compilationArgs.join(" "));
                        sendServerRequest(document.fileName, compilationArgs, run)
                    } else {
                        vscode.window.showErrorMessage(Error.NoAdditionalArgsGiven);
                    }
                });
                
            } else {
                sendServerRequest(document.fileName, compilationArgs, run)
            }
        }

        function sendServerRequest(filename: string, args: string[], run: boolean) {
            const arg = {
                FileToCompile: filename,
                CompilationArguments: args
            }
            languageServer.sendRequest<ICompilerResult>(LanguageServerRequest.Compile, arg)
                .then((result) => {
                    if (result.error) {
                        vscode.window.showErrorMessage(result.message || Information.CompilationFailed);
                        return true;
                    }
                    vscode.window.showInformationMessage(result.message || Information.CompilationFinished)
                    if (run) {
                        if (result.executable) {
                            vscode.window.showInformationMessage(Information.CompilationStartRunner);
                            runner.run(filename);
                        } else {
                            vscode.window.showInformationMessage(Error.NoMainMethod);
                        }
                    }
                    return false;
                }, (error: any) => {
                    vscode.window.showErrorMessage(`${Error.CanNotCompile}: ${error.message}`);
                });
        }

        return vscode.window.activeTextEditor && compile(vscode.window.activeTextEditor.document, run);
    }

}