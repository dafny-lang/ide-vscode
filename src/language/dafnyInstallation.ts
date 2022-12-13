/* eslint-disable max-depth */
import { ExtensionContext, OutputChannel } from 'vscode';
import { ConfigurationConstants } from '../constants';
import Configuration from '../configuration';
import { Executable } from 'vscode-languageclient/node';
import { GitHubReleaseInstaller } from './githubReleaseInstaller';
import { getCliPath } from './cliCopier';
import { getDotnetExecutablePath } from '../dotnet';

export class DafnyInstaller {
  public constructor(
    public readonly context: ExtensionContext,
    public readonly statusOutput: OutputChannel
  ) {}

  public async getCliExecutable(server: boolean, newArgs: string[], oldArgs: string[]): Promise<Executable> {
    const { path: dotnetExecutable } = await getDotnetExecutablePath();
    const configuredCliPath = await getCliPath(this.context);
    if(configuredCliPath) {
      if(server) {
        newArgs.unshift('server');
      }
      if(configuredCliPath.endsWith('.dll')) {
        return {
          command: dotnetExecutable,
          args: [ configuredCliPath ].concat(newArgs)
        };
      } else {
        return {
          command: configuredCliPath,
          args: newArgs
        };
      }
    }

    return await new GitHubReleaseInstaller(this.context, this.statusOutput).getExecutable(server, newArgs, oldArgs);
  }
}

export function getPreferredVersion(): string {
  return process.env['dafnyIdeVersion'] ?? Configuration.get<string>(ConfigurationConstants.Version);
}