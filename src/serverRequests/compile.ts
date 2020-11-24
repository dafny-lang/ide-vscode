"use strict";
import * as path from "path";
import * as fs from "fs";
import {
  workspace,
  window,
  InputBoxOptions,
  TextDocument,
  WorkspaceConfiguration,
} from "../ideApi/_IdeApi";
import {
  Information,
  Error,
  Config,
  EnvironmentConfig,
} from "../stringResources/_StringResourcesModule";
import { getDotnetExecutablePath } from "../tools/dotnet";

import { ICompile } from "./ICompile";

/**
 * Requests the language server to compile Dafny code.
 * Compiled files can be executed through the DafnyRunner
 * (class can be injected with the "runner" argument).
 */
export class Compile implements ICompile {
  private readonly config: WorkspaceConfiguration = workspace.getConfiguration(
    EnvironmentConfig.Dafny
  );

  public async compileAndRun(
    useCustomArgs: boolean,
    run: boolean
  ): Promise<boolean> {
    const document = this.getDocument();
    if (document === null) {
      return false;
    }
    await document.save();
    const command = await this.createCompileCommand(
      document.fileName,
      useCustomArgs,
      run
    );
    if (command === null) {
      return false;
    }
    const terminal = window.activeTerminal ?? window.createTerminal();
    terminal.show();
    console.log(command);
    terminal.sendText(command);
    return true;
  }

  private getDocument(): TextDocument | null {
    if (window.activeTextEditor && window.activeTextEditor.document) {
      return window.activeTextEditor.document;
    }
    return null;
  }

  private async createCompileCommand(
    filename: string,
    useCustomArgs: boolean,
    run: boolean
  ): Promise<string | null> {
    let compilerRuntimePath = this.config.get<string>(
      Config.CompilerRuntimePath
    );
    if (compilerRuntimePath === undefined) {
      window.showErrorMessage(Error.ServerRuntimeNotDefined);
      throw Error.ServerRuntimeNotDefined;
    }
    if (!path.isAbsolute(compilerRuntimePath)) {
      compilerRuntimePath = path.join(__dirname, compilerRuntimePath);
    }
    const command = `& "${getDotnetExecutablePath()}" "${compilerRuntimePath}" "${filename}"`;
    const configuredArgs = this.getConfiguredArguments(run);
    let compilationArgs = configuredArgs.join(" ");
    if (useCustomArgs) {
      const opt: InputBoxOptions = {
        value: compilationArgs,
        prompt: Information.CustomCompileArgsLabel,
      };
      const args: string | undefined = await window.showInputBox(opt);
      if (args) {
        window.showInformationMessage(`${Information.Arguments}: ${args}`);
        compilationArgs = args;
      } else {
        window.showErrorMessage(Error.NoAdditionalArgsGiven);
        return null;
      }
    }
    return `${command} ${compilationArgs}`;
  }

  private getConfiguredArguments(run: boolean): string[] {
    let configuredArgs: string[] =
      this.config.get(Config.CompilationArguments) || [];
    if (run) {
      configuredArgs = configuredArgs.map((argument) => {
        if (argument.includes("/compile")) {
          return "/compile:3";
        }
        return argument;
      });
    }
    return configuredArgs;
  }
}
