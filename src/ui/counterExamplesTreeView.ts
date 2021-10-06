import { EventEmitter, ExtensionContext, TextEditor, TreeDataProvider, TreeItem, window, workspace } from 'vscode';

import { ICounterExampleItem, ICounterExampleParams } from '../language/api/counterExample';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import { debounce, DebounceError } from '../tools/debounce';

const CounterExampleUpdateDelayMs = 1000;

function* toTreeItems(counterExample: ICounterExampleItem): Generator<TreeItem> {
  for(const name in counterExample.variables) {
    yield new TreeItem(`${name} = ${counterExample.variables[name]}`);
  }
}

export default class CounterExamplesTreeView implements TreeDataProvider<TreeItem> {
  private readonly onDidChangeTreeDataEmitter = new EventEmitter<TreeItem | undefined | null | void>();
  public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private readonly getCounterExamplesDebounced = debounce(
    (param: ICounterExampleParams) => this.languageClient.getCounterExamples(param),
    CounterExampleUpdateDelayMs
  );

  private counterExamples: ICounterExampleItem[] = [];

  private constructor(private readonly languageClient: DafnyLanguageClient) {}

  public static createAndRegister(context: ExtensionContext, languageClient: DafnyLanguageClient): CounterExamplesTreeView {
    const instance = new CounterExamplesTreeView(languageClient);
    context.subscriptions.push(
      window.onDidChangeActiveTextEditor(editor => instance.updateCounterExamples(editor)),
      workspace.onDidChangeTextDocument(() => instance.updateCounterExamples(window.activeTextEditor)),
      window.onDidChangeTextEditorSelection(() => instance.onDidChangeTreeDataEmitter.fire()),
      window.registerTreeDataProvider('counterExamplesTreeView', instance),
      instance
    );
    return instance;
  }

  private async updateCounterExamples(editor?: TextEditor, debounce: boolean = true): Promise<void> {
    if(editor == null) {
      return;
    }
    try {
      const document = editor.document.uri;
      const params: ICounterExampleParams = { textDocument: { uri: document.toString() } };
      this.counterExamples = debounce
        ? await this.getCounterExamplesDebounced(params)
        : await this.languageClient.getCounterExamples(params);
      this.onDidChangeTreeDataEmitter.fire();
    } catch(error: unknown) {
      if(!(error instanceof DebounceError)) {
        window.showErrorMessage(`CounterExample request failed: ${error}`);
      }
    }
  }

  public getTreeItem(element: TreeItem): TreeItem {
    return element;
  }

  public getChildren(element?: TreeItem): Thenable<TreeItem[]> {
    if(element != null) {
      // In the future we want to support navigating through nested variables.
      return Promise.resolve([]);
    }
    return Promise.resolve(this.getTreeItemsForActiveLine());
  }

  private getTreeItemsForActiveLine(): TreeItem[] {
    const editor = window.activeTextEditor;
    if(editor == null) {
      return [];
    }
    const currentLine = editor.selection.start.line;
    const counterExampleOfCurrentLine = this.counterExamples.find(counterExample => counterExample.position.line === currentLine);
    if(counterExampleOfCurrentLine == null) {
      return [];
    }
    return [ ...toTreeItems(counterExampleOfCurrentLine) ];
  }

  public dispose(): void {
    this.getCounterExamplesDebounced.dispose();
  }
}