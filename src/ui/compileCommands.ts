import * as os from 'os';
import * as path from 'path';

import { window as Window, commands as Commands, Disposable } from 'vscode';
import { DafnyCommands } from '../commands';

import Configuration from '../configuration';
import { ConfigurationConstants, LanguageServerConstants } from '../constants';
import { getDotnetExecutablePath } from '../dotnet';
import { Messages } from './messages';

const CompileArg = '/compile';
const OutputPathArg = '/out';

export default class CompileCommands {
  private constructor(private readonly commandRegistrations: Disposable) { }

  public static createAndRegister() {
    return new CompileCommands(
      Disposable.from(
        Commands.registerCommand(DafnyCommands.Compile, () => compileAndRun(false, false)),
        Commands.registerCommand(DafnyCommands.CompileCustomArgs, () => compileAndRun(true, false)),
        Commands.registerCommand(DafnyCommands.CompileAndRun, () => compileAndRun(false, true)),
      )
    );
  }

  dispose(): void {
    this.commandRegistrations.dispose();
  }
}

async function compileAndRun(useCustomArgs: boolean, run: boolean): Promise<boolean> {
  const document = Window.activeTextEditor?.document;
  if(document == null || !await document.save()) {
    return false;
  }
  const compilerCommand = await new CommandFactory(document.fileName, useCustomArgs, run).createCompilerCommand();
  if(compilerCommand == null) {
    return false;
  }
  runCommandInTerminal(compilerCommand);
  return true;
}

function runCommandInTerminal(command: string) {
  const terminal = Window.activeTerminal ?? Window.createTerminal();
  terminal.show();
  console.log(command);
  terminal.sendText(command);
}

class CommandFactory {
  constructor(
    private readonly fileName: string,
    private readonly useCustomArgs: boolean,
    private readonly run: boolean
  ) {}

  public async createCompilerCommand(): Promise<string | undefined> {
    const commandPrefix = this.getCommandPrefix();
    const dotnetPath = await getDotnetExecutablePath();
    const compilerPath = this.getCompilerRuntimePath();
    const compilerArgs = await this.getCompilerArgs();
    if(compilerArgs == null) {
      return undefined;
    }
    return  `${commandPrefix}"${dotnetPath}" "${compilerPath}" "${this.fileName}" ${compilerArgs}`;
  }

  private getCompilerRuntimePath(): string {
    const configuredPath = Configuration.getOptional<string>(ConfigurationConstants.Compiler.RuntimePath)
      ?? LanguageServerConstants.DefaultCompilerPath;
    if(!path.isAbsolute(configuredPath)) {
      return path.join(__dirname, configuredPath);
    }
    return configuredPath;
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
    const customArgs = await Window.showInputBox({
      value: originalArgs,
      prompt: Messages.Compiler.CustomArgumentsPrompt
    });
    if(customArgs == null) {
      Window.showErrorMessage(Messages.Compiler.NoArgumentsGiven);
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
    return [ ...args.filter(arg => !arg.includes(CompileArg)), `${CompileArg}:3` ];
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
