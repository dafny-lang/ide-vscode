import * as os from 'os';
import * as path from 'path';

import { window, commands } from 'vscode';
import { DafnyCommands, VSCodeCommands } from '../commands';

import Configuration from '../configuration';
import { ConfigurationConstants } from '../constants';
import { DafnyInstaller } from '../language/dafnyInstallation';
import { Messages } from './messages';

const OutputPathArg = '--output';

export default class CompileCommands {
  public static createAndRegister(installer: DafnyInstaller): CompileCommands {
    installer.context.subscriptions.push(
      commands.registerCommand(DafnyCommands.Build, () => buildOrRun(installer, false, false)),
      commands.registerCommand(DafnyCommands.BuildCustomArgs, () => buildOrRun(installer, true, false)),
      commands.registerCommand(DafnyCommands.Run, () => buildOrRun(installer, false, true))
    );
    return new CompileCommands();
  }
}

async function buildOrRun(installer: DafnyInstaller, useCustomArgs: boolean, run: boolean): Promise<boolean> {
  const document = window.activeTextEditor?.document;
  if(document == null) {
    return false;
  }
  if(document.isUntitled) {
    commands.executeCommand(VSCodeCommands.SaveAs);
    return false;
  }
  if(!await document.save()) {
    return false;
  }
  const compilerCommand = await new CommandFactory(installer, document.fileName, useCustomArgs, run).createCompilerCommand();
  if(compilerCommand == null) {
    return false;
  }
  runCommandInTerminal(compilerCommand);
  return true;
}

function runCommandInTerminal(command: string): void {
  const terminal = window.activeTerminal ?? window.createTerminal();
  terminal.show();
  terminal.sendText(command);
}

class CommandFactory {
  public constructor(
    private readonly installer: DafnyInstaller,
    private readonly fileName: string,
    private readonly useCustomArgs: boolean,
    private readonly run: boolean
  ) {}

  public async createCompilerCommand(): Promise<string | undefined> {
    const commandPrefix = this.getCommandPrefix();
    const compilerArgs = await this.getCompilerArgs();
    const compilerPath = await this.installer.getCliExecutable(false, compilerArgs, compilerArgs);
    if(compilerArgs == null) {
      return undefined;
    }
    let result = `${commandPrefix}"${compilerPath.command}" ${compilerPath.args?.join(' ')} "${this.fileName}"`;
    if(compilerPath.options?.cwd !== undefined) {
      result = `cd ${compilerPath.options?.cwd}; ${result}`;
    }
    return result;
  }

  private getCommandPrefix(): string {
    return Configuration.get<string | null>(ConfigurationConstants.Compiler.CommandPrefix)
      ?? (os.type() === 'Windows_NT' ? '& ' : '');
  }

  private async getCompilerArgs(): Promise<string[]> {
    const configuredArgs = this.getConfiguredArgs();
    return this.useCustomArgs
      ? (await this.getCustomCompilerArgs(configuredArgs) ?? [])
      : configuredArgs;
  }

  private async getCustomCompilerArgs(originalArgs: string[]): Promise<string[]> {
    const customArgs = await window.showInputBox({
      value: originalArgs.join(' '),
      prompt: Messages.Compiler.CustomArgumentsPrompt
    });
    if(customArgs == null) {
      window.showErrorMessage(Messages.Compiler.NoArgumentsGiven);
    }
    return customArgs?.split(' ') ?? [];
  }

  private getConfiguredArgs(): string[] {
    let configuredArgs = Configuration.get<string[]>(ConfigurationConstants.Compiler.Arguments);
    configuredArgs = this.withCompileAndRun(configuredArgs);
    configuredArgs = this.withOutputPath(configuredArgs);
    return configuredArgs;
  }

  private withCompileAndRun(args: string[]): string[] {
    if(this.run) {
      return [ 'run', ...args ];
    }
    return [ 'build', ...args ];
  }

  private withOutputPath(args: string[]): string[] {
    if(this.run) {
      return args;
    }
    if(args.some(arg => arg.includes(OutputPathArg))) {
      return args;
    }
    const outputDir = Configuration.get<string>(ConfigurationConstants.Compiler.OutputDir);
    const outputPath = path.join(outputDir, path.parse(this.fileName).name);
    return [ ...args, `${OutputPathArg}:${outputPath}` ];
  }
}
