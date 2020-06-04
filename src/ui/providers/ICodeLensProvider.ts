"use strict";
export interface ICodeLensProvider {
  showReferences(jsonArgs: string): void;
}
