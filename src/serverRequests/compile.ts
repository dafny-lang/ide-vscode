"use strict";
import {
  workspace,
  window,
  InputBoxOptions,
  TextDocument,
  WorkspaceConfiguration,
  LanguageClient,
} from "../ideApi/_IdeApi";
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
 * Requests the language server to compile Dafny code.
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
    document: TextDocument,
    useCustomArgs: boolean
  ): Promise<boolean> {
    await document.save();

    const config: WorkspaceConfiguration = workspace.getConfiguration(
      EnvironmentConfig.Dafny
    );
    const compilationArgs: string[] =
      config.get(Config.CompilationArguments) || [];
    this.filename = document.fileName;
    if (useCustomArgs) {
      const opt: InputBoxOptions = {
        value: compilationArgs.join(" "),
        prompt: Information.CustomCompileArgsLabel,
      };
      const args: string | undefined = await window.showInputBox(opt);
      if (args) {
        window.showInformationMessage(`${Information.Arguments}: ${args}`);
        return this.sendServerRequest(args.split(" "));
      } else {
        window.showErrorMessage(Error.NoAdditionalArgsGiven);
        return Promise.reject(false);
      }
    } else {
      return this.sendServerRequest(compilationArgs);
    }
  }

  private async sendServerRequest(args: string[]): Promise<boolean> {
    window.showInformationMessage(Information.CompilationStarted);

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
        window.showErrorMessage(
          result.message || Information.CompilationFailed
        );
        return Promise.reject(false);
      }
      window.showInformationMessage(
        result.message || Information.CompilationFinished
      );
      return Promise.resolve(true);
    } catch (error) {
      window.showErrorMessage(`${Error.CanNotCompile}: ${error.message}`);
      return Promise.reject(false);
    }
  }

  public async compile(useCustomArgs: boolean = false): Promise<boolean> {
    if (window.activeTextEditor && window.activeTextEditor.document) {
      return this.prepareAndSendCompileRequest(
        window.activeTextEditor.document,
        useCustomArgs
      );
    }
    return Promise.reject(false);
  }

  public run(runner: IDafnyRunner): void {
    if (this.result && this.filename && this.result.executable) {
      window.showInformationMessage(Information.CompilationStartRunner);
      runner.run(this.filename);
    } else {
      window.showInformationMessage(Error.NoMainMethod);
    }
  }
}
