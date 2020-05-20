"use strict";
import * as vscode from "vscode";
import { LanguageClient, ResponseError } from "vscode-languageclient";

import { ICompilerResult } from "../../typeInterfaces/ICompilerResult";
import { ICompilerArguments } from "../../typeInterfaces/ICompilerArguments";
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
  static doCompile(
    languageServer: LanguageClient,
    runner: DafnyRunner,
    run: boolean = false,
    customArgs: boolean = false
  ) {
    function compile(
      document: vscode.TextDocument | undefined,
      run: boolean
    ): void {
      if (!document) {
        return; // Skip if user closed everything in the meantime
      }
      document.save().then(() => {
        const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
          EnvironmentConfig.Dafny
        );
        const compilationArgs: string[] = config.get("compilationArgs") || [];
        if (customArgs === true) {
          const opt: vscode.InputBoxOptions = {
            value: compilationArgs.join(" "),
            prompt: Information.CustomCompileArgsLabel,
          };
          vscode.window.showInputBox(opt).then((args) => {
            if (args) {
              vscode.window.showInformationMessage("Args: " + args);
              sendServerRequest(document.fileName, args.split(" "), run);
            } else {
              vscode.window.showErrorMessage(Error.NoAdditionalArgsGiven);
            }
          });
        } else {
          sendServerRequest(document.fileName, compilationArgs, run);
        }
      });
    }

    function sendServerRequest(filename: string, args: string[], run: boolean) {
      vscode.window.showInformationMessage(Information.CompilationStarted);

      const arg: ICompilerArguments = {
        FileToCompile: filename,
        CompilationArguments: args,
      };
      languageServer
        .sendRequest<ICompilerResult>(LanguageServerRequest.Compile, arg)
        .then(
          (result) => {
            if (result.error) {
              vscode.window.showErrorMessage(
                result.message || Information.CompilationFailed
              );
              return true;
            }
            vscode.window.showInformationMessage(
              result.message || Information.CompilationFinished
            );
            if (run) {
              if (result.executable) {
                vscode.window.showInformationMessage(
                  Information.CompilationStartRunner
                );
                runner.run(filename);
              } else {
                vscode.window.showInformationMessage(Error.NoMainMethod);
              }
            }
            return false;
          },
          (error: ResponseError<void>) => {
            vscode.window.showErrorMessage(
              `${Error.CanNotCompile}: ${error.message}`
            );
          }
        );
    }

    return (
      vscode.window.activeTextEditor &&
      compile(vscode.window.activeTextEditor.document, run)
    );
  }
}
