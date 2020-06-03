"use strict";
export interface ICodeLensReferences {
  Uri: string;
  Locations: Array<ICodeLensLocation>;
  Position: ICodeLensPosition;
}

export interface ICodeLensLocation {
  Uri: string;
  Range: ICodeLensRange;
}

export interface ICodeLensRange {
  Start: ICodeLensPosition;
  End: ICodeLensPosition;
}

export interface ICodeLensPosition {
  Line: number;
  Character: number;
}
