"use strict";
import { ide, LanguageClient } from "../ideApi/_IdeApi";
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
    document: ide.TextDocument,
    useCustomArgs: boolean
  ): Promise<boolean> {
    await document.save();

    const config: ide.WorkspaceConfiguration = ide.workspace.getConfiguration(
      EnvironmentConfig.Dafny
    );
    const compilationArgs: string[] =
      config.get(Config.CompilationArguments) || [];
    this.filename = document.fileName;
    if (useCustomArgs) {
      const opt: ide.InputBoxOptions = {
        value: compilationArgs.join(" "),
        prompt: Information.CustomCompileArgsLabel,
      };
      const args: string | undefined = await ide.window.showInputBox(opt);
      if (args) {
        ide.window.showInformationMessage(`${Information.Arguments}: ${args}`);
        return this.sendServerRequest(args.split(" "));
      } else {
        ide.window.showErrorMessage(Error.NoAdditionalArgsGiven);
        return Promise.reject(false);
      }
    } else {
      return this.sendServerRequest(compilationArgs);
    }
  }

  private async sendServerRequest(args: string[]): Promise<boolean> {
    ide.window.showInformationMessage(Information.CompilationStarted);

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
        ide.window.showErrorMessage(
          result.message || Information.CompilationFailed
        );
        return Promise.reject(false);
      }
      ide.window.showInformationMessage(
        result.message || Information.CompilationFinished
      );
      return Promise.resolve(true);
    } catch (error) {
      ide.window.showErrorMessage(`${Error.CanNotCompile}: ${error.message}`);
      return Promise.reject(false);
    }
  }

  public async compile(useCustomArgs: boolean = false): Promise<boolean> {
    if (ide.window.activeTextEditor && ide.window.activeTextEditor.document) {
      return this.prepareAndSendCompileRequest(
        ide.window.activeTextEditor.document,
        useCustomArgs
      );
    }
    return Promise.reject(false);
  }

  public run(runner: IDafnyRunner): void {
    if (this.result && this.filename && this.result.executable) {
      ide.window.showInformationMessage(Information.CompilationStartRunner);
      runner.run(this.filename);
    } else {
      ide.window.showInformationMessage(Error.NoMainMethod);
    }
  }
}
