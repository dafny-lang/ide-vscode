/* eslint-disable max-depth */
import { ExtensionContext, OutputChannel, env, Uri, window } from 'vscode';
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


  public static readonly CurrentVersionTag = 'current-version';

  // If there is a major version bump and the version is auto-selected
  // warn the user before hand
  public static async dafny4upgradeCheck(
    context: ExtensionContext,
    versionDescription: string,
    newToolVersion: string
  ): Promise<string> {
    const previousToolVersion: string | undefined = context.globalState.get(DafnyInstaller.CurrentVersionTag);
    // In case users have not reopened VSCode since this code was added until Dafny 4 is released
    const compareToolVersion: string = previousToolVersion ?? '3.10.0';
    if(!newToolVersion.startsWith(compareToolVersion[0])) {
      const seeMigrationInstructions = 'Show migration instructions';
      const accept = `Accept ${newToolVersion}`;
      const decline = `Keep ${compareToolVersion} for now`;
      let answer: string | undefined = seeMigrationInstructions;

      while(answer === seeMigrationInstructions) {
        // Major version change
        answer = await window.showInformationMessage(
          `Dafny ${newToolVersion} is out! You are using the ${versionDescription.toLowerCase()}, `
          + 'but because this is a major change, we want you to confirm the switch.',
          seeMigrationInstructions,
          accept,
          decline
        );
        if(answer === undefined || answer === decline) {
          newToolVersion = (compareToolVersion !== undefined ? compareToolVersion : newToolVersion) as string;
        } else if(answer === seeMigrationInstructions) {
          env.openExternal(Uri.parse('https://dafny.org/TODO'));
        } else {
          break;
        }
      }
    }
    context.globalState.update(DafnyInstaller.CurrentVersionTag, newToolVersion);
    return newToolVersion;
  }

  public async getCliExecutable(server: boolean, newArgs: string[], oldArgs: string[]): Promise<Executable> {
    const customExecutable = await this.customPathInstaller.getExecutable(this.context, server, newArgs, oldArgs);
    if(customExecutable) {
      return customExecutable;
    }

    const githubExecutable = await new GitHubReleaseInstaller(this.context, this.statusOutput).getExecutable(server, newArgs, oldArgs);
    if(githubExecutable) {
      return githubExecutable;
    }

    if(os.type() === 'Darwin') {
      const sourceInstaller = new FromSourceInstaller(this.context, this.statusOutput);
      return await sourceInstaller.getExecutable(server, newArgs, oldArgs);
    }

    throw new Error('Could not install a Dafny language server.');
  }
}

export function getPreferredVersion(): string {
  return process.env['dafnyIdeVersion'] ?? Configuration.get<string>(ConfigurationConstants.Version);
}