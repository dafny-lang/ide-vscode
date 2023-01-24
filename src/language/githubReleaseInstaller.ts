import { ExtensionContext, FileSystemError, OutputChannel, Uri, env, window, workspace } from 'vscode';
import { LanguageServerConstants } from '../constants';
import * as os from 'os';
import fetch from 'cross-fetch';
import extract = require('extract-zip');
import * as fs from 'fs';
import got from 'got/dist/source';
import { promisify } from 'util';
import { Utils } from 'vscode-uri';
const mkdirAsync = promisify(fs.mkdir);
import { Executable } from 'vscode-languageclient/node';
import { getDotnetExecutablePath } from '../dotnet';
import path = require('path');
import { getPreferredVersion } from './dafnyInstallation';
import { configuredVersionToNumeric } from '../ui/dafnyIntegration';
const ArchiveFileName = 'dafny.zip';

function getDafnyPlatformSuffix(): string {
  switch(os.type()) {
  case 'Windows_NT':
    return 'win';
  case 'Darwin':
    if(os.arch() === 'arm64') {
      return 'osx-11.0';
    } else {
      return 'osx-10.14.2';
    }
  default:
    return 'ubuntu-16.04';
  }
}

export class GitHubReleaseInstaller {
  public constructor(
    public readonly context: ExtensionContext,
    public readonly statusOutput: OutputChannel
  ) {}

  public async getExecutable(server: boolean, newArgs: string[], oldArgs: string[]): Promise<Executable | undefined> {
    const version = getPreferredVersion();
    const { path: dotnetExecutable } = await getDotnetExecutablePath();

    const cliPath = path.join((await this.getInstallationPath()).fsPath, 'dafny', 'Dafny.dll');
    if(!fs.existsSync(cliPath)) {
      const installed = await this.install();
      if(!installed) {
        return undefined;
      }
    }

    if(!server || configuredVersionToNumeric(version) >= configuredVersionToNumeric('3.10')) {
      if(server) {
        newArgs.unshift('server');
      }
      return { command: dotnetExecutable, args: [ cliPath, ...newArgs ] };
    } else {
      const standaloneServerpath = path.join((await (this.getInstallationPath())).fsPath, 'dafny', 'DafnyLanguageServer.dll');
      return { command: dotnetExecutable, args: [ standaloneServerpath, ...oldArgs ] };
    }
  }

  private async install(): Promise<boolean> {
    this.statusOutput.show();
    const startMessage = 'Standalone language server installation started.';
    window.showInformationMessage(startMessage);
    this.writeStatus(startMessage);
    try {
      await this.cleanInstallDir(await this.getInstallationPath());
      const archive = await this.downloadArchive(await this.getDafnyDownloadAddress(), 'Dafny');
      await this.extractArchive(archive, 'Dafny');
      await workspace.fs.delete(archive, { useTrash: false });
      const finishMessage = 'Standalone language server installation completed.';
      window.showInformationMessage(finishMessage);
      this.writeStatus(finishMessage);
      return true;
    } catch(error: unknown) {
      this.writeStatus('Standalone language server installation failed:');
      this.writeStatus(`> ${error}`);
      return false;
    }
  }

  public async cleanInstallDir(installPath: Uri): Promise<void> {
    this.writeStatus(`deleting previous Dafny installation at ${installPath.fsPath}`);
    try {
      await workspace.fs.delete(
        installPath,
        {
          recursive: true,
          useTrash: false
        }
      );
    } catch(error: unknown) {
      if(!(error instanceof FileSystemError) || error.code !== 'FileNotFound') {
        throw error;
      }
    }
  }

  private async getDafnyDownloadAddress(): Promise<string> {
    const baseUri = LanguageServerConstants.DownloadBaseUri;
    const [ tag, version ] = await this.getConfiguredTagAndVersion();
    const suffix = getDafnyPlatformSuffix();
    return `${baseUri}/${tag}/dafny-${version}-${os.arch()}-${suffix}.zip`;
  }

  public async getConfiguredVersion(): Promise<string> {
    const [ _, version ] = await this.getConfiguredTagAndVersion();
    return version;
  }

  private getConfiguredTagAndVersionCache: [string, string] | undefined;

  private async getConfiguredTagAndVersion(): Promise<[string, string]> {
    if(this.getConfiguredTagAndVersionCache === undefined) {
      const result = await this.getConfiguredGitTagAndVersionUncached();
      if(this.getConfiguredTagAndVersionCache === undefined) {
        this.getConfiguredTagAndVersionCache = result;
      }
    }
    return this.getConfiguredTagAndVersionCache;
  }

  public static readonly CurrentVersionTag = 'current-version';

  // If there is a major version bump and the version is auto-selected
  // warn the user before hand
  private static async dafny4upgradeCheck(
    context: ExtensionContext,
    versionDescription: string,
    newToolVersion: string
  ): Promise<string> {
    const previousToolVersion: string | undefined = context.globalState.get(GitHubReleaseInstaller.CurrentVersionTag);
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
    context.globalState.update(GitHubReleaseInstaller.CurrentVersionTag, newToolVersion);
    return newToolVersion;
  }

  private async getConfiguredGitTagAndVersionUncached(): Promise<[string, string]> {
    const preferredVersion = getPreferredVersion();
    let version = preferredVersion;
    switch(preferredVersion) {
    case LanguageServerConstants.LatestStable:
      version = await GitHubReleaseInstaller.dafny4upgradeCheck(
        this.context,
        preferredVersion,
        LanguageServerConstants.LatestVersion);
      break;
    case LanguageServerConstants.LatestNightly: {
      const result: any = await (await fetch('https://api.github.com/repos/dafny-lang/dafny/releases/tags/nightly')).json();
      if(result.name !== undefined) {
        const name: string = result.name;
        const versionPrefix = 'Dafny ';
        if(name.startsWith(versionPrefix)) {
          let version = name.substring(versionPrefix.length);
          this.context.globalState.update('nightly-version', version);
          version = await GitHubReleaseInstaller.dafny4upgradeCheck(
            this.context,
            preferredVersion,
            version);
          return [ 'nightly', version ];
        }
      }
      // Github has some API limitations on how many times to call its API, so this is a good fallback.
      const cachedVersion = this.context.globalState.get('nightly-version');
      if(cachedVersion !== undefined) {
        version = cachedVersion as string;
        version = await GitHubReleaseInstaller.dafny4upgradeCheck(
          this.context,
          preferredVersion,
          version);
        return [ 'nightly', version ];
      }
      window.showWarningMessage('Failed to install latest nightly version of Dafny. Using latest stable version instead.\n'
        + `The name of the nightly release we found was: ${result.name}`);
      version = LanguageServerConstants.LatestVersion;
      version = await GitHubReleaseInstaller.dafny4upgradeCheck(
        this.context,
        preferredVersion,
        version);
    }
    }
    return [ `v${version}`, version ];
  }

  public async downloadArchive(downloadUri: string, downloadTarget: string): Promise<Uri> {
    await mkdirAsync((await this.getInstallationPath()).fsPath, { recursive: true });
    const archivePath = await this.getZipPath();
    return await new Promise<Uri>((resolve, reject) => {
      const archiveHandle = fs.createWriteStream(archivePath.fsPath);
      this.writeStatus(`downloading ${downloadTarget} from ${downloadUri}`);
      const progressReporter = new ProgressReporter(this.statusOutput);
      archiveHandle
        .on('finish', () => resolve(archivePath))
        .on('error', error => reject(error));
      got.stream(downloadUri)
        .on('error', error => reject(error))
        .on('downloadProgress', progress => progressReporter.updateDownloadProgress(progress))
        .pipe(archiveHandle);
    });
  }

  public async extractArchive(archivePath: Uri, extractName: string): Promise<void> {
    const dirPath = await this.getInstallationPath();
    this.writeStatus(`extracting ${extractName} to ${dirPath.fsPath}`);
    const progressReporter = new ProgressReporter(this.statusOutput);
    await extract(
      archivePath.fsPath,
      {
        dir: dirPath.fsPath,
        onEntry: (_, archive) => progressReporter.update(archive.entriesRead / archive.entryCount)
      }
    );
  }

  public async getInstallationPath(): Promise<Uri> {
    return Utils.joinPath(
      this.context.extensionUri,
      ...LanguageServerConstants.GetResourceFolder(await this.getConfiguredVersion()),
      'github'
    );
  }

  private async getZipPath(): Promise<Uri> {
    return Utils.joinPath(await this.getInstallationPath(), ArchiveFileName);
  }

  private writeStatus(message: string): void {
    this.statusOutput.appendLine(message);
  }
}

class ProgressReporter {
  private lastTenth = -1;

  public constructor(private readonly statusOutput: OutputChannel) {}

  public updateDownloadProgress(progress: { percent: number, transferred: number }) {
    if(progress.transferred > 0) {
      // The transferred byte count has to be checked since got reports percent=1 at the beginning.
      this.update(progress.percent);
    }
  }

  public update(percent: number) {
    const tenth = Math.round(percent * 10);
    if(tenth > this.lastTenth) {
      this.statusOutput.append(`${tenth * 10}%`);
      if(tenth === 10) {
        this.statusOutput.appendLine('');
      } else {
        this.statusOutput.append('...');
      }
      this.lastTenth = tenth;
    }
  }
}