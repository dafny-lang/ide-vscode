"use strict";
import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient";

import { DafnyUiManager } from "./dafnyUiManager";
import { DafnyRunner } from "../localExecutionHelpers/dafnyRunner";
import { Compile } from "../server/serverRequests/compile";
import { CounterExample } from "../server/serverRequests/counterExample";
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

  // todo move this function
  public static showReferences(jsonArgs: string) {
    // todo rm any
    function parsePosition(p: any): vscode.Position {
      return new vscode.Position(p.Line, p.Character);
    }
    function parseRange(r: any): vscode.Range {
      return new vscode.Range(parsePosition(r.Start), parsePosition(r.End));
    }
    function parseLocation(l: any): vscode.Location {
      return new vscode.Location(parseUri(l.Uri), parseRange(l.Range));
    }
    function parseUri(u: any): vscode.Uri {
      return vscode.Uri.parse(u);
    }

    let obj;
    try {
      obj = JSON.parse(jsonArgs);
    } catch (e) {
      // todo show error msg
    }

    const parsedUri: vscode.Uri = parseUri(obj.Uri);
    const parsedPosition: vscode.Position = parsePosition(obj.Position);
    const parsedLocations: Array<vscode.Location> = [];

    for (const location of obj.Locations) {
      parsedLocations.push(parseLocation(location));
    }

    vscode.commands.executeCommand(
      "editor.action.showReferences",
      parsedUri,
      parsedPosition,
      parsedLocations
    );
  }

  private commands = [
    {
      name: CommandStrings.Compile,
      callback: () =>
        Compile.doCompile(this.languageServer, this.runner, false),
    },
    {
      name: CommandStrings.CompileCustomArgs,
      callback: () =>
        Compile.doCompile(this.languageServer, this.runner, false, true),
    },
    {
      name: CommandStrings.CompileAndRun,
      callback: () => Compile.doCompile(this.languageServer, this.runner, true),
    },
    {
      name: CommandStrings.ShowCounterExample,
      callback: () =>
        CounterExample.createCounterExample(
          this.languageServer,
          this.provider.getCounterModelProvider()
        ),
    },
    {
      name: CommandStrings.HideCounterExample,
      callback: () =>
        this.provider.getCounterModelProvider().hideCounterModel(),
    },
    {
      name: CommandStrings.ShowReferences,
      callback: Commands.showReferences,
    },
    /* Please note that the command "RestartServer" is registered in dafnyLanguageServer for a higher cohesion */

    {
      // 2do what is this?? ticket#9042
      name: CommandStrings.EditText,
      callback: (uri: string, version: number, edits: vscode.TextEdit[]) =>
        this.applyTextEdits(uri, version, edits),
    },
  ];

  constructor(
    extensionContext: vscode.ExtensionContext,
    languageServer: LanguageClient,
    provider: DafnyUiManager,
    runner: DafnyRunner
  ) {
    this.languageServer = languageServer;
    this.provider = provider;
    this.runner = runner;
    this.extensionContext = extensionContext;
  }

  public registerCommands() {
    for (const cmd of this.commands) {
      const disposable = vscode.commands.registerCommand(
        cmd.name,
        cmd.callback
      );
      this.extensionContext.subscriptions.push(disposable);
    }
  }

  // mby useful for renaming / refactoring tools
  // 2do what the hell is this and when is it used?!? mybe useful for replacing text? test it || delete ticket#9042
  private applyTextEdits(
    uri: string,
    documentVersion: number,
    edits: vscode.TextEdit[]
  ) {
    const textEditor = vscode.window.activeTextEditor;

    if (textEditor && textEditor.document.uri.toString() === uri) {
      if (textEditor.document.version !== documentVersion) {
        console.log("Versions of doc are different");
      }
      textEditor
        .edit((mutator: vscode.TextEditorEdit) => {
          for (const edit of edits) {
            mutator.replace(
              this.languageServer.protocol2CodeConverter.asRange(edit.range),
              edit.newText
            );
          }
        })
        .then((success) => {
          if (!success) {
            vscode.window.showErrorMessage(
              "Failed to apply changes to the document."
            );
          }
        });
    }
  }
}
