"use strict";
export interface IExecutionCapabilities {
  hasSupportedDotnetVersion(): boolean;
  getDotnet(dotnetVersionSelection: string): void;
}
