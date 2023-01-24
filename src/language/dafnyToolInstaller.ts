import { LanguageServerConstants } from '../constants';
import { ExtensionContext, OutputChannel, window, env, Uri } from 'vscode';
import { getDotnetExecutablePath } from '../dotnet';
import { getPreferredVersion } from './dafnyInstallation';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { mkdir } from 'fs/promises';
import { promisify } from 'util';
import { Messages } from '../ui/messages';
import { Executable } from 'vscode-languageclient/node';
import { configuredVersionToNumeric } from '../ui/dafnyIntegration';
const execFileAsync = promisify(execFile);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class DafnyToolInstaller {
  public constructor(
    public readonly context: ExtensionContext,
    public readonly statusOutput: OutputChannel
  ) {}

  public async getExecutable(newArgs: string[], oldArgs: string[]): Promise<Executable> {
    const { path: dotnetExecutable } = await getDotnetExecutablePath();
    const localToolPath = await this.ensureDafnyIsInstalled();
    const version = getPreferredVersion();
    const args = configuredVersionToNumeric(version) >= configuredVersionToNumeric('3.10') ? newArgs : oldArgs;
    return {
      command: dotnetExecutable,
      args: [ 'tool', 'run', 'dafny' ].concat(args),
      options: { cwd: localToolPath }
    };
  }

  private async ensureDafnyIsInstalled(): Promise<string> {
    const { path: dotnetExecutable } = await getDotnetExecutablePath();
    const toolVersion = await this.getDotnetToolVersion();
    const localToolPath = path.join(this.context.extensionPath, `out/resources/${toolVersion}/`);
    if(fs.existsSync(localToolPath)) {
      return localToolPath;
    }

    try {
      await mkdir(localToolPath, { recursive: true });
      await execFileAsync(dotnetExecutable, [ 'new', 'tool-manifest' ], { cwd: localToolPath });
      this.statusOutput.show();
      window.showInformationMessage(Messages.Installation.Start);
      this.writeStatus(Messages.Installation.Start);
      await execFileAsync(dotnetExecutable, [ 'tool', 'install', 'Dafny', '--version', toolVersion ], { cwd: localToolPath });
      await execFileAsync(dotnetExecutable, [ 'tool', 'run', 'dafny', '/version' ], { cwd: localToolPath });
      window.showInformationMessage(Messages.Installation.Completed);
      this.writeStatus(Messages.Installation.Completed);
    } catch(error: unknown) {
      window.showErrorMessage(Messages.Installation.Error);
      this.writeStatus(Messages.Installation.Error);
      this.writeStatus(`> ${error}`);
    }
    return localToolPath;
  }

  private toolVersionCache: string | undefined;

  public static readonly CurrentVersionTag = 'current-version';

  private async getDotnetToolVersion(): Promise<string> {
    if(this.toolVersionCache === undefined) {
      this.toolVersionCache = await DafnyToolInstaller.getDotnetToolVersionUncached(this.context);
    }
    return this.toolVersionCache;
  }
  // If there is a major version bump and the version is auto-selected
  // warn the user before hand
  private static async dafny4upgradeCheck(
    context: ExtensionContext,
    versionDescription: string,
    newToolVersion: string
  ): Promise<string> {
    const previousToolVersion: string | undefined = context.globalState.get(DafnyToolInstaller.CurrentVersionTag);
    // In case users have not reopened VSCode since this code was added until Dafny 4 is released
    const compareToolVersion: string = previousToolVersion ?? '3.10.0';
    if(!newToolVersion.startsWith(compareToolVersion[0])) {
      const seeMigrationInstructions = 'Show migration instructions';
      const accept = `Accept ${newToolVersion}`;
      const decline = `Keep ${compareToolVersion}for now`;
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
    context.globalState.update(DafnyToolInstaller.CurrentVersionTag, newToolVersion);
    return newToolVersion;
  }

  /**
   *  Example output from 'dotnet tool search dafny --detail --prerelease'
   *  dafny
      Latest Version: 3.10.0.41129-nightly-2022-11-29-bbeaf03
      Authors: Dafny
      Tags:
      Downloads: 9576
      Verified: False
      Description: Package Description
      Versions:
              3.7.0.40620 Downloads: 500
              3.7.1.40621-nightly-2022-07-09-141433c Downloads: 104
              3.7.1.40621 Downloads: 754
              3.7.2.40713 Downloads: 324
   */
  private static async getDotnetToolVersionUncached(context: ExtensionContext): Promise<string> {
    const { path: dotnetExecutable } = await getDotnetExecutablePath();
    const { stdout } = await execFileAsync(dotnetExecutable, [ 'tool', 'search', 'Dafny', '--detail', '--prerelease' ]);
    const entries = stdout.split('----------------').map(entry => entry.split('\n').filter(e => e !== ''));
    const dafnyEntry = entries.filter(entry => entry[0] === 'dafny')[0];
    const versionsIndex = dafnyEntry.findIndex(v => v.startsWith('Versions:'));
    const versions = dafnyEntry.slice(versionsIndex + 1).map(versionLine => versionLine.trimStart().split(' ')[0]);

    const versionDescription = getPreferredVersion();
    let toolVersion: string;

    switch(versionDescription) {
    case LanguageServerConstants.LatestStable: {
      const version = LanguageServerConstants.LatestVersion;
      toolVersion = await DafnyToolInstaller.dafny4upgradeCheck(
        context, versionDescription, versions.filter(l => l.startsWith(version))[0]);
      window.showInformationMessage(`Using latest stable version: ${toolVersion}`);
      break;
    }
    case LanguageServerConstants.LatestNightly: {
      const nightlies = versions.filter(l => l.includes('nightly'));
      const dates: { index: number, date: string }[] = nightlies.map((n, index) => {
        const split: string[] = n.split('-');
        return { index, date: split[2] + split[3] + split[4] };
      });
      dates.sort((a, b) => a.date < b.date ? 1 : -1);
      const latestNightly = nightlies[dates[0].index];
      toolVersion = await DafnyToolInstaller.dafny4upgradeCheck(
        context, versionDescription, latestNightly);
      window.showInformationMessage(`Using latest nightly version: ${toolVersion}`);
      break;
    }
    default: {
      toolVersion = versions.filter(l => l.startsWith(versionDescription))[0];
      context.globalState.update(DafnyToolInstaller.CurrentVersionTag, versionDescription);
    }
    }
    return toolVersion;
  }
  private writeStatus(message: string): void {
    this.statusOutput.appendLine(message);
  }
}