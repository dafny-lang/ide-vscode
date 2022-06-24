import { PromiseWithChild } from 'child_process';
import * as vscode from 'vscode';
import { ConfigurationConstants, LanguageServerConstants } from '../../constants';
import { ExecAsyncType, ExecOutput } from '../../language/dafnyInstallation';
import { MockedOutputChannelBuilder } from './MockedOutputChannelBuilder';
import { MockedWorkspace } from './MockedWorkspace';

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

  /** Helper to create a mocked execAsync that can perform any operation, including throwing exceptions */
  public static mockedExecAsync(commandMap: (command: string) => ExecOutput): ExecAsyncType {
    const result = (function (command: string): Promise<ExecOutput> {
      try {
        return Promise.resolve(commandMap(command));
      } catch(e: unknown) {
        return Promise.reject(e);
      }
    });
    return result as unknown as (command: string) => PromiseWithChild<ExecOutput>;
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
