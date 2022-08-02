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

    const replaceCalled: EventEmitter<TestItem[]> = new Emitter();
    const createTestRunCalled: EventEmitter<vscode.TestRunRequest> = new Emitter();
    const testRunEndCalled: EventEmitter<vscode.TestRun> = new Emitter();
    const testRunSkippedCalled: EventEmitter<vscode.TestItem> = new Emitter();
    const originalCreateTestController = vscode.tests.createTestController;
    vscode.tests.createTestController = (id: string, label: string) => {
      const controller = originalCreateTestController(id, label);
      const originalReplace = controller.items.replace.bind(controller.items);
      controller.items.replace = (items: TestItem[]) => {
        replaceCalled.fire(items);
        originalReplace(items);
      };

      const originalCreateTestRun = controller.createTestRun.bind(controller);
      controller.createTestRun = (request, name, persist) => {
        const result = originalCreateTestRun(request, name, persist);
        createTestRunCalled.fire(request);
        const originalEnd = result.end.bind(result);
        result.end = () => {
          testRunEndCalled.fire(result);
          originalEnd();
        };
        const originalSkipped = result.skipped.bind(result);
        result.skipped = (item) => {
          testRunSkippedCalled.fire(item);
          originalSkipped(item);
        };
        return result;
      };
      return controller;
    };

    try {
      const testRunCalledPromise = toPromise(createTestRunCalled.event);
      const testRunEndPromise = toPromise(testRunEndCalled.event);
      const testItemSkipped = toPromise(testRunSkippedCalled.event);
      const untitledDocument = await vscode.workspace.openTextDocument({ content: program, language: 'dafny' });
      const extension = vscode.extensions.getExtension('dafny-lang.ide-vscode')!;
      await extension.activate();
      const symbols = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', untitledDocument.uri) as DocumentSymbol[];
      const foo = symbols[0];
      const zaz = foo.children[0];
      const m1 = zaz.children[0];

      const replacedItems = await toPromise(replaceCalled.event);
      assert.strictEqual(replacedItems.length, 3);
      const runRequest = await testRunCalledPromise;
      assert.strictEqual(runRequest.include![0].id, JSON.stringify(m1.selectionRange));
      const skippedItem = await testItemSkipped;
      assert.strictEqual(skippedItem.id, JSON.stringify(m1.selectionRange));
      await testRunEndPromise;
    } finally {
      vscode.tests.createTestController = originalCreateTestController;
    }
  }).timeout(60 * 1000);
});