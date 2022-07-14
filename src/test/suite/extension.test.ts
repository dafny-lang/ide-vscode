import * as assert from 'assert';
import * as proxyquire from 'proxyquire';
import { MockingUtils, MockingExec } from './MockingUtils';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
//import * as vscode from 'vscode';
const vscode = require('vscode');
const mockedExec = new MockingExec();
const { DafnyInstaller } = proxyquire('../../language/dafnyInstallation', {
  'child_process': proxyquire('child_process', {
    exec: mockedExec.stub
  })
});
import { Messages } from '../../ui/messages';
import { LanguageServerConstants } from '../../constants';


const mockedWorkspace = MockingUtils.mockedWorkspace();
(vscode as unknown as any).workspace = mockedWorkspace;

suite('Dafny IDE Extension Installation', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Check constants', () => {
    assert.strictEqual(true, Messages.Dotnet.DownloadUri.includes('https'), 'Download URL should contain https');
  });

  test('Installer checks', async () => {
    const context = MockingUtils.mockedContext();
    const outputChannelBuilder = MockingUtils.mockedOutputChannelBuilder();
    mockedExec.set(MockingUtils.simpleCommandMap({
      [''] : { stderr: '', stdout: '' }
    }));
    const installer = new DafnyInstaller(context, outputChannelBuilder.outputChannel);
    mockedWorkspace.setFSExpects([
      (methodName) => {
        assert.strictEqual('delete', methodName);
        throw 'Simulated error in delete';
      }
    ]);
    assert.strictEqual(true, installer != null, 'Installer is not null');
    const result = await installer.install();
    assert.strictEqual(outputChannelBuilder.writtenContent().replace(/\\/g, '/'),
      'Starting Dafny installation\n'
      + 'deleting previous Dafny installation at /tmp/mockedUri/out/resources/' + LanguageServerConstants.LatestVersion + '\n'
      + 'Dafny installation failed:\n'
      + '> Simulated error in delete\n'
    );
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