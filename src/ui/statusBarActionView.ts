import { window, commands } from 'vscode';
import { DafnyCommands } from '../commands';
import * as vscode from 'vscode';

export const fileIssueURL = 'https://github.com/dafny-lang/ide-vscode/issues/new?title='
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

const ReportVerificationIssue: StatusBarAction = {
  label: 'Report verification issue',
  description: 'File an issue on Github about a verification problem you have.',
  uri: fileIssueURL
};


const RestartDafny: StatusBarAction = {
  label: 'Restart Dafny',
  description: 'Relaunches the Dafny Language Server and reverify the current file.',
  command: DafnyCommands.RestartServer
};

export default class StatusBarActionView {
  public async openStatusBarMenu(): Promise<void> {
    const targets: StatusBarAction[] = [
      ReportVerificationIssue,
      RestartDafny
    ];
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