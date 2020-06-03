"use strict";
import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient";

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
} from "../stringResources/_StringResourcesModule";
import { IDafnyRunner } from "../localExecution/_LocalExecutionModule";

import { ICompile } from "./ICompile";

/**
 * Request the DafnyServer to compile Dafny code.
 * Compiled files can be executed through the DafnyRunner
 * (class can be injected with the "runner" argument).
 */
export class Compile implements ICompile {
  private languageServer: LanguageClient;

  private result: ICompilerResult | null = null;
  private filename: string | null = null;

  constructor(languageServer: LanguageClient) {
    this.languageServer = languageServer;
  }

  private async prepareAndSendCompileRequest(
    document: vscode.TextDocument,
    customArgs: boolean
  ): Promise<boolean> {
    await document.save();

    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
      EnvironmentConfig.Dafny
    );
    const compilationArgs: string[] =
      config.get(Config.CompilationArguments) || [];
    this.filename = document.fileName;
    if (customArgs === true) {
      const opt: vscode.InputBoxOptions = {
        value: compilationArgs.join(" "),
        prompt: Information.CustomCompileArgsLabel,
      };
      const args: string | undefined = await vscode.window.showInputBox(opt);
      if (args) {
        vscode.window.showInformationMessage(
          `${Information.Arguments}: ${args}`
        );
        return this.sendServerRequest(args.split(" "));
      } else {
        vscode.window.showErrorMessage(Error.NoAdditionalArgsGiven);
        return Promise.reject(false);
      }
    } else {
      return this.sendServerRequest(compilationArgs);
    }
  }

  private async sendServerRequest(args: string[]): Promise<boolean> {
    vscode.window.showInformationMessage(Information.CompilationStarted);

    const arg: ICompilerArguments = {
      FileToCompile: this.filename || "",
      CompilationArguments: args,
    };

    try {
      const result: ICompilerResult = await this.languageServer.sendRequest(
        LanguageServerRequest.Compile,
        arg
      );

      this.result = result;
      if (result.error) {
        vscode.window.showErrorMessage(
          result.message || Information.CompilationFailed
        );
        return Promise.reject(false);
      }
      vscode.window.showInformationMessage(
        result.message || Information.CompilationFinished
      );
      return Promise.resolve(true);
    } catch (error) {
      vscode.window.showErrorMessage(
        `${Error.CanNotCompile}: ${error.message}`
      );
      return Promise.reject(false);
    }
  }

  public async compile(customArgs: boolean = false): Promise<boolean> {
    if (
      vscode.window.activeTextEditor &&
      vscode.window.activeTextEditor.document
    ) {
      return this.prepareAndSendCompileRequest(
        vscode.window.activeTextEditor.document,
        customArgs
      );
    }
    return Promise.reject(false);
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
