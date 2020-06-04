"use strict";
import { IDafnyRunner } from "../localExecution/_LocalExecutionModule";
export interface ICompile {
  compile(useCustomArgs: boolean): Promise<boolean>;
  run(runner: IDafnyRunner): void;
}
