import * as os from 'os';

import { workspace as Workspace, ExtensionContext, Uri, OutputChannel, FileSystemError } from 'vscode';
import { Utils } from 'vscode-uri';

import { fetch } from 'cross-fetch';
import * as extract from 'extract-zip';

import { LanguageServerConstants } from '../constants';

const ArchiveFileName = 'dafny.zip';

function getDafnyPlatformSuffix(): string {
  switch (os.type()) {
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

export default class LanguageServerDownloadView {
  public constructor(
    private readonly context: ExtensionContext,
    private readonly statusOutput: OutputChannel
  ) {}

  public async install(): Promise<boolean> {
    this.writeStatus('starting dafny installation');
    this.statusOutput.show();
    await this.cleanInstallDir();
    const archive = await this.downloadArchive(getDafnyDownloadAddress());
    if(archive == null) {
      return false;
    }
    await this.extractArchive(archive);
    await Workspace.fs.delete(archive);
    this.writeStatus('dafny installation completed');
    return true;
  }

  private async cleanInstallDir(): Promise<void> {
    const installPath = this.getInstallationPath();
    this.writeStatus(`deleting previous dafny installation at ${installPath}`);
    try {
      await Workspace.fs.delete(
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
    this.writeStatus(`downloading dafny from ${downloadUri}`);
    const response = await fetch(downloadUri);
    if(!response.ok) {
      this.writeStatus(`dafny download failed: ${response.status} (${response.statusText})`);
      return;
    }
    if(response.body == null) {
      this.writeStatus('dafny download failed: No Content');
      return;
    }
    const content = await response.arrayBuffer();
    const archivePath = this.getZipPath();
    await Workspace.fs.writeFile(archivePath, new Uint8Array(content));
    return archivePath;
  }

  private async extractArchive(archivePath: Uri): Promise<void> {
    const dirPath = this.getInstallationPath();
    this.writeStatus(`extracting dafny to ${dirPath}`);
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
