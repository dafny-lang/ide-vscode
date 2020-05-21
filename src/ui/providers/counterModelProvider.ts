"use strict";
import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient";

import {
  ICounterExamples,
  ICounterExample,
} from "../../typeInterfaces/_TypeInterfacesModule";
import {
  Warning,
  Config,
  EnvironmentConfig,
} from "../../stringRessources/_StringRessourcesModule";
import {
  CounterExample as RequestCounterExample,
  ICounterExample as IRequestCounterExample,
} from "../../serverRequests/_ServerRequestsModule";

import { ICounterModelProvider } from "./ICounterModelProvider";
import { DafnyFileChecker } from "../dafnyFileChecker";

/**
 * This is the general UI element provider for counter models.
 * There is one instance (created in the dafnyUiManager) of this compnent and for every file the counter model is handled in this instance.
 * This component is responsible for show and hide counter examples in case one is closing and repoening a file.
 */
export class CounterModelProvider implements ICounterModelProvider {
  private fileHasVisibleCounterModel: { [docPathName: string]: boolean } = {};
  private decorators: {
    [docPathName: string]: vscode.TextEditorDecorationType;
  } = {};
  private displayOptions: vscode.DecorationRenderOptions = {};
  private readonly defaultDarkBackgroundColor: string = "#0d47a1";
  private readonly defaultDarkFontColor = "#e3f2fd";
  private readonly defaultLightBackgroundColor = "#bbdefb";
  private readonly defaultLightFontColor = "#102027";
  private readonly defaultMargin = "0 0 0 30px";

  constructor() {
    this.loadDisplayOptions();
    vscode.workspace.onDidChangeConfiguration(this.loadDisplayOptions, this);
  }

  public hideCounterModel(): void {
    if (this.decorators[DafnyFileChecker.getActiveFileName()]) {
      this.decorators[DafnyFileChecker.getActiveFileName()].dispose();
      this.fileHasVisibleCounterModel[
        DafnyFileChecker.getActiveFileName()
      ] = false;
    }
  }

  public showCounterModel(
    allCounterExamples: ICounterExamples,
    isAutoTriggered: boolean = false
  ): void {
    const editor: vscode.TextEditor = vscode.window.activeTextEditor!;
    const arrayOfDecorations: vscode.DecorationOptions[] = [];
    let hasReferences: boolean = false;

    for (let i = 0; i < allCounterExamples.counterExamples.length; i++) {
      let currentCounterExample: ICounterExample =
        allCounterExamples.counterExamples[i];
      let line = currentCounterExample.line;
      let col = currentCounterExample.col;
      if (line < 0) {
        return;
      }

      let shownText = "";
      for (let [key, value] of Object.entries(
        currentCounterExample.variables
      )) {
        shownText += `${key} = ${value}; `;

        if (value == EnvironmentConfig.CounterModelObjectReference) {
          hasReferences = true;
        }
      }
      const renderOptions: vscode.DecorationRenderOptions = {
        after: {
          contentText: shownText,
        },
      };

      let decorator: vscode.DecorationOptions = {
        range: new vscode.Range(
          new vscode.Position(line, col + 1),
          new vscode.Position(line, Number.MAX_VALUE)
        ),
        renderOptions,
      };

      arrayOfDecorations.push(decorator);
    }

    if (!isAutoTriggered && hasReferences) {
      vscode.window.showWarningMessage(Warning.ReferencesInCounterExample);
    }

    if (!isAutoTriggered && allCounterExamples.counterExamples.length == 0) {
      vscode.window.showWarningMessage(Warning.NoCounterExamples);
    }

    this.fileHasVisibleCounterModel[
      DafnyFileChecker.getActiveFileName()
    ] = true;
    const shownTextTemplate = this.getDisplay();
    this.decorators[DafnyFileChecker.getActiveFileName()] = shownTextTemplate;
    editor.setDecorations(shownTextTemplate, arrayOfDecorations);
  }

  public update(languageServer: LanguageClient): void {
    if (
      this.fileHasVisibleCounterModel[DafnyFileChecker.getActiveFileName()] ===
      true
    ) {
      this.hideCounterModel();

      const counterExample: IRequestCounterExample = new RequestCounterExample(
        languageServer
      );
      var callback = (
        allCounterExamples: ICounterExamples,
        isAutoTriggered: boolean
      ): void => {
        this.showCounterModel(allCounterExamples, isAutoTriggered);
      };
      counterExample.getCounterExample(callback, true);
    }
  }

  private getDisplay(): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType(this.displayOptions);
  }

  private loadDisplayOptions(): void {
    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
      EnvironmentConfig.Dafny
    );
    const customOptions:
      | { backgroundColor: string; fontColor: string }
      | undefined = config.get(Config.ColorCounterExamples);

    this.displayOptions = {
      dark: {
        after: {
          backgroundColor:
            customOptions?.backgroundColor || this.defaultDarkBackgroundColor,
          color: customOptions?.fontColor || this.defaultDarkFontColor,
          margin: this.defaultMargin,
        },
      },
      light: {
        after: {
          backgroundColor:
            customOptions?.backgroundColor || this.defaultLightBackgroundColor,
          color: customOptions?.fontColor || this.defaultLightFontColor,
          margin: this.defaultMargin,
        },
      },
    };
  }
}
