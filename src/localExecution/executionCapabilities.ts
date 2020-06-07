"use strict";
import { execFileSync } from "child_process";
import * as os from "os";
import { log } from "util";

import { ide } from "../ideApi/_IdeApi";
import {
  Config,
  EnvironmentConfig,
  Error,
  VSCodeCommandStrings,
} from "../stringResources/_StringResourcesModule";

import { IExecutionCapabilities } from "./IExecutionCapabilities";

/**
 * Check for supported capabilities (mono/.net runtime, Dafny)
 */
export class ExecutionCapabilities implements IExecutionCapabilities {
  private config = ide.workspace.getConfiguration(EnvironmentConfig.Dafny);
  public hasSupportedMonoVersion(): boolean {
    const useMono = this.config.get<boolean>(Config.UseMono);

    if (os.platform() === EnvironmentConfig.Win32 && !useMono) {
      return true;
    }

    const monoExecutable =
      this.config.get<string>(Config.MonoExecutablePath) ||
      EnvironmentConfig.Mono;

    try {
      const monoVersionOutput = execFileSync(monoExecutable, [
        EnvironmentConfig.MonoVersion,
      ]);
      const monoVersion = /compiler version (\d+)\.(\d+)\.(\d+)/i
        .exec(monoVersionOutput)!
        .slice(1)
        .map((str) => Number(str));

      if (monoVersion.length !== 3 || monoVersion.some((num) => isNaN(num))) {
        log(Error.MonoVersionNotParsed);
        return false;
      }

      return monoVersion[0] >= 4;
    } catch (exeception) {
      log(Error.MonoBinaryNotExecuted);
      return false;
    }
  }

  public getMono(monoVersionSelection: string): void {
    if (monoVersionSelection === Error.GetMono) {
      ide.commands.executeCommand(
        VSCodeCommandStrings.Open,
        ide.Uri.parse(Error.GetMonoUri)
      );
      let restartMessage;
      if (os.platform() === EnvironmentConfig.OSX) {
        restartMessage = Error.RestartMacAfterMonoInstall;
      } else {
        restartMessage = Error.RestartCodeAfterMonoInstall;
      }
      ide.window.showWarningMessage(restartMessage);
    }

    if (monoVersionSelection === Error.ConfigureMonoExecutable) {
      ide.commands.executeCommand(VSCodeCommandStrings.ConfigSettings);
    }
  }
}
