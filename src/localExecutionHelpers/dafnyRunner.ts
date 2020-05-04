"use strict";
import * as os from "os";
import * as vscode from "vscode";
import { Config, EnvironmentConfig } from "../stringRessources/commands";

/*
 * This class is used for running dafny files after they are compiled
 * Therefore it also supports mono for macOS / Linux
 */
export class DafnyRunner {
  private config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
    EnvironmentConfig.Dafny
  );

  public run(filename: string) {
    const terminal = vscode.window.createTerminal("Run " + filename);
    const command = this.getCommand(filename);
    console.log(command);
    terminal.show();
    terminal.sendText(command);
  }

  private getCommand(filename: string): string {
    const executable = filename.replace(".dfy", ".exe");
    const useMono: boolean =
      this.config.get<boolean>(Config.UseMono) ||
      os.platform() !== EnvironmentConfig.Win32;
    if (!useMono) {
      return `& "${executable}"`;
    } else {
      const monoPath = this.config.get<string>(Config.MonoPath);
      const monoExecutable =
        this.config.get<string>(Config.MonoExecutable) || monoPath || "mono";
      return `${monoExecutable} "${executable}"`;
    }
  }
}
