/* eslint-disable max-depth */
import { ExtensionContext, OutputChannel } from 'vscode';
import { ConfigurationConstants } from '../constants';
import Configuration from '../configuration';
import { Executable } from 'vscode-languageclient/node';
import { GitHubReleaseInstaller } from './githubReleaseInstaller';
import { CustomPathInstaller } from './customPathInstaller';
import * as os from 'os';
import { FromSourceInstaller } from './fromSourceInstaller';

export class DafnyInstaller {
  private readonly customPathInstaller: CustomPathInstaller;

  public constructor(
    public readonly context: ExtensionContext,
    public readonly statusOutput: OutputChannel
  ) {
    this.customPathInstaller = new CustomPathInstaller(this.context, this.statusOutput);
  }

  public async getCliExecutable(server: boolean, newArgs: string[], oldArgs: string[]): Promise<Executable> {
    const customExecutable = await this.customPathInstaller.getExecutable(this.context, server, newArgs, oldArgs);
    if(customExecutable) {
      return customExecutable;
    }

    if(os.type() === 'Darwin' && os.arch() !== 'x64') {
      // Need to build from source and move all files from Binary/ to the out/resource folder
      const sourceInstaller = new FromSourceInstaller(this.context, this.statusOutput);
      return await sourceInstaller.getExecutable(server, newArgs, oldArgs);
    }
    return await new GitHubReleaseInstaller(this.context, this.statusOutput).getExecutable(server, newArgs, oldArgs);
  }
}

export function getPreferredVersion(): string {
  return process.env['dafnyIdeVersion'] ?? Configuration.get<string>(ConfigurationConstants.Version);
}