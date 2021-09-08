import { StatusBarAlignment, StatusBarItem, window as Window, Disposable } from 'vscode';

import { LanguageConstants } from '../constants';
import { Messages } from './messages';

const StatusBarPriority = 10;

export default class DafnyVersionView {
  private eventRegistrations?: Disposable;

  private constructor(private readonly statusBarItem: StatusBarItem) {}

  public static createAndRegister(dafnyVersion: string): DafnyVersionView {
    const statusBarItem = Window.createStatusBarItem(StatusBarAlignment.Right, StatusBarPriority);
    statusBarItem.text = `${Messages.Installation.Name} ${dafnyVersion}`;
    const view = new DafnyVersionView(statusBarItem);
    view.eventRegistrations = Window.onDidChangeActiveTextEditor(() => view.refreshVersionView());
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

  dispose(): void {
    this.statusBarItem.dispose();
    this.eventRegistrations?.dispose();
  }
}