import { window, commands, ExtensionContext } from 'vscode';
import { DafnyCommands } from '../commands';
import * as vscode from 'vscode';
import { chdir as processChdir, cwd as processCwd } from 'process';
import * as fs from 'fs';
import { promisify } from 'util';
import CompilationStatusView from './compilationStatusView';
import { Messages } from './messages';

const readFileAsync = promisify(fs.readFile);

export const fileIssueURL = async (dafnyVersion: string, context: ExtensionContext): Promise<string> => 'https://github.com/dafny-lang/ide-vscode/issues/new?title='
+ encodeURIComponent('Verification issue')
+ '&body='
+ encodeURIComponent(`
Failing code
------------

<!--paste relevant code below-->
\`\`\`dafny

\`\`\`

Steps to reproduce the issue
----------------------------

* Dafny version: ${dafnyVersion}
* Dafny VSCode extension version: ${await getExtensionVersion(context)}
* 

Expected behavior
-----------------


Actual behavior
---------------


`.trimStart());

interface StatusBarAction {
  label: string;
  description: string;
  command?: string;
  uri?: string;
}

const INeedHelpWithMyProof: StatusBarAction = {
  label: 'Ask for help for a proof',
  description: 'Post your question on StackOverflow with the Dafny tag',
  uri: 'https://stackoverflow.com/questions/ask?tags=Dafny'
};

const ReportVerificationIssue = async (dafnyVersion: string, context: ExtensionContext): Promise<StatusBarAction> => ({
  label: 'Report verification issue',
  description: 'If Dafny is not behaving as expected',
  uri: await fileIssueURL(dafnyVersion, context)
});

const RestartDafny: StatusBarAction = {
  label: 'Restart Dafny',
  description: 'IF the Dafny verifier seems stuck',
  command: DafnyCommands.RestartServer
};

export default class StatusBarActionView {
  public constructor(
    private readonly compilationStatusView: CompilationStatusView,
    public readonly languageServerVersion: string,
    public readonly context: ExtensionContext) {
  }

  public async openStatusBarMenu(): Promise<void> {
    const targets: StatusBarAction[] = [
      await ReportVerificationIssue(this.languageServerVersion, this.context),
      RestartDafny
    ];
    const currentDocumentStatus = this.compilationStatusView.getCurrentDocumentStatus();
    if(currentDocumentStatus === Messages.CompilationStatus.VerificationFailed
      || (currentDocumentStatus?.includes('Verifying') ?? false)) {
      targets.splice(0, 0, INeedHelpWithMyProof);
    }
    const target = await window.showQuickPick(targets, {
      matchOnDescription: true,
      placeHolder: 'Pick an action'
    });
    if(target) {
      if(target.uri !== undefined) {
        vscode.env.openExternal(vscode.Uri.parse(target.uri));
      }
      if(target.command !== undefined) {
        commands.executeCommand(target.command);
      }
    }
  }
}


async function getExtensionVersion(context: ExtensionContext): Promise<string> {
  const regex = /^.*dafny-lang.ide-vscode-(\d+.\d+.\d+).*$/;
  const versionNumber = context.extensionPath.replace(regex, '$1');
  if(versionNumber === context.extensionPath) {
    const prevDir = processCwd();
    processChdir(context.extensionPath);
    const commit = await readFileAsync('.git/refs/heads/master');
    processChdir(prevDir);
    return `(local) https://github.com/dafny-lang/ide-vscode/commit/${commit}`;
  } else {
    return versionNumber;
  }
}
