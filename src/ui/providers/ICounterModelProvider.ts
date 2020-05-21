"use strict";
import { LanguageClient } from "vscode-languageclient";
import { ICounterExamples } from "../../typeInterfaces/_TypeInterfacesModule";

export interface ICounterModelProvider {
  hideCounterModel(): void;
  showCounterModel(
    allCounterExamples: ICounterExamples,
    isAutoTriggered: Boolean
  ): void;
  update(languageServer: LanguageClient): void;
}
