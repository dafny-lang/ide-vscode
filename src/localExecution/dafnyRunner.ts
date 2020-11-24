"use strict";
import { WorkspaceConfiguration, workspace, window } from "../ideApi/_IdeApi";
import {
  Config,
  EnvironmentConfig,
  Information,
} from "../stringResources/_StringResourcesModule";

import { IDafnyRunner } from "./IDafnyRunner";

/**
 * This class is used for running Dafny files after they were compiled.
 * Since it uses dotnet in-place of the self-contained executables, no platform
 * specific handling is necessary.
 */
export class DafnyRunner implements IDafnyRunner {
  private config: WorkspaceConfiguration = workspace.getConfiguration(
    EnvironmentConfig.Dafny
  );

  public run(filename: string) {
    const terminal = window.createTerminal(`${Information.Run} ${filename}`);
    const command = this.getCommand(filename);
    console.log(command);
    terminal.show();
    terminal.sendText(command);
  }

  private getCommand(filename: string): string {
    const executable = filename.replace(
      EnvironmentConfig.DafnySuffix,
      EnvironmentConfig.ExeSuffix
    );
    const dotnetExecutable =
      this.config.get<string>(Config.DotnetExecutablePath) ||
      EnvironmentConfig.Dotnet;
    return `& ${dotnetExecutable} "${executable}"`;
  }
}
