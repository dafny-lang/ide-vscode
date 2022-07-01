
import * as vscode from 'vscode';
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

export class MockingUtils {
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
    return {
      subscriptions: [],
      extensionUri: vscode.Uri.parse('/tmp/mockedUri')
    } as unknown as vscode.ExtensionContext;
  }

  public static mockedOutputChannelBuilder(): MockedOutputChannelBuilder {
    return new MockedOutputChannelBuilder();
  }

  public static mockedWorkspace(): MockedWorkspace {
    return new MockedWorkspace({
      [ConfigurationConstants.SectionName]: new Map<string, string>([
        [ ConfigurationConstants.PreferredVersion, LanguageServerConstants.Latest ]
      ])
    });
  }
}
