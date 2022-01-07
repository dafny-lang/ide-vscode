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

// Equivalent to a || b but without ESLint warnings
function ifNullOrEmpty(a: string | null, b: string) {
  return a === null || a === '' ? a : b;
}

export function getCompilerRuntimePath(context: ExtensionContext): string {
  const configuredPath = ifNullOrEmpty(Configuration.get<string | null>(ConfigurationConstants.Compiler.RuntimePath)
    , LanguageServerConstants.DefaultCompilerPath);
  if(!path.isAbsolute(configuredPath)) {
    return path.join(context.extensionPath, configuredPath);
  }
  return configuredPath;
}

export function getLanguageServerRuntimePath(context: ExtensionContext): string {
  const configuredPath = ifNullOrEmpty(getConfiguredLanguageServerRuntimePath(), LanguageServerConstants.DefaultPath);
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
    this.statusOutput.show();
    this.writeStatus('starting Dafny installation');
    try {
      await this.cleanInstallDir();
      const archive = await this.downloadArchive(getDafnyDownloadAddress());
      await this.extractArchive(archive);
      await workspace.fs.delete(archive, { useTrash: false });
      this.writeStatus('Dafny installation completed');
      return true;
    } catch(error: unknown) {
      this.writeStatus('Dafny installation failed:');
      this.writeStatus(`> ${error}`);
      console.error('dafny installation failed', error);
      return false;
    }
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
        throw error;
      }
    }
  }

  private async downloadArchive(downloadUri: string): Promise<Uri> {
    await mkdirAsync(this.getInstallationPath().fsPath, { recursive: true });
    return await new Promise<Uri>((resolve, reject) => {
      const archivePath = this.getZipPath();
      const archiveHandle = fs.createWriteStream(archivePath.fsPath);
      this.writeStatus(`downloading Dafny from ${downloadUri}`);
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

  private async extractArchive(archivePath: Uri): Promise<void> {
    const dirPath = this.getInstallationPath();
    this.writeStatus(`extracting Dafny to ${dirPath.fsPath}`);
    const progressReporter = new ProgressReporter(this.statusOutput);
    await extract(
      archivePath.fsPath,
      {
        dir: dirPath.fsPath,
        onEntry: (_, archive) => progressReporter.update(archive.entriesRead / archive.entryCount)
      }
    );
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
