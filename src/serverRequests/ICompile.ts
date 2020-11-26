"use strict";

export interface ICompile {
  compileAndRun(useCustomArgs: boolean, run: boolean): Promise<boolean>;
}
