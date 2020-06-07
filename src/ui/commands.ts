"use strict";
import {
  commands,
  ExtensionContext,
  Disposable,
  LanguageClient,
} from "../ideApi/_IdeApi";
import {
  ICompile,
  Compile,
  ICounterExample,
  CounterExample,
} from "../serverRequests/_ServerRequestsModule";
import { IDafnyRunner } from "../localExecution/_LocalExecutionModule";
import { CommandStrings } from "../stringResources/_StringResourcesModule";

import { ICommands } from "./ICommands";
import { IDafnyUiManager } from "./IDafnyUiManager";
import { ICounterExamples } from "../typeInterfaces/_TypeInterfacesModule";

/**
 * Register commands for VS Code UI. Actual logic is contained in /server/commandsLogic/<feature>
 * to keep this file as simple as possible.
 * Only register UI commands in this file and delegate logic to a command-class-file.
 */
export class Commands implements ICommands {
  private extensionContext: ExtensionContext;
  private languageServer: LanguageClient;
  private provider: IDafnyUiManager;
  private runner: IDafnyRunner;
  private disposables: Array<Disposable> = [];

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
        compile.compile(false).then(() => compile.run(this.runner));
      },
    },
    {
      name: CommandStrings.ShowCounterExample,
      callback: () => {
        const counterExample: ICounterExample = new CounterExample(
          this.languageServer
        );
        const callback: Function = (
          allCounterExamples: ICounterExamples,
          isAutoTriggered: boolean
        ): void => {
          this.provider
            .getCounterModelProvider()
            .showCounterModel(allCounterExamples, isAutoTriggered);
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
    extensionContext: ExtensionContext,
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
      const disposable = commands.registerCommand(cmd.name, cmd.callback);
      this.extensionContext.subscriptions.push(disposable);
      this.disposables.push(disposable);
    }
  }

  public unregisterCommands(): void {
    this.disposables.forEach((e) => e.dispose());
    this.disposables = [];
  }
}
