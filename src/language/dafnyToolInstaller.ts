import { LanguageServerConstants } from '../constants';
import { ExtensionContext, OutputChannel, window } from 'vscode';
import { getDotnetExecutablePath } from '../dotnet';
import { getPreferredVersion } from './dafnyInstallation';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { mkdir } from 'fs/promises';
import { promisify } from 'util';
import { Messages } from '../ui/messages';
import { Executable } from 'vscode-languageclient/node';
import { versionToNumeric } from '../ui/dafnyIntegration';
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
    const args = versionToNumeric(version) >= versionToNumeric('3.10') ? newArgs : oldArgs;
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
      console.error('dafny installation failed', error);
    }
    return localToolPath;
  }

  private toolVersionCache: string | undefined;

  private async getDotnetToolVersion(): Promise<string> {
    if(this.toolVersionCache === undefined) {
      this.toolVersionCache = await DafnyToolInstaller.getDotnetToolVersionUncached();
    }
    return this.toolVersionCache;
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
  private static async getDotnetToolVersionUncached(): Promise<string> {
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
      toolVersion = versions.filter(l => l.startsWith(version))[0];
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
      toolVersion = latestNightly;
      window.showInformationMessage(`Using latest nightly version: ${toolVersion}`);
      break;
    }
    default: {
      toolVersion = versions.filter(l => l.startsWith(versionDescription))[0];
    }
    }

    return toolVersion;
  }
  private writeStatus(message: string): void {
    this.statusOutput.appendLine(message);
  }
}