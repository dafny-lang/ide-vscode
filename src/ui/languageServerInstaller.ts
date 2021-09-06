import { StatusBarAlignment, StatusBarItem, window as Window, workspace as Workspace, Disposable, ExtensionContext, Uri, OutputChannel, FileSystemError } from 'vscode';
import { Utils } from 'vscode-uri';

import { fetch } from 'cross-fetch';
import * as extract from 'extract-zip';

import { Messages } from './messages';
import { LanguageServerConstants } from '../constants';

const StatusBarPriority = 10;
const ArchiveFileName = 'dafny.zip';

export default class LanguageServerDownloadView implements Disposable {
  private constructor(
    private readonly context: ExtensionContext,
    private readonly statusOutput: OutputChannel,
    private readonly statusBarItem: StatusBarItem
  ) {}

  public static createAndRegister(context: ExtensionContext, statusOutput: OutputChannel): LanguageServerDownloadView {
    return new LanguageServerDownloadView(
      context,
      statusOutput,
      Window.createStatusBarItem(StatusBarAlignment.Left, StatusBarPriority)
    );
  }

  public async install(): Promise<boolean> {
    this.writeStatus('starting dafny installation');
    this.statusOutput.show();
    await this.cleanInstallDir();
    const archive = await this.downloadArchive('https://github.com/dafny-lang/dafny/releases/download/v3.2.0/dafny-3.2.0-x64-win.zip');
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
      }
    }
  }

  private async downloadArchive(downloadUri: string): Promise<Uri | undefined> {
    this.writeStatus(`downloading dafny from ${downloadUri}`);
    const response = await fetch(downloadUri);
    if(!response.ok) {
      Window.showErrorMessage(Messages.LanguageServer.DownloadFailed + response.statusText);
      return;
    }
    if(response.body == null) {
      Window.showErrorMessage(Messages.LanguageServer.DownloadFailed + Messages.LanguageServer.NoContent);
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

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
