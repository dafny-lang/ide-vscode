import * as assert from 'assert';
import * as proxyquire from 'proxyquire';
import { MockingUtils, MockingExec } from './MockingUtils';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';

const mockedExec = new MockingExec();
const mockedCommands = MockingUtils.mockedCommands();

import { Messages } from '../../ui/messages';
import { DafnyCommands } from '../../commands';
import VerificationGutterStatusView from '../../ui/verificationGutterStatusView';
import { DocumentSymbol } from 'vscode';
import { PublishedVerificationStatus } from '../../language/api/verificationSymbolStatusParams';
import { LineVerificationStatus } from '../../language/api/verificationGutterStatusParams';

const mockedWorkspace = MockingUtils.mockedWorkspace();
const mockedVsCode = {
  window: {
    activeTerminal: null as any,
    activeTextEditor: null as any,
    showInformationMessage: () => {},
    showWarningMessage: () => {}
  },
  commands: {
    registerCommand(command: string, callback: () => void): vscode.Disposable {
      return mockedCommands.registerCommand(command, callback);
    }
  },
  workspace: mockedWorkspace,
  '@global': true
};
const CompileCommands = proxyquire('../../ui/compileCommands', {
  'vscode': mockedVsCode
}).default;

const { DafnyInstaller } = proxyquire('../../language/dafnyInstallation', {
  'child_process': proxyquire('child_process', {
    exec: mockedExec.stub
  }),
  vscode: mockedVsCode
});

suite('Compiler invocation', () => {
  test('Check command creation', async () => {
    const context = MockingUtils.mockedContext();
    CompileCommands.createAndRegister({
      context,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      getCliExecutable: (server: boolean, newArgs: string[], oldArgs: string[]) => {
        return {
          command: '<dotnet executable path>',
          args: newArgs,
          options: {
            cwd: '<dotnet tool path>'
          }
        };
      }
    });
    assert.strictEqual(true, DafnyCommands.Build in mockedCommands.registeredCommands);
    assert.strictEqual(true, DafnyCommands.Run in mockedCommands.registeredCommands);
    assert.strictEqual(true, DafnyCommands.BuildCustomArgs in mockedCommands.registeredCommands);
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
    const returnValue = await(mockedCommands.registeredCommands[DafnyCommands.Build]() as unknown as Promise<boolean>);
    for(const checkpoint in checkpoints) {
      assert.strictEqual(true, (checkpoints as any)[checkpoint], checkpoint);
    }
    assert.strictEqual('cd <dotnet tool path>; <compiler command prefix>"<dotnet executable path>" "build" "--output" "<arg1>" "arg2" "fileName.dfy"',
      textSent.replace(/\\/g, '/'));
    assert.strictEqual(true, returnValue, 'returnValue');
  }).timeout(60 * 1000);
});

suite('Dafny IDE Extension Installation', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Check constants', () => {
    assert.strictEqual(true, Messages.Dotnet.DownloadUri.includes('https'), 'Download URL should contain https');
  });

  test('Installer checks', async function() {
    // Skip this test if DAFNY_SERVER_OVERRIDE is set (CI environment)
    if(process.env['DAFNY_SERVER_OVERRIDE'] !== undefined) {
      this.skip();
      return;
    }

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
    try {
      await installer.getCliExecutable(false, [], []);
      assert.fail('installation should fail');
    // eslint-disable-next-line no-empty
    } catch(e: unknown) {
      outputChannelBuilder.outputChannel.append(`${e}`);
    }
    const result = outputChannelBuilder.writtenContent().replace(/\\/g, '/').replace(/resources\/.*\n/, 'resources/\n');
    assert.strictEqual(result,
      'Standalone language server installation started.\n'
      + 'deleting previous Dafny installation at /tmp/mockedUri/out/resources/\n'
      + 'Standalone language server installation failed:\n'
      + '> Simulated error in delete\n'
      + 'Error: Could not install a Dafny language server.'
    );
  }).timeout(60 * 1000);
});

suite('Verification Gutter', () => {
  test('perLineStatusToRanges', () => {
    const ranges = VerificationGutterStatusView.perLineStatusToRanges([ 1, 1, 1, 0, 0, 0, 2, 2, 2 ], [ 2, 4, 6 ]);
    assert.deepStrictEqual([ new vscode.Range(0, 1, 1, 1) ], ranges.get(1));
    assert.deepStrictEqual([ new vscode.Range(7, 1, 8, 1) ], ranges.get(2));
    assert.deepStrictEqual([ new vscode.Range(3, 1, 3, 1), new vscode.Range(5, 1, 5, 1) ], ranges.get(0));
  });

  test('computeGutterIconsParseError', () => {
    const source = `
method Foo() {
  parse(;)Error
}

method Bat()
  ensures false
{
  if (true) {
    return;
  } else {
    return;
  }
}

method Fom() {
  assert true;
}`.trimStart();
    const uri = vscode.Uri.parse('file:///woops.dfy');
    const parseError = new vscode.Diagnostic(new vscode.Range(1, 2, 1, 15), 'Some parse error', vscode.DiagnosticSeverity.Error);
    parseError.source = 'Parser';
    const outdatedReturnError = new vscode.Diagnostic(new vscode.Range(8, 8, 8, 14), 'Outdated: a postcondition could not be proved on this return path', vscode.DiagnosticSeverity.Warning);
    outdatedReturnError.relatedInformation = [ {
      location: { uri, range: new vscode.Range(5, 14, 5, 19) },
      message: 'This postcondition might not hold: false'
    } ];
    const expected = [
      LineVerificationStatus.VerifiedObsolete,
      LineVerificationStatus.ResolutionError,
      LineVerificationStatus.VerifiedObsolete,
      LineVerificationStatus.VerifiedObsolete,
      LineVerificationStatus.VerifiedObsolete,
      LineVerificationStatus.AssertionFailedObsolete,
      LineVerificationStatus.VerifiedObsolete,
      LineVerificationStatus.VerifiedObsolete,
      LineVerificationStatus.AssertionFailedObsolete,
      LineVerificationStatus.VerifiedObsolete,
      LineVerificationStatus.VerifiedObsolete,
      LineVerificationStatus.VerifiedObsolete,
      LineVerificationStatus.VerifiedObsolete,
      LineVerificationStatus.VerifiedObsolete,
      LineVerificationStatus.VerifiedObsolete,
      LineVerificationStatus.VerifiedObsolete,
      LineVerificationStatus.VerifiedObsolete
    ];
    const computedIcons = VerificationGutterStatusView.computeGutterIcons(
      virtualDocument(uri, source),
      false, undefined, undefined, [
        parseError,
        outdatedReturnError
      ]
    );
    assert.deepStrictEqual(expected, computedIcons);
  });

  function virtualDocument(uri: vscode.Uri, source: string): vscode.TextDocument {
    const lines = source.split('\n');
    return {
      uri: uri,
      getText: (range: vscode.Range) => {
        return lines[range.start.line];
      },
      lineCount: lines.length
    } as vscode.TextDocument;
  }

  test('foundAllError', () => {
    const source = `
method Faz() {
  assert true;
  assert true;
  assert false; // Error
}`.trimStart();
    const computedIcons = VerificationGutterStatusView.computeGutterIcons(
      virtualDocument(vscode.Uri.parse('file:///woops.dfy'), source),
      false, new Map([
        [ '0,7', new vscode.Range(0, 0, 4, 1) ]
      ]), [
        { nameRange: new vscode.Range(0, 7, 0, 10), status: PublishedVerificationStatus.Error }
      ], [
        new vscode.Diagnostic(new vscode.Range(3, 2, 3, 14), 'could not prove assertion', vscode.DiagnosticSeverity.Error)
      ]);
    const expected = [
      LineVerificationStatus.Nothing,
      LineVerificationStatus.AssertionVerifiedInErrorContext,
      LineVerificationStatus.AssertionVerifiedInErrorContext,
      LineVerificationStatus.AssertionFailed,
      LineVerificationStatus.AssertionVerifiedInErrorContext
    ];
    assert.deepStrictEqual(expected, computedIcons);
  });

  test('computeGutterIconsResolved', () => {
    const source = `
method Foo() { // Stale
  assert false; // No error
}

method Bat() { // Stale
  assert false; // Outdated error
}

method Bar() { // Queued
  assert false;
}

method Baz() { // Running
  assert false;
}

method Fom() { // Correct
  assert true;
}

method Faz() { // Error
  assert true;
  assert false; // Error
}`.trimStart();
    const computedIcons = VerificationGutterStatusView.computeGutterIcons(
      virtualDocument(vscode.Uri.parse('file:///woops.dfy'), source),
      true, new Map([
        [ '0,7', new vscode.Range(0, 0, 2, 1) ],
        [ '4,7', new vscode.Range(4, 0, 6, 1) ],
        [ '8,7', new vscode.Range(8, 0, 10, 1) ],
        [ '12,7', new vscode.Range(12, 0, 14, 1) ],
        [ '16,7', new vscode.Range(16, 0, 18, 1) ],
        [ '20,7', new vscode.Range(20, 0, 23, 1) ]
      ]), [
        { nameRange: new vscode.Range(0, 7, 0, 10), status: PublishedVerificationStatus.Stale },
        { nameRange: new vscode.Range(4, 7, 4, 10), status: PublishedVerificationStatus.Stale },
        { nameRange: new vscode.Range(8, 7, 8, 10), status: PublishedVerificationStatus.Queued },
        { nameRange: new vscode.Range(12, 7, 12, 10), status: PublishedVerificationStatus.Running },
        { nameRange: new vscode.Range(16, 7, 16, 10), status: PublishedVerificationStatus.Correct },
        { nameRange: new vscode.Range(20, 7, 20, 10), status: PublishedVerificationStatus.Error }
      ], [
        new vscode.Diagnostic(new vscode.Range(5, 2, 5, 14), 'Outdated: could not prove assertion', vscode.DiagnosticSeverity.Warning),
        new vscode.Diagnostic(new vscode.Range(17, 2, 17, 14), 'some warning', vscode.DiagnosticSeverity.Warning),
        Object.assign(new vscode.Diagnostic(new vscode.Range(21, 2, 21, 12), 'Assertion: division', vscode.DiagnosticSeverity.Hint),
          { code: 'isAssertion' }),
        new vscode.Diagnostic(new vscode.Range(22, 2, 22, 14), 'could not prove assertion', vscode.DiagnosticSeverity.Error)
      ]);
    const expected = [
      LineVerificationStatus.Nothing,
      LineVerificationStatus.VerifiedObsolete,
      LineVerificationStatus.VerifiedObsolete,
      LineVerificationStatus.Verified,
      LineVerificationStatus.Nothing,
      LineVerificationStatus.AssertionFailedObsolete,
      LineVerificationStatus.ErrorContextObsolete,
      LineVerificationStatus.Verified,
      LineVerificationStatus.Nothing,
      LineVerificationStatus.VerifiedObsolete,
      LineVerificationStatus.VerifiedObsolete,
      LineVerificationStatus.Verified,
      LineVerificationStatus.Nothing,
      LineVerificationStatus.VerifiedVerifying,
      LineVerificationStatus.VerifiedVerifying,
      LineVerificationStatus.Verified,
      LineVerificationStatus.Nothing,
      LineVerificationStatus.Verified,
      LineVerificationStatus.Verified,
      LineVerificationStatus.Verified,
      LineVerificationStatus.Nothing,
      LineVerificationStatus.AssertionVerifiedInErrorContext,
      LineVerificationStatus.AssertionFailed,
      LineVerificationStatus.ErrorContext
    ];
    assert.deepStrictEqual(expected, computedIcons);
  });


  test('foundSomeErrorsTrackAssertions', () => {
    const source = `
method FoundSomeErrors() {
  if (*) {
    assert false;
  } else {
    var x := 3 / 2;
  }
  assert false;
}
method FoundAllErrors() {
  if (*) {
    assert false;
  } else {
    var x := 3 / 2;
  }
  assert true;
}`.trimStart();
    const computedIcons = VerificationGutterStatusView.computeGutterIcons(
      virtualDocument(vscode.Uri.parse('file:///woops.dfy'), source),
      true, new Map([
        [ '0,7', new vscode.Range(0, 0, 7, 1) ],
        [ '8,7', new vscode.Range(8, 0, 15, 1) ]
      ]), [
        { nameRange: new vscode.Range(0, 7, 0, 22), status: PublishedVerificationStatus.Error },
        { nameRange: new vscode.Range(8, 7, 8, 21), status: PublishedVerificationStatus.Error }
      ], [
        Object.assign(new vscode.Diagnostic(new vscode.Range(0, 7, 0, 22), 'Verification hit error limit so not all errors may be shown.',
          vscode.DiagnosticSeverity.Error), { code: 'errorLimitHit' }),
        new vscode.Diagnostic(new vscode.Range(2, 4, 2, 16), 'could not prove assertion', vscode.DiagnosticSeverity.Error),
        Object.assign(new vscode.Diagnostic(new vscode.Range(4, 4, 4, 16), 'Assertion: division', vscode.DiagnosticSeverity.Hint),
          { code: 'isAssertion' }),
        new vscode.Diagnostic(new vscode.Range(6, 4, 6, 18), 'could not prove assertion', vscode.DiagnosticSeverity.Error),
        new vscode.Diagnostic(new vscode.Range(10, 4, 10, 16), 'could not prove assertion', vscode.DiagnosticSeverity.Error),
        Object.assign(new vscode.Diagnostic(new vscode.Range(12, 4, 12, 18), 'Assertion: division', vscode.DiagnosticSeverity.Hint),
          { code: 'isAssertion' })
      ]);
    const expected = [
      LineVerificationStatus.Nothing,
      LineVerificationStatus.ErrorContext,
      LineVerificationStatus.AssertionFailed,
      LineVerificationStatus.ErrorContext,
      LineVerificationStatus.ErrorContext,
      LineVerificationStatus.ErrorContext,
      LineVerificationStatus.AssertionFailed,
      LineVerificationStatus.ErrorContext,
      LineVerificationStatus.Nothing,
      LineVerificationStatus.ErrorContext,
      LineVerificationStatus.AssertionFailed,
      LineVerificationStatus.ErrorContext,
      LineVerificationStatus.AssertionVerifiedInErrorContext,
      LineVerificationStatus.ErrorContext,
      LineVerificationStatus.AssertionVerifiedInErrorContext,
      LineVerificationStatus.ErrorContext
    ];
    assert.deepStrictEqual(expected, computedIcons);
  });
});

suite('commands', () => {
  test.skip('restart server', async () => {
    const program = `
method Foo(x: nat) returns (y: nat) 
  ensures y > 2;
{ 
  return x + 2; 
}`;
    const extension = vscode.extensions.getExtension('dafny-lang.ide-vscode')!;
    await extension.activate();
    const document = await vscode.workspace.openTextDocument({ language: 'dafny', content: program });
    const symbols1 = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document.uri) as DocumentSymbol[];
    await vscode.commands.executeCommand('dafny.restartServer');
    const symbols2 = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document.uri) as DocumentSymbol[];
    assert.strictEqual(symbols1.length > 0, true);
    assert.strictEqual(symbols2.length, symbols1.length);
  });
});
