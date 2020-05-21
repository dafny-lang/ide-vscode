"use strict";
import { ICounterModelProvider } from "./providers/ICounterModelProvider";
import { ICodeLensProvider } from "./providers/ICodeLensProvider";

export interface IDafnyUiManager {
  registerEventListener(): void;
  getCounterModelProvider(): ICounterModelProvider;
  getCodeLensProvider(): ICodeLensProvider;
}
