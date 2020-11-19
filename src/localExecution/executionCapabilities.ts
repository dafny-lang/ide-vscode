"use strict";
import { execFileSync } from "child_process";
import * as os from "os";
import { log } from "util";

import { workspace, commands, window, Uri } from "../ideApi/_IdeApi";
import {
  Config,
  EnvironmentConfig,
  Error,
  VSCodeCommandStrings,
} from "../stringResources/_StringResourcesModule";

import { IExecutionCapabilities } from "./IExecutionCapabilities";

/**
 * Check for supported capabilities (dotnet runtime, Dafny)
 */
export class ExecutionCapabilities implements IExecutionCapabilities {
  private config = workspace.getConfiguration(EnvironmentConfig.Dafny);
  public hasSupportedDotnetVersion(): boolean {
    const dotnetExecutable =
      this.config.get<string>(Config.DotnetExecutablePath) ||
      EnvironmentConfig.Dotnet;

    try {
      const dotnetVersionOutput = execFileSync(dotnetExecutable, [
        EnvironmentConfig.DotnetVersion,
      ]);
      const dotnetVersion = /(\d+)\.(\d+)\.(\d+).*/i
        .exec(dotnetVersionOutput)!
        .slice(1)
        .map((str) => Number(str));

      if (
        dotnetVersion.length !== 3 ||
        dotnetVersion.some((num) => isNaN(num))
      ) {
        log(Error.DotnetVersionNotParsed);
        return false;
      }

      return this.isRequiredDotnetVersionOrHigher(dotnetVersion);
    } catch (exeception) {
      log(Error.DotnetBinaryNotExecuted);
      return false;
    }
  }

  private isRequiredDotnetVersionOrHigher(semanticVersion: number[]): boolean {
    const major = semanticVersion[0];
    if(major > 3) {
      return true;
    }
    const minor = semanticVersion[1];
    return major == 3 && minor >= 1;
  }

  public getDotnet(dotnetVersionSelection: string): void {
    if (dotnetVersionSelection === Error.GetDotnet) {
      commands.executeCommand(
        VSCodeCommandStrings.Open,
        Uri.parse(Error.GetDotnetUri)
      );
      let restartMessage;
      if (os.type() === "Darwin") {
        restartMessage = Error.RestartMacAfterDotnetInstall;
      } else {
        restartMessage = Error.RestartCodeAfterDotnetInstall;
      }
      window.showWarningMessage(restartMessage);
    }

    if (dotnetVersionSelection === Error.ConfigureDotnetExecutable) {
      commands.executeCommand(VSCodeCommandStrings.ConfigSettings);
    }
  }
}
