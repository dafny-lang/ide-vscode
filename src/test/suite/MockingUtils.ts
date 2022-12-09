
import * as vscode from 'vscode';
import { Disposable } from 'vscode-languageclient';
import { ConfigurationConstants, LanguageServerConstants } from '../../constants';
import { MockedOutputChannelBuilder } from './MockedOutputChannelBuilder';
import { MockedWorkspace } from './MockedWorkspace';

export interface ExecOutput {
  stdout: string;
  stderr: string;
}
export class MockingExec {
  public stub: (command: string, callback: (error: unknown, stdout: string, stderr: string) => void) => void;

  public constructor() {
    this.stub = (command: string) => {
      throw `Unexpected command ${command}`;
    };
  }

  public set(commandMap: (command: string) => { stdout: string, stderr: string }): void {
    this.stub = (function (command: string, callback: (error: unknown | null, stdout: string, stderr: string) => void): void {
      const commandResult = commandMap(command);
      callback(null, commandResult.stdout, commandResult.stderr);
    });
  }
}

export interface CommandsType {
  registeredCommands: { [command: string]: () => void };
  registerCommand(s: string, callback: () => void): Disposable;
}

export class MockedCommands implements CommandsType {
  public registeredCommands: { [command: string]: () => void } = {};

  public registerCommand(command: string, callback: () => void): Disposable {
    this.registeredCommands[command] = callback;
    const self = this;
    return {
      dispose() {
        for(const existingCommand in self.registeredCommands) {
          if(existingCommand === command && self.registeredCommands[existingCommand] === callback) {
            delete self.registeredCommands[existingCommand];
          }
        }
      }
    };
  }
}

export class MockingUtils {
  public static mockedCommands(): CommandsType {
    return new MockedCommands();
  }
  /** Helper to create a commandMap from a command */
  public static simpleCommandMap(executionTable: { [command: string]: ExecOutput }): (command: string) => ExecOutput {
    return (command: string) => {
      if(command in executionTable) {
        return executionTable[command];
      }
      throw `Command ${command} not defined in execution table`;
    };
  }

  public static mockedContext(): vscode.ExtensionContext {
    const internalMap = new Map<string, string>();
    return {
      subscriptions: [],
      extensionUri: vscode.Uri.parse('/tmp/mockedUri'),
      extensionPath: '<extension path>',
      globalState: {
        update(key: string, value: string) {
          internalMap.set(key, value);
        },
        get(key: string) {
          return internalMap.get(key);
        }
      }
    } as unknown as vscode.ExtensionContext;
  }

  public static mockedOutputChannelBuilder(): MockedOutputChannelBuilder {
    return new MockedOutputChannelBuilder();
  }

  public static mockedWorkspace(): MockedWorkspace {
    return new MockedWorkspace({
      [ConfigurationConstants.SectionName]: new Map<string, any>([
        [ ConfigurationConstants.PreferredVersion, LanguageServerConstants.LatestStable ],
        [ ConfigurationConstants.Compiler.CommandPrefix, '<compiler command prefix>' ],
        [ ConfigurationConstants.Dotnet.ExecutablePath, '<dotnet executable path>' ],
        [ ConfigurationConstants.Compiler.Arguments, [ '/out', '<arg1>', 'arg2' ] ],
        [ ConfigurationConstants.Compiler.OutputDir, [ '<compiler output dir>' ] ]
      ])
    });
  }
}