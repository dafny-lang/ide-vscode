"use strict";
import { LanguageClient } from "../../ideApi/_IdeApi";
import { ICounterExampleItem } from "../../typeInterfaces/_TypeInterfacesModule";

export interface ICounterModelProvider {
  hideCounterModel(): void;
  showCounterModel(
    allCounterExamples: ICounterExampleItem[],
    isAutoTriggered: boolean
  ): void;
  update(languageServer: LanguageClient): void;
}
