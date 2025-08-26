import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Verification', () => {
  test('Program with errors has diagnostics', async () => {
    const extension = vscode.extensions.getExtension('dafny-lang.ide-vscode')!;

    try {
      await extension.activate();
    } catch(error: unknown) {
      // Skip test if Dafny language server cannot be installed in test environment
      if(error instanceof Error && error.message.includes('Could not install a Dafny language server')) {
        console.log('Skipping verification test: Dafny language server not available in test environment');
        return;
      }
      throw error;
    }

    const program = 'method Foo() ensures false {}';
    const document = await vscode.workspace.openTextDocument({ language: 'dafny', content: program });
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