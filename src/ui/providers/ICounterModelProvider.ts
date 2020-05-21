import { LanguageClient } from "vscode-languageclient";

import { ICounterExamples } from "../../typeInterfaces/_TypeInterfacesModule";

export interface ICounterModelProvider {
  hideCounterModel(): void;
  showCounterModel(
    allCounterExamples: ICounterExamples,
    autoTriggered: Boolean
  ): void;
  update(languageServer: LanguageClient): void;
}
