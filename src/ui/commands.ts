"use strict";
import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient";

import {
  ICompile,
  Compile,
  ICounterExample,
  CounterExample,
} from "../serverRequests/_ServerRequestsModule";
import { IDafnyRunner } from "../localExecution/_LocalExecutionModule";
import { CommandStrings } from "../stringRessources/_StringRessourcesModule";

import { ICommands } from "./ICommands";
import { IDafnyUiManager } from "./IDafnyUiManager";
import { ICounterExamples } from "../typeInterfaces/_TypeInterfacesModule";

/**
 * Registers commands for VSCode UI. Actual logic is contained in /server/commandsLogic/<feature>
 * to keep this file as simple as possible.
 * Only register UI commands in this file and delgate logic to a command-class-file.
 */
export class Commands implements ICommands {
  private extensionContext: vscode.ExtensionContext;
  private languageServer: LanguageClient;
  private provider: IDafnyUiManager;
  private runner: IDafnyRunner;

  private commands = [
    {
      name: CommandStrings.Compile,
      callback: () => {
        const compile: ICompile = new Compile(this.languageServer);
        compile.compile(false);
      },
    },
    {
      name: CommandStrings.CompileCustomArgs,
      callback: () => {
        const compile: ICompile = new Compile(this.languageServer);
        compile.compile(true);
      },
    },
    {
      name: CommandStrings.CompileAndRun,
      callback: () => {
        const compile: ICompile = new Compile(this.languageServer);
        compile.compile(false);
        compile.run(this.runner);
      },
    },
    {
      name: CommandStrings.ShowCounterExample,
      callback: () => {
        const counterExample: ICounterExample = new CounterExample(
          this.languageServer
        );
        var callback = (
          allCounterExamples: ICounterExamples,
          autoTriggered: Boolean
        ): void => {
          this.provider
            .getCounterModelProvider()
            .showCounterModel(allCounterExamples, autoTriggered);
        };
        counterExample.getCounterExample(callback, false);
      },
    },
    {
      name: CommandStrings.HideCounterExample,
      callback: () =>
        this.provider.getCounterModelProvider().hideCounterModel(),
    },
    {
      name: CommandStrings.ShowReferences,
      callback: (jsonArgs: string) =>
        this.provider.getCodeLensProvider().showReferences(jsonArgs),
    },
    /* Please note that the command "RestartServer" is registered in dafnyLanguageServer for a higher cohesion */
  ];

  constructor(
    extensionContext: vscode.ExtensionContext,
    languageServer: LanguageClient,
    provider: IDafnyUiManager,
    runner: IDafnyRunner
  ) {
    this.languageServer = languageServer;
    this.provider = provider;
    this.runner = runner;
    this.extensionContext = extensionContext;
  }

  public registerCommands(): void {
    for (const cmd of this.commands) {
      const disposable = vscode.commands.registerCommand(
        cmd.name,
        cmd.callback
      );
      this.extensionContext.subscriptions.push(disposable);
    }
  }
}
