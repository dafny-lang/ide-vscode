"use strict";
import * as os from "os";
import * as vscode from "vscode";

import {
  Config,
  EnvironmentConfig,
  Information,
} from "../stringRessources/_StringRessourcesModule";

import { IDafnyRunner } from "./IDafnyRunner";

/**
 * This class is used for running dafny files after they are compiled
 * Therefore it also supports mono for macOS / Linux
 */
export class DafnyRunner implements IDafnyRunner {
  private config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
    EnvironmentConfig.Dafny
  );

  public run(filename: string) {
    const terminal = vscode.window.createTerminal(
      `${Information.Run} ${filename}`
    );
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
    const useMono: boolean =
      this.config.get<boolean>(Config.UseMono) ||
      os.platform() !== EnvironmentConfig.Win32;
    if (useMono) {
      const monoExecutable =
        this.config.get<string>(Config.MonoExecutablePath) ||
        EnvironmentConfig.Mono;
      return `${monoExecutable} "${executable}"`;
    }
    return `& "${executable}"`;
  }
}
