"use strict";
import * as vscode from "vscode";
import { LanguageClient, ResponseError } from "vscode-languageclient";

import {
  ICompilerResult,
  ICompilerArguments,
} from "../typeInterfaces/_TypeInterfacesModule";
import {
  Information,
  Error,
  Config,
  EnvironmentConfig,
  LanguageServerRequest,
} from "../stringRessources/_StringRessourcesModule";
import { IDafnyRunner } from "../localExecution/_LocalExecutionModule";

import { ICompile } from "./ICompile";

/**
* Request the DafnyServer to compile Dafny code. 
* Compiled files can be executed through the DafnyRunner (a helper class 
    that can be injected with the "runner" argument)
*/
export class Compile implements ICompile {
  private languageServer: LanguageClient;

  private result: ICompilerResult | null = null;
  private filename: string | null = null;

  constructor(languageServer: LanguageClient) {
    this.languageServer = languageServer;
  }

  private prepareAndSendCompileRequest(
    document: vscode.TextDocument,
    customArgs: boolean
  ): void {
    document.save().then(() => {
      const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
        EnvironmentConfig.Dafny
      );
      const compilationArgs: string[] =
        config.get(Config.CompilationArguments) || [];
      if (customArgs === true) {
        const opt: vscode.InputBoxOptions = {
          value: compilationArgs.join(" "),
          prompt: Information.CustomCompileArgsLabel,
        };
        vscode.window.showInputBox(opt).then((args) => {
          if (args) {
            vscode.window.showInformationMessage(
              `${Information.Arguments}: ${args}`
            );
            this.sendServerRequest(document.fileName, args.split(" "));
          } else {
            vscode.window.showErrorMessage(Error.NoAdditionalArgsGiven);
          }
        });
      } else {
        this.sendServerRequest(document.fileName, compilationArgs);
      }
    });
  }

  private sendServerRequest(filename: string, args: string[]) {
    vscode.window.showInformationMessage(Information.CompilationStarted);

    const arg: ICompilerArguments = {
      FileToCompile: filename,
      CompilationArguments: args,
    };
    this.languageServer
      .sendRequest<ICompilerResult>(LanguageServerRequest.Compile, arg)
      .then(
        (result) => {
          this.result = result;
          if (result.error) {
            vscode.window.showErrorMessage(
              result.message || Information.CompilationFailed
            );
          }
          vscode.window.showInformationMessage(
            result.message || Information.CompilationFinished
          );
        },
        (error: ResponseError<void>) => {
          vscode.window.showErrorMessage(
            `${Error.CanNotCompile}: ${error.message}`
          );
        }
      );
  }

  public compile(customArgs: boolean = false): void {
    if (
      vscode.window.activeTextEditor &&
      vscode.window.activeTextEditor.document
    ) {
      this.prepareAndSendCompileRequest(
        vscode.window.activeTextEditor.document,
        customArgs
      );
    }
  }

  public run(runner: IDafnyRunner): void {
    if (this.result && this.filename && this.result.executable) {
      vscode.window.showInformationMessage(Information.CompilationStartRunner);
      runner.run(this.filename);
    } else {
      vscode.window.showInformationMessage(Error.NoMainMethod);
    }
  }
}
