import { ExtensionContext, StatusBarAlignment, StatusBarItem, window as Window } from 'vscode';

import { LanguageConstants } from '../constants';
import { Messages } from './messages';

const StatusBarPriority = 10;

export default class DafnyVersionView {
  private constructor(private readonly statusBarItem: StatusBarItem) {}

  public static createAndRegister(context: ExtensionContext, dafnyVersion: string): DafnyVersionView {
    const statusBarItem = Window.createStatusBarItem(StatusBarAlignment.Right, StatusBarPriority);
    statusBarItem.text = `${Messages.Installation.Name} ${dafnyVersion}`;
    const view = new DafnyVersionView(statusBarItem);
    context.subscriptions.push(
      Window.onDidChangeActiveTextEditor(() => view.refreshVersionView()),
      statusBarItem
    );
    view.refreshVersionView();
    return view;
  }

  private refreshVersionView(): void {
    const editor = Window.activeTextEditor;
    if(editor == null) {
      return;
    }
    const document = editor.document;
    if(document.languageId === LanguageConstants.Id) {
      this.statusBarItem.show();
    } else {
      this.statusBarItem.hide();
    }
  }
}