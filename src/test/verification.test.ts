import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Verification', () => {
  test('Program with errors has diagnostics', async () => {

    const extension = vscode.extensions.getExtension('dafny-lang.ide-vscode')!;
    console.log('Waiting for extension activation');
    await extension.activate();
    console.log('Activated extension');

    const program = 'method Foo() ensures false {}';
    const document = await vscode.workspace.openTextDocument({ language: 'dafny', content: program });
    console.log('Opened document');
    await new Promise<void>(resolve => {
      vscode.languages.onDidChangeDiagnostics(() => {
        const diagnostics = vscode.languages.getDiagnostics(document.uri);
        assert.equal(diagnostics.length, 1);
        assert.equal(diagnostics[0].message.includes('postcondition'), true);
        resolve();
      });
    });
  }).timeout(3 * 60 * 1000); // We use a large timeout to allow for the Dafny installation to run.
});