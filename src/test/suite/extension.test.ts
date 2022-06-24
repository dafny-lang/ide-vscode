import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
//import { ShowDocumentRequest } from 'vscode-languageclient';
import { DafnyInstaller } from '../../language/dafnyInstallation';
import { Messages } from '../../ui/messages';
import { MockingUtils } from './MockingUtils';


const mockedWorkspace = MockingUtils.mockedWorkspace();
(vscode as unknown as any).workspace = mockedWorkspace;

suite('Dafny IDE Extension Installation', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Check constants', () => {
    assert.strictEqual(true, Messages.Dotnet.DownloadUri.includes('https'), 'Download URL should contain https');
  });

  test('Installer checks', async () => {
    const context = MockingUtils.mockedContext();
    const m = MockingUtils.mockedOutputChannelBuilder();
    const installer = new DafnyInstaller(context, m.outputChannel);
    const execAsyncMock = MockingUtils.mockedExecAsync(MockingUtils.simpleCommandMap({
      [''] : { stderr: '', stdout: '' }
    }));
    installer.execAsync = execAsyncMock;
    mockedWorkspace.setFileExpects([
      f => {
        assert.strictEqual('delete', f);
        throw 'Simulated error in delete';
      }
    ]);
    assert.strictEqual(true, installer != null, 'Installer is not null');
    const result = await installer.install();
    assert.strictEqual(
      'Starting Dafny installation\n'
     + 'deleting previous Dafny installation at \\tmp\\mockedUri\\out\\resources\\3.7.0\n'
     + 'Dafny installation failed:\n'
     + '> Simulated error in delete\n', m.writtenContent());
    assert.strictEqual(false, result, 'Result is true');
  });
});

/*
suite('Example Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Sample test', () => {
    assert.strictEqual(-1, [ 1, 2, 3 ].indexOf(5));
    assert.strictEqual(1, [ 1, 2, 3 ].indexOf(2));
  });
});
*/