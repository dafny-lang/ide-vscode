import * as os from 'os';
import * as path from 'path';

import { window, commands, ExtensionContext } from 'vscode';
import { DafnyCommands, VSCodeCommands } from '../commands';

import Configuration from '../configuration';
import { ConfigurationConstants } from '../constants';
import { getDotnetExecutablePath } from '../dotnet';
import { getCompilerRuntimePath } from '../language/dafnyInstallation';
import { Messages } from './messages';

const CompileArg = '/compile';
const CompileAndRunArg = `${CompileArg}:3`;
const OutputPathArg = '/out';

export default class CompileCommands {
  public static createAndRegister(context: ExtensionContext): CompileCommands {
    context.subscriptions.push(
      commands.registerCommand(DafnyCommands.Compile, () => compileAndRun(context, false, false)),
      commands.registerCommand(DafnyCommands.CompileCustomArgs, () => compileAndRun(context, true, false)),
      commands.registerCommand(DafnyCommands.CompileAndRun, () => compileAndRun(context, false, true))
    );
    return new CompileCommands();
  }
}

async function compileAndRun(context: ExtensionContext, useCustomArgs: boolean, run: boolean): Promise<boolean> {
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
  const compilerCommand = await new CommandFactory(context, document.fileName, useCustomArgs, run).createCompilerCommand();
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
    private readonly context: ExtensionContext,
    private readonly fileName: string,
    private readonly useCustomArgs: boolean,
    private readonly run: boolean
  ) {}

  public async createCompilerCommand(): Promise<string | undefined> {
    const commandPrefix = this.getCommandPrefix();
    const dotnetPath = await getDotnetExecutablePath();
    const compilerPath = getCompilerRuntimePath(this.context);
    const compilerArgs = await this.getCompilerArgs();
    if(compilerArgs == null) {
      return undefined;
    }
    return `${commandPrefix}"${dotnetPath}" "${compilerPath}" "${this.fileName}" ${compilerArgs}`;
  }

  private getCommandPrefix(): string {
    return Configuration.get<string | null>(ConfigurationConstants.Compiler.CommandPrefix)
      ?? (os.type() === 'Windows_NT' ? '& ' : '');
  }

  private async getCompilerArgs(): Promise<string | undefined> {
    const configuredArgs = this.getConfiguredArgs().join(' ');
    return this.useCustomArgs
      ? await this.getCustomCompilerArgs(configuredArgs)
      : configuredArgs;
  }

  private async getCustomCompilerArgs(originalArgs: string): Promise<string | undefined> {
    const customArgs = await window.showInputBox({
      value: originalArgs,
      prompt: Messages.Compiler.CustomArgumentsPrompt
    });
    if(customArgs == null) {
      window.showErrorMessage(Messages.Compiler.NoArgumentsGiven);
    }
    return customArgs;
  }

  private getConfiguredArgs(): string[] {
    let configuredArgs = Configuration.get<string[]>(ConfigurationConstants.Compiler.Arguments);
    configuredArgs = this.withCompileAndRun(configuredArgs);
    configuredArgs = this.withOutputPath(configuredArgs);
    return configuredArgs;
  }

  private withCompileAndRun(args: string[]): string[] {
    if(!this.run) {
      return args;
    }
    return [ ...args.filter(arg => !arg.includes(CompileArg)), CompileAndRunArg ];
  }

  private withOutputPath(args: string[]): string[] {
    if(args.some(arg => arg.includes(OutputPathArg))) {
      return args;
    }
    const outputDir = Configuration.get<string>(ConfigurationConstants.Compiler.OutputDir);
    const outputPath = path.join(outputDir, path.parse(this.fileName).name);
    return [ ...args, `${OutputPathArg}:${outputPath}` ];
  }
}
