"use strict";
import {
  workspace,
  window,
  WorkspaceConfiguration,
  TextEditor,
  TextEditorDecorationType,
  DecorationOptions,
  DecorationRenderOptions,
  Range,
  Position,
  LanguageClient,
} from "../../ideApi/_IdeApi";
import {
  ICounterExampleItem,
} from "../../typeInterfaces/_TypeInterfacesModule";
import {
  Warning,
  Config,
  EnvironmentConfig,
  CounterExampleConfig,
} from "../../stringResources/_StringResourcesModule";
import {
  CounterExample as RequestCounterExample,
  ICounterExample as IRequestCounterExample,
} from "../../serverRequests/_ServerRequestsModule";

import { ICounterModelProvider } from "./ICounterModelProvider";
import { DafnyFileChecker } from "../dafnyFileChecker";

/**
 * This is the general UI element provider for counter models.
 * There is only one instance (created in the dafnyUiManager) of this compnent.
 * For every file, the counter model is handled in this instance.
 * This component is responsible for show and hide counter examples in case one is closing and repoening a file.
 */
export class CounterModelProvider implements ICounterModelProvider {
  private fileHasVisibleCounterModel: { [docPathName: string]: boolean } = {};
  private decorators: {
    [docPathName: string]: TextEditorDecorationType;
  } = {};
  private displayOptions: DecorationRenderOptions = {};
  private readonly defaultDarkBackgroundColor: string =
    CounterExampleConfig.DefaultDarkBackgroundColor;
  private readonly defaultDarkFontColor =
    CounterExampleConfig.DefaultDarkFontColor;
  private readonly defaultLightBackgroundColor =
    CounterExampleConfig.DefaultLightBackgroundColor;
  private readonly defaultLightFontColor =
    CounterExampleConfig.DefaultLightFontColor;
  private readonly defaultMargin = CounterExampleConfig.DefaultMargin;

  constructor() {
    this.loadDisplayOptions();
    workspace.onDidChangeConfiguration(this.loadDisplayOptions, this);
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
    allCounterExamples: ICounterExampleItem[],
    isAutoTriggered: boolean = false
  ): void {
    const editor: TextEditor = window.activeTextEditor!;
    const arrayOfDecorations: DecorationOptions[] = [];
    let hasReferences: boolean = false;

    for (let i = 0; i < allCounterExamples.length; i++) {
      let currentCounterExample: ICounterExampleItem =
        allCounterExamples[i];
      let line = currentCounterExample.position.line;
      let col = currentCounterExample.position.character;
      if (line < 0) {
        return;
      }

      let shownText = "";
      for (let [key, value] of Object.entries(
        currentCounterExample.variables
      )) {
        shownText += `${key} = ${value}; `;

        if (value == CounterExampleConfig.ObjectReference) {
          hasReferences = true;
        }
      }
      const renderOptions: DecorationRenderOptions = {
        after: {
          contentText: shownText,
        },
      };

      let decorator: DecorationOptions = {
        range: new Range(
          new Position(line, col + 1),
          new Position(line, Number.MAX_VALUE)
        ),
        renderOptions,
      };
      arrayOfDecorations.push(decorator);
    }

    if (!isAutoTriggered && hasReferences) {
      window.showWarningMessage(Warning.ReferencesInCounterExample);
    }

    if (!isAutoTriggered && allCounterExamples.length == 0) {
      window.showWarningMessage(Warning.NoCounterExamples);
    }

    this.fileHasVisibleCounterModel[
      DafnyFileChecker.getActiveFileName()
    ] = true;
    const shownTextTemplate = this.getDisplay();
    this.decorators[DafnyFileChecker.getActiveFileName()] = shownTextTemplate;
    editor.setDecorations(shownTextTemplate, arrayOfDecorations);
  }

  public update(languageServer: LanguageClient): void {
    if (this.fileHasVisibleCounterModel[DafnyFileChecker.getActiveFileName()]) {
      this.hideCounterModel();

      const counterExample: IRequestCounterExample = new RequestCounterExample(
        languageServer
      );
      var callback = (
        allCounterExamples: ICounterExampleItem[],
        isAutoTriggered: boolean
      ): void => {
        this.showCounterModel(allCounterExamples, isAutoTriggered);
      };
      counterExample.getCounterExample(callback, true);
    }
  }

  private getDisplay(): TextEditorDecorationType {
    return window.createTextEditorDecorationType(this.displayOptions);
  }

  private loadDisplayOptions(): void {
    const config: WorkspaceConfiguration = workspace.getConfiguration(
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
