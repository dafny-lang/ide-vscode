import * as assert from 'assert';
import * as proxyquire from 'proxyquire';
import { MockingUtils, MockingExec } from './MockingUtils';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';

const mockedExec = new MockingExec();
const mockedCommands = MockingUtils.mockedCommands();

const { DafnyInstaller } = proxyquire('../../language/dafnyInstallation', {
  'child_process': proxyquire('child_process', {
    exec: mockedExec.stub
  })
});
import { Messages } from '../../ui/messages';
import { LanguageServerConstants } from '../../constants';
import { DafnyCommands } from '../../commands';

const mockedVsCode = {
  window: {
    activeTerminal: null as any,
    activeTextEditor: null as any
  },
  commands: {
    registerCommand(command: string, callback: () => void): vscode.Disposable {
      return mockedCommands.registerCommand(command, callback);
    }
  }
};
const CompileCommands = proxyquire('../../ui/compileCommands', {
  'vscode': mockedVsCode
}).default;

const mockedWorkspace = MockingUtils.mockedWorkspace();
(vscode as unknown as any).workspace = mockedWorkspace;

suite('Compiler invocation', () => {
  test('Check command creation', async () => {
    const context = MockingUtils.mockedContext();
    CompileCommands.createAndRegister(context);
    assert.strictEqual(true, DafnyCommands.Compile in mockedCommands.registeredCommands);
    assert.strictEqual(true, DafnyCommands.CompileAndRun in mockedCommands.registeredCommands);
    assert.strictEqual(true, DafnyCommands.CompileCustomArgs in mockedCommands.registeredCommands);
    const checkpoints = {
      accessedSave: false,
      accessedIsUntitled: false,
      accessedShow: false
    };

    mockedVsCode.window.activeTextEditor = {
      document: {
        get isUntitled() {
          checkpoints.accessedIsUntitled = true; return false;
        },
        save(): Promise<boolean> {
          checkpoints.accessedSave = true;
          return Promise.resolve(true);
        },
        fileName: 'fileName.dfy'
      } as unknown as vscode.TextDocument
    } as unknown as vscode.TextEditor;
    let textSent = '';
    mockedVsCode.window.activeTerminal = {
      show(): void {
        checkpoints.accessedShow = true;
      },
      sendText(command: string): void {
        textSent = command;
      }
    };
    const returnValue = await(mockedCommands.registeredCommands[DafnyCommands.Compile]() as unknown as Promise<boolean>);
    for(const checkpoint in checkpoints) {
      assert.strictEqual(true, (checkpoints as any)[checkpoint], checkpoint);
    }
    assert.strictEqual('<compiler command prefix>"<dotnet executable path>" "<extension path>\\<compiler runtime path>" "fileName.dfy" /out <arg1> arg2', textSent);
    assert.strictEqual(true, returnValue, 'returnValue');
  });
});

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