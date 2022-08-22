import * as assert from 'assert';
import { Emitter } from 'vscode-languageclient';
import * as vscode from 'vscode';
import { DocumentSymbol, EventEmitter, TestItem } from 'vscode';
import { toPromise } from './eventsutil';

const program = `
import opened Bar
module Foo {
  import opened Bar

  class Zaz {
    method m1() {
      assert fib(10) == 55;
    }
  }
}

method m2() {
  assert fib(5013) == 534;
}

module Bar {
  method m3() {
    assert fib(1) == 1;
  }

  function fib(n: nat): nat {
    if (n <= 1) then n else fib(n - 1) + fib(n - 2)
  }
}`;

suite('Verification symbol view', () => {
  test('opening a file triggers an implicit testrun that shows stale tasks', async () => {
    const testRunCalledPromise = toPromise(listener.createTestRunCalled.event);
    const testRunEndPromise = toPromise(listener.testRunEndCalled.event);
    const testItemSkipped = toPromise(listener.testRunSkippedCalled.event);
    const untitledDocument = await vscode.workspace.openTextDocument({ content: program, language: 'dafny' });
    const extension = vscode.extensions.getExtension('dafny-lang.ide-vscode')!;
    await extension.activate();
    const symbols = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', untitledDocument.uri) as DocumentSymbol[];
    const foo = symbols[0];
    const zaz = foo.children[0];
    const m1 = zaz.children[0];

    const replacedItems = await toPromise(listener.replaceCalled.event);
    assert.strictEqual(replacedItems.length, 3);
    const runRequest = await testRunCalledPromise;
    assert.strictEqual(runRequest.include![0].id, untitledDocument.uri.toString() + JSON.stringify(m1.selectionRange));
    const skippedItem = await testItemSkipped;
    assert.strictEqual(skippedItem.id, untitledDocument.uri.toString() + JSON.stringify(m1.selectionRange));
    await testRunEndPromise;
  }).timeout(50 * 1000);

  test('test runs still start and end when document symbols do not match verifiable symbols', async () => {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const originalExecuteCommand = vscode.commands.executeCommand;
    function executeCommandMock<T = unknown>(command: string, args: any[]) {
      if(command === 'vscode.executeDocumentSymbolProvider') {
        return Promise.resolve<T>([] as any as T);
      }
      return originalExecuteCommand<T>(command, args);
    }
    vscode.commands.executeCommand = executeCommandMock;

    try {
      const testRunCalledPromise = toPromise(listener.createTestRunCalled.event);
      const testRunEndPromise = toPromise(listener.testRunEndCalled.event);
      await vscode.workspace.openTextDocument({ content: program, language: 'dafny' });
      const extension = vscode.extensions.getExtension('dafny-lang.ide-vscode')!;
      await extension.activate();

      const replacedItems = await toPromise(listener.replaceCalled.event);
      assert.strictEqual(replacedItems.length, 0);
      const runRequest = await testRunCalledPromise;
      assert.strictEqual(runRequest.include?.length, 4, JSON.stringify(runRequest.include));
      await testRunEndPromise;
    } finally {
      vscode.commands.executeCommand = originalExecuteCommand;
    }
  }).timeout(30 * 1000);
});

class TestControllerListener {

  public readonly replaceCalled: EventEmitter<TestItem[]> = new Emitter();
  public readonly createTestRunCalled: EventEmitter<vscode.TestRunRequest> = new Emitter();
  public readonly testRunEndCalled: EventEmitter<vscode.TestRun> = new Emitter();
  public readonly testRunSkippedCalled: EventEmitter<vscode.TestItem> = new Emitter();
  private readonly originalCreateTestController = vscode.tests.createTestController;

  public constructor() {
    vscode.tests.createTestController = (id: string, label: string) => {
      const controller = this.originalCreateTestController(id, label);
      const originalReplace = controller.items.replace.bind(controller.items);
      controller.items.replace = (items: TestItem[]) => {
        this.replaceCalled.fire(items);
        originalReplace(items);
      };

      const originalCreateTestRun = controller.createTestRun.bind(controller);
      controller.createTestRun = (request, name, persist) => {
        const result = originalCreateTestRun(request, name, persist);
        this.createTestRunCalled.fire(request);
        const originalEnd = result.end.bind(result);
        result.end = () => {
          this.testRunEndCalled.fire(result);
          originalEnd();
        };
        const originalSkipped = result.skipped.bind(result);
        result.skipped = (item) => {
          this.testRunSkippedCalled.fire(item);
          originalSkipped(item);
        };
        return result;
      };
      return controller;
    };
  }

  public dispose(): void {
    vscode.tests.createTestController = this.originalCreateTestController;
  }
}
const listener = new TestControllerListener();