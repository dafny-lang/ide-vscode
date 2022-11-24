import { ExtensionContext, Disposable, OutputChannel, Uri, Diagnostic } from 'vscode';
import { HandleDiagnosticsSignature, LanguageClient, LanguageClientOptions, ServerOptions, TextDocumentPositionParams } from 'vscode-languageclient/node';

import Configuration from '../configuration';
import { ConfigurationConstants } from '../constants';
import { getDotnetExecutablePath } from '../dotnet';
import { DafnyDocumentFilter } from '../tools/vscode';
import { ICompilationStatusParams, IVerificationCompletedParams, IVerificationStartedParams } from './api/compilationStatus';
import { ICounterexampleItem, ICounterexampleParams } from './api/counterExample';
import { IGhostDiagnosticsParams } from './api/ghostDiagnostics';
import { IVerificationGutterStatusParams as IVerificationGutterStatusParams } from './api/verificationGutterStatusParams';
import { IVerificationSymbolStatusParams } from './api/verificationSymbolStatusParams';
<<<<<<< Updated upstream
import { getOrComputeLanguageServerRuntimePath } from './dafnyInstallation';
=======
import { getLanguageServerExecutable } from './dafnyInstallation';
>>>>>>> Stashed changes

const LanguageServerId = 'dafny-vscode';
const LanguageServerName = 'Dafny Language Server';

function getLanguageServerLaunchArgs(): string[] {
  const launchArgs = Configuration.get<string[]>(ConfigurationConstants.LanguageServer.LaunchArgs);
  return [
    getVerificationArgument(),
    getVerifierTimeLimitArgument(),
    getVerifierCachingPolicy(),
    getVerifierVirtualCoresArgument(),
    getMarkGhostStatementsArgument(),
    getDisplayGutterStatusArgument(),
    ...getDafnyPluginsArgument(),
    ...launchArgs
  ];
}

function getVerificationArgument(): string {
  return `--documents:verify=${Configuration.get<string>(ConfigurationConstants.LanguageServer.AutomaticVerification)}`;
}

function getVerifierTimeLimitArgument(): string {
  return `--verifier:timelimit=${Configuration.get<string>(ConfigurationConstants.LanguageServer.VerificationTimeLimit)}`;
}

function getVerifierCachingPolicy(): string {
  const setting = Configuration.get<string>(ConfigurationConstants.LanguageServer.VerificationCachingPolicy);
  const verifySnapshots = {
    'No caching': 0,
    'Basic caching': 1,
    'Advanced caching': 3
  }[setting] ?? 0;
  return `--verifier:verifySnapshots=${verifySnapshots}`;
}

function getVerifierVirtualCoresArgument(): string {
  return `--verifier:vcscores=${Configuration.get<string>(ConfigurationConstants.LanguageServer.VerificationVirtualCores)}`;
}

function getDisplayGutterStatusArgument(): string {
  return `--verifier:gutterStatus=${Configuration.get<string>(ConfigurationConstants.LanguageServer.DisplayGutterStatus)}`;
}

function getMarkGhostStatementsArgument(): string {
  return `--ghost:markStatements=${Configuration.get<string>(ConfigurationConstants.LanguageServer.MarkGhostStatements)}`;
}

function getDafnyPluginsArgument(): string[] {
  const plugins = Configuration.get<string[]>(ConfigurationConstants.LanguageServer.DafnyPlugins);
  if(plugins === null || !Array.isArray(plugins)) {
    return [];
  }
  return (
    plugins
      .filter(plugin => plugin !== null && plugin !== '')
      .map((plugin, i) => `--dafny:plugins:${i}=${plugin}`)
  );
}

type DiagnosticListener = (uri: Uri, diagnostics: Diagnostic[]) => void;

export class DafnyLanguageClient extends LanguageClient {
  private readonly diagnosticsListeners: DiagnosticListener[];

  // eslint-disable-next-line max-params
  private constructor(id: string, name: string, serverOptions: ServerOptions, clientOptions: LanguageClientOptions, diagnosticsListeners: DiagnosticListener[], forceDebug?: boolean) {
    super(id, name, serverOptions, clientOptions, forceDebug);
    this.diagnosticsListeners = diagnosticsListeners;
  }

  public getCounterexamples(param: ICounterexampleParams): Promise<ICounterexampleItem[]> {
    return this.sendRequest<ICounterexampleItem[]>('dafny/counterExample', param);
  }

  public static argumentsToCommandLine(launchArguments: string[]): string {
    return launchArguments.map(oneArgument =>
      (/\s|"|\\/.exec(oneArgument))
        ? '"' + oneArgument.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
        : oneArgument
    ).join(' ');
  }

  public static async create(context: ExtensionContext, statusOutput: OutputChannel): Promise<DafnyLanguageClient> {
    const { path: dotnetExecutable } = await getDotnetExecutablePath();
<<<<<<< Updated upstream
    const launchArguments = [ await getOrComputeLanguageServerRuntimePath(context), ...getLanguageServerLaunchArgs() ];
=======
    const exec = getLanguageServerExecutable(context, getLanguageServerLaunchArgs());
    const launchArguments = [ await getLanguageServerRuntimePath(context), ...getLanguageServerLaunchArgs() ];
>>>>>>> Stashed changes
    statusOutput.appendLine(`Language server arguments: ${DafnyLanguageClient.argumentsToCommandLine(launchArguments)}`);
    const serverOptions: ServerOptions = {
      run: { command: dotnetExecutable, args: launchArguments },
      debug: { command: dotnetExecutable, args: launchArguments }
    };
    const diagnosticsListeners: ((uri: Uri, diagnostics: Diagnostic[]) => void)[] = [];
    const clientOptions: LanguageClientOptions = {
      documentSelector: [ DafnyDocumentFilter ],
      diagnosticCollectionName: LanguageServerId,
      middleware: {
        handleDiagnostics: (uri: Uri, diagnostics: Diagnostic[], next: HandleDiagnosticsSignature) => {
          for(const handler of diagnosticsListeners) {
            handler(uri, diagnostics);
          }
          next(uri, diagnostics);
        }
      }
    };
    return new DafnyLanguageClient(LanguageServerId, LanguageServerName, serverOptions, clientOptions, diagnosticsListeners);
  }

  public onGhostDiagnostics(callback: (params: IGhostDiagnosticsParams) => void): Disposable {
    return this.onNotification('dafny/ghost/diagnostics', callback);
  }

  public onVerificationStatusGutter(callback: (params: IVerificationGutterStatusParams) => void): Disposable {
    return this.onNotification('dafny/verification/status/gutter', callback);
  }

  public onVerificationSymbolStatus(callback: (params: IVerificationSymbolStatusParams) => void): Disposable {
    return this.onNotification('dafny/textDocument/symbolStatus', callback);
  }

  public onCompilationStatus(callback: (params: ICompilationStatusParams) => void): Disposable {
    return this.onNotification('dafny/compilation/status', callback);
  }

  public onServerVersion(callback: (version: string) => void): Disposable {
    return this.onNotification('dafnyLanguageServerVersionReceived', callback);
  }

  public onPublishDiagnostics(callback: (uri: Uri, diagnostics: Diagnostic[]) => void): void {
    this.diagnosticsListeners.push(callback);
  }

  // Backwards compatibility for versions of Dafny <= 3.2
  public onVerificationStarted(callback: (params: IVerificationStartedParams) => void): Disposable {
    return this.onNotification('dafny/verification/started', callback);
  }

  // Backwards compatibility for versions of Dafny <= 3.2
  public onVerificationCompleted(callback: (params: IVerificationCompletedParams) => void): Disposable {
    return this.onNotification('dafny/verification/completed', callback);
  }

  public runVerification(params: TextDocumentPositionParams): Promise<boolean> {
    return this.sendRequest<boolean>('dafny/textDocument/verifySymbol', params);
  }

  public cancelVerification(params: TextDocumentPositionParams): Promise<boolean> {
    return this.sendRequest<boolean>('dafny/textDocument/cancelVerifySymbol', params);
  }
}
