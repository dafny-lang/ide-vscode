/* eslint-disable max-depth */
import { ExtensionContext, OutputChannel } from 'vscode';
import { ConfigurationConstants } from '../constants';
import Configuration from '../configuration';
import { Executable } from 'vscode-languageclient/node';
import { GitHubReleaseInstaller } from './githubReleaseInstaller';

export class DafnyInstaller {
  public constructor(
    public readonly context: ExtensionContext,
    public readonly statusOutput: OutputChannel
  ) {}

  public async getCliExecutable(newArgs: string[], oldArgs: string[]): Promise<Executable> {
    return await new GitHubReleaseInstaller(this.context, this.statusOutput).getExecutable(newArgs, oldArgs);
  }
}

export function getPreferredVersion(): string {
  return process.env['dafnyIdeVersion'] ?? Configuration.get<string>(ConfigurationConstants.PreferredVersion);
}