import { ExtensionContext, FileSystemError, OutputChannel, Uri, window, workspace } from 'vscode';
import { LanguageServerConstants } from '../constants';
import * as os from 'os';
import fetch from 'cross-fetch';
import { SourceInstaller } from './sourceInstaller';
import extract = require('extract-zip');
import * as fs from 'fs';
import got from 'got/dist/source';
import { promisify } from 'util';
import { Utils } from 'vscode-uri';
const mkdirAsync = promisify(fs.mkdir);
import { execFile } from 'child_process';
import { Executable } from 'vscode-languageclient/node';
import { getDotnetExecutablePath } from '../dotnet';
import { Messages } from '../ui/messages';
import path = require('path');
const execFileAsync = promisify(execFile);
const ArchiveFileName = 'dafny.zip';

function getDafnyPlatformSuffix(): string {
  switch(os.type()) {
  case 'Windows_NT':
    return 'win';
  case 'Darwin':
    return 'osx-10.14.2';
  default:
    return 'ubuntu-16.04';
  }
}

export class StandaloneLanguageServerInstaller {
  public constructor(
    public readonly context: ExtensionContext,
    private readonly preferredVersion: string,
    public readonly statusOutput: OutputChannel
  ) {}

  public async getExecutable(args: string[]): Promise<Executable> {
    const { path: dotnetExecutable } = await getDotnetExecutablePath();
    let dllPath = LanguageServerConstants.GetDefaultPath(await this.getConfiguredVersion());
    if(dllPath && !path.isAbsolute(dllPath)) {
      dllPath = path.join(this.context.extensionPath, dllPath);
    }

    if(!fs.existsSync(dllPath)) {
      const installed = await this.install();
      if(!installed) {
        throw new Error(Messages.Installation.Error);
      }
    }

    return { command: dotnetExecutable, args: [ dllPath, ...args ] };
  }

  private async install(): Promise<boolean> {
    try {
      await this.cleanInstallDir();
      if(os.type() === 'Darwin' && os.arch() !== 'x64') {
        // Need to build from source and move all files from Binary/ to the out/resource folder
        this.writeStatus(`Found a non-supported architecture OSX:${os.arch()}. Going to install from source.`);
        const sourceInstaller = new SourceInstaller(this);
        return await sourceInstaller.installFromSource();
      } else {
        const archive = await this.downloadArchive(await this.getDafnyDownloadAddress(), 'Dafny');
        await this.extractArchive(archive, 'Dafny');
        await workspace.fs.delete(archive, { useTrash: false });
        this.writeStatus(Messages.Installation.Completed);
        return true;
      }
    } catch(error: unknown) {
      this.writeStatus('Dafny installation failed:');
      this.writeStatus(`> ${error}`);
      console.error('dafny installation failed', error);
      return false;
    }
  }

  private async cleanInstallDir(): Promise<void> {
    const installPath = await this.getInstallationPath();
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
    return `${baseUri}/${tag}/dafny-${version}-x64-${suffix}.zip`;
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

  private async getConfiguredGitTagAndVersionUncached(): Promise<[string, string]> {
    let version = this.preferredVersion;
    switch(this.preferredVersion) {
    case LanguageServerConstants.LatestStable:
      version = LanguageServerConstants.LatestVersion;
      break;
    case LanguageServerConstants.LatestNightly: {
      const result: any = await (await fetch('https://api.github.com/repos/dafny-lang/dafny/releases/tags/nightly')).json();
      if(result.name !== undefined) {
        const name: string = result.name;
        const versionPrefix = 'Dafny ';
        if(name.startsWith(versionPrefix)) {
          const version = name.substring(versionPrefix.length);
          this.context.globalState.update('nightly-version', version);
          return [ 'nightly', version ];
        }
      }
      // Github has some API limitations on how many times to call its API, so this is a good fallback.
      const cachedVersion = this.context.globalState.get('nightly-version');
      if(cachedVersion !== undefined) {
        return [ 'nightly', cachedVersion as string ];
      }
      window.showWarningMessage('Failed to install latest nightly version of Dafny. Using latest stable version instead.\n'
        + `The name of the nightly release we found was: ${result.name}`);
      version = LanguageServerConstants.LatestVersion;
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
      ...LanguageServerConstants.GetResourceFolder(await this.getConfiguredVersion())
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