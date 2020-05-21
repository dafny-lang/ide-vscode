"use strict";
import { execFileSync } from "child_process";
import * as os from "os";
import { log } from "util";
import * as vscode from "vscode";

import {
  Config,
  EnvironmentConfig,
  Error,
  VSCodeCommandStrings,
} from "../stringRessources/_StringRessourcesModule";

import { IExecutionCapabilities } from "./IExecutionCapabilities";

/**
 * Check for supported capabilities (mono/.net runtime, dafny etc.)
 */
export class ExecutionCapabilities implements IExecutionCapabilities {
  private config = vscode.workspace.getConfiguration(EnvironmentConfig.Dafny);
  public hasSupportedMonoVersion(): boolean {
    const useMono = this.config.get<boolean>(Config.UseMono);

    if (os.platform() === EnvironmentConfig.Win32 && !useMono) {
      // Sadly, it is not easy to find out the .NET-version on Windows.
      // We assume that a supported Windows Version has a recent enough .NET version preinstalled.
      // See https://docs.microsoft.com/en-us/windows/desktop/api/winnt/ns-winnt-_osversioninfoa
      // and https://docs.microsoft.com/en-us/dotnet/framework/migration-guide/how-to-determine-which-versions-are-installed
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

  public getMono(selection: string | undefined): void {
    if (selection === Error.GetMono) {
      vscode.commands.executeCommand(
        VSCodeCommandStrings.Open,
        vscode.Uri.parse(Error.GetMonoUri)
      );
      let restartMessage;
      if (os.platform() === EnvironmentConfig.OSX) {
        // Mono adds a new folder to PATH; so give the easiest advice
        restartMessage = Error.RestartMacAfterMonoInstall;
      } else {
        restartMessage = Error.RestartCodeAfterMonoInstall;
      }
      vscode.window.showWarningMessage(restartMessage);
    }

    if (selection === Error.ConfigureMonoExecutable) {
      vscode.commands.executeCommand(VSCodeCommandStrings.ConfigSettings);
    }
  }
}
