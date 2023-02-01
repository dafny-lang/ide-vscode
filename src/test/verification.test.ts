import * as assert from 'assert';
import * as vscode from 'vscode';
import { ViewColumn } from 'vscode';

suite('Verification', () => {
  test('Program with errors has diagnostics', async () => {

    const createChannel: (name: string, languageId: string | undefined) => vscode.OutputChannel = (name, language) => {
      return {
        name: name,

        /**
         * Append the given value to the channel.
         *
         * @param value A string, falsy values will not be printed.
         */
        append: (value: string) => {},

        /**
         * Append the given value and a line feed character
         * to the channel.
         *
         * @param value A string, falsy values will be printed.
         */
        appendLine: (value: string) => {},

        /**
         * Replaces all output from the channel with the given value.
         *
         * @param value A string, falsy values will not be printed.
         */
        replace: (value: string) => {},

        /**
         * Removes all output from the channel.
         */
        clear: () => {},

        /**
         * Reveal this channel in the UI.
         *
         * @param preserveFocus When `true` the channel will not take focus.
         */

        /**
         * Reveal this channel in the UI.
         *
         * @deprecated Use the overload with just one parameter (`show(preserveFocus?: boolean): void`).
         *
         * @param column This argument is **deprecated** and will be ignored.
         * @param preserveFocus When `true` the channel will not take focus.
         */
        show: (column?: ViewColumn, preserveFocus?: boolean) => {},

        /**
         * Hide this channel from the UI.
         */
        hide: () => {},

        /**
         * Dispose and free associated resources.
         */
        dispose: () => {}
      }
    };
    vscode.window.createOutputChannel = createChannel;

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
  }).timeout(10 * 60 * 1000); // We use a large timeout to allow for the Dafny installation to run.
});