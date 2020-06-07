"use strict";
export interface IExecutionCapabilities {
  hasSupportedMonoVersion(): boolean;
  getMono(monoVersionSelection: string): void;
}
