

// Mock some languageClient thing to inject symbolStatus notifications
// Mock the VSCode test API to intercept calls to it.
import * as assert from 'assert';
import { Emitter } from 'vscode-languageclient';
import * as vscode from 'vscode';
import { DocumentSymbol, EventEmitter, TestItem } from 'vscode';
import { toPromise } from './eventsutil';

const replaceCalled: EventEmitter<TestItem[]> = new Emitter();
const createTestRunCalled: EventEmitter<vscode.TestRunRequest> = new Emitter();
const testRunEndCalled: EventEmitter<vscode.TestRun> = new Emitter();
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
    return result;
  };
  return controller;
};

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
  test('happy flow', async () => {
    const testRunCalledPromise = toPromise(createTestRunCalled.event);
    const testRunEndPromise = toPromise(testRunEndCalled.event);
    const untitledDocument = await vscode.workspace.openTextDocument({ content: program, language: 'dafny' });
    const symbols = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', untitledDocument.uri) as DocumentSymbol[];
    const foo = symbols[0];
    const zaz = foo.children[0];
    const m1 = zaz.children[0];

    const replacedItems = await toPromise(replaceCalled.event);
    const runRequest = await testRunCalledPromise;
    await testRunEndPromise;
    assert.strictEqual(runRequest.include![0].id, JSON.stringify(m1.selectionRange));
    assert.strictEqual(replacedItems.length, 3);
  }).timeout(60 * 1000);
});