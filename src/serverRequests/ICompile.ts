"use strict";
import { IDafnyRunner } from "../localExecution/_LocalExecutionModule";
export interface ICompile {
  compile(customArgs: boolean): void;
  run(runner: IDafnyRunner): void;
}
