"use strict";
export interface IExecutionCapabilities {
  hasSupportedMonoVersion(): boolean;
  getMono(selection: string | undefined): void;
}
