import { ExtensionContext, FileSystemError, OutputChannel, Uri, window, workspace } from 'vscode';
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
import { DafnyInstaller, getPreferredVersion } from './dafnyInstallation';
import { configuredVersionToNumeric } from '../ui/dafnyIntegration';
const ArchiveFileName = 'dafny.zip';

function getDafnyPlatformSuffix(version: string): string {
  // Since every nightly published after this edit will be configured in the post-3.12 fashion, and this script
  // fetches the latest nightly, it's safe to just condition this on 'nightly' and not 'nightly-date' for a date
  // after a certain point.
  const post411 = version.includes('nightly') || configuredVersionToNumeric(version) >= configuredVersionToNumeric('4.11');
  const post312 = version.includes('nightly') || configuredVersionToNumeric(version) >= configuredVersionToNumeric('3.13');
  if(post411) {
    switch(os.type()) {
    case 'Windows_NT':
      return 'windows-2022';
    case 'Darwin':
      return 'macos-13';
    default:
      return 'ubuntu-22.04';
    }
  } else if(post312) {
    switch(os.type()) {
    case 'Windows_NT':
      return 'windows-2019';
    case 'Darwin':
      return 'macos-11';
    default:
      return 'ubuntu-20.04';
    }
  } else {
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
    const suffix = getDafnyPlatformSuffix(version);
    const arch = await this.getDotnetArchitecture();
    return `${baseUri}/${tag}/dafny-${version}-${arch}-${suffix}.zip`;
  }

  private async getDotnetArchitecture(): Promise<string> {
    if(os.type() === 'Darwin') {
      // On macOS, detect .NET runtime architecture to handle Rosetta translation
      // This is crucial because ARM64 Macs may run .NET in x64 mode via Rosetta
      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        const { stdout } = await execAsync('dotnet --info');
        
        // Look for RID (Runtime Identifier) which shows the actual .NET runtime architecture
        const ridMatch = stdout.match(/RID:\s*osx-(x64|arm64)/);
        if(ridMatch) {
          this.writeStatus(`Detected .NET RID: osx-${ridMatch[1]}`);
          return ridMatch[1]; // Returns 'x64' or 'arm64'
        }
        
        // Fallback: look for Architecture field
        const archMatch = stdout.match(/Architecture:\s*(x64|Arm64)/i);
        if(archMatch) {
          const detectedArch = archMatch[1].toLowerCase() === 'arm64' ? 'arm64' : 'x64';
          this.writeStatus(`Detected .NET Architecture: ${detectedArch}`);
          return detectedArch;
        }
        
        this.writeStatus('Could not parse .NET architecture from dotnet --info output');
      } catch(error: unknown) {
        this.writeStatus(`Failed to detect .NET architecture: ${error}`);
        this.writeStatus('Falling back to system architecture detection');
        
        // Fallback to system architecture detection
        try {
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);
          const { stdout } = await execAsync('uname -m');
          const systemArch = stdout.trim();
          return systemArch === 'x86_64' ? 'x64' : systemArch === 'arm64' ? 'arm64' : 'x64';
        } catch {
          return os.arch();
        }
      }
    }
    
    // For non-macOS systems, use Node.js detection (preserve original behavior)
    return os.arch();
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
    const preferredVersion = getPreferredVersion();
    let version = preferredVersion;
    switch(preferredVersion) {
    case LanguageServerConstants.LatestStable:
      version = await DafnyInstaller.dafny4upgradeCheck(
        this.context,
        preferredVersion,
        LanguageServerConstants.LatestVersion);
      break;
    case LanguageServerConstants.LatestNightly: {
      let name: string | undefined;
      try {
        const result: any = await (await fetch('https://api.github.com/repos/dafny-lang/dafny/releases/tags/nightly')).json();
        if(result.name !== undefined) {
          name = result.name!;
          const versionPrefix = 'Dafny ';
          // eslint-disable-next-line max-depth
          if(name!.startsWith(versionPrefix)) {
            const version = name!.substring(versionPrefix.length);
            this.context.globalState.update('nightly-version', version);
            return [ 'nightly', version ];
          }
        }
      } catch{
        // continue
      }
      // Github has some API limitations on how many times to call its API, so this is a good fallback.
      const cachedVersion = this.context.globalState.get('nightly-version');
      if(cachedVersion !== undefined) {
        version = cachedVersion as string;
        return [ 'nightly', version ];
      }
      window.showWarningMessage('Failed to install latest nightly version of Dafny. Using latest stable version instead.\n'
        + (name !== undefined ? `The name of the nightly release we found was: ${name}` : ''));
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
