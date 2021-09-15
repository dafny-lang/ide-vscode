import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

import { workspace, ExtensionContext, Uri, OutputChannel, FileSystemError } from 'vscode';
import { Utils } from 'vscode-uri';

import got from 'got';
import * as extract from 'extract-zip';

import { ConfigurationConstants, LanguageServerConstants } from '../constants';
import Configuration from '../configuration';

const ArchiveFileName = 'dafny.zip';
const mkdirAsync = promisify(fs.mkdir);

export function getCompilerRuntimePath(context: ExtensionContext): string {
  const configuredPath = Configuration.get<string | null>(ConfigurationConstants.Compiler.RuntimePath)
    ?? LanguageServerConstants.DefaultCompilerPath;
  if(!path.isAbsolute(configuredPath)) {
    return path.join(context.extensionPath, configuredPath);
  }
  return configuredPath;
}

export function getLanguageServerRuntimePath(context: ExtensionContext): string {
  const configuredPath = getConfiguredLanguageServerRuntimePath() ?? LanguageServerConstants.DefaultPath;
  if(path.isAbsolute(configuredPath)) {
    return configuredPath;
  }
  return path.join(context.extensionPath, configuredPath);
}

function getConfiguredLanguageServerRuntimePath(): string | null {
  return Configuration.get<string | null>(ConfigurationConstants.LanguageServer.RuntimePath);
}

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

function getDafnyDownloadAddress(): string {
  const baseUri = LanguageServerConstants.DownloadBaseUri;
  const version = LanguageServerConstants.RequiredVersion;
  const suffix = getDafnyPlatformSuffix();
  return `${baseUri}/v${version}/dafny-${version}-x64-${suffix}.zip`;
}

export class DafnyInstaller {
  public constructor(
    private readonly context: ExtensionContext,
    private readonly statusOutput: OutputChannel
  ) {}

  public static isMinimumRequiredLanguageServer(version: string): boolean {
    if(version === LanguageServerConstants.UnknownVersion) {
      return true;
    }
    const [ givenMajor, givenMinor ] = version.split('.');
    const [ requiredMajor, requiredMinor ] = LanguageServerConstants.RequiredVersion.split('.');
    return givenMajor > requiredMajor
      || givenMajor === requiredMajor && givenMinor >= requiredMinor;
  }

  public async install(): Promise<boolean> {
    this.writeStatus('starting Dafny installation');
    this.statusOutput.show();
    await this.cleanInstallDir();
    const archive = await this.downloadArchive(getDafnyDownloadAddress());
    if(archive == null) {
      return false;
    }
    await this.extractArchive(archive);
    await workspace.fs.delete(archive);
    this.writeStatus('Dafny installation completed');
    return true;
  }

  public isCustomInstallation(): boolean {
    return getConfiguredLanguageServerRuntimePath() != null;
  }

  public async isLanguageServerRuntimeAccessible(): Promise<boolean> {
    const languageServerDll = getLanguageServerRuntimePath(this.context);
    try {
      await fs.promises.access(languageServerDll, fs.constants.R_OK);
      return true;
    } catch(error: unknown) {
      console.error(`cannot access language server: ${error}`);
      return false;
    }
  }

  private async cleanInstallDir(): Promise<void> {
    const installPath = this.getInstallationPath();
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
        this.writeStatus(`error deleting folder: ${error}`);
        throw error;
      }
    }
  }

  private async downloadArchive(downloadUri: string): Promise<Uri | undefined> {
    await mkdirAsync(this.getInstallationPath().fsPath, { recursive: true });
    return await new Promise<Uri | undefined>(resolve => {
      const archivePath = this.getZipPath();
      const archiveHandle = fs.createWriteStream(archivePath.fsPath);
      this.writeStatus(`downloading Dafny from ${downloadUri}`);
      const progressReporter = new ProgressReporter(this.statusOutput);
      archiveHandle
        .on('finish', () => resolve(archivePath))
        .on('error', error => {
          this.writeStatus(`file write error: ${error}`);
          resolve(undefined);
        });
      got.stream(downloadUri)
        .on('error', error => {
          this.writeStatus(`download error: ${error}`);
          resolve(undefined);
        })
        .on('downloadProgress', progress => progressReporter.update(progress))
        .pipe(archiveHandle);
    });
  }

  private async extractArchive(archivePath: Uri): Promise<void> {
    const dirPath = this.getInstallationPath();
    this.writeStatus(`extracting Dafny to ${dirPath.fsPath}`);
    await extract(archivePath.fsPath, { dir: dirPath.fsPath });
  }

  private getZipPath(): Uri {
    return Utils.joinPath(this.getInstallationPath(), ArchiveFileName);
  }

  private getInstallationPath(): Uri {
    return Utils.joinPath(this.context.extensionUri, ...LanguageServerConstants.ResourceFolder);
  }

  private writeStatus(message: string): void {
    this.statusOutput.appendLine(message);
  }
}

// The downloadProgress event is not typed in got (any).
interface IDownloadProgress {
  percent: number;
  transferred: number;
}

class ProgressReporter {
  private lastTenth = -1;

  public constructor(private readonly statusOutput: OutputChannel) {}

  public update(progress: IDownloadProgress) {
    const tenth = Math.round(progress.percent * 10);
    if(tenth > this.lastTenth && progress.transferred > 0) {
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
