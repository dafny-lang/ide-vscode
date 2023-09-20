import { Disposable, Uri, Diagnostic, EventEmitter, Event } from 'vscode';
import { HandleDiagnosticsSignature, LanguageClient, LanguageClientOptions, ServerOptions, TextDocumentPositionParams } from 'vscode-languageclient/node';

import Configuration from '../configuration';
import { ConfigurationConstants } from '../constants';
import { DafnyDocumentFilter } from '../tools/vscode';
import { ICompilationStatusParams, IVerificationCompletedParams, IVerificationStartedParams } from './api/compilationStatus';
import { ICounterexampleItem, ICounterexampleParams } from './api/counterExample';
import { IGhostDiagnosticsParams } from './api/ghostDiagnostics';
import { IVerificationSymbolStatusParams } from './api/verificationSymbolStatusParams';
import { DafnyInstaller } from './dafnyInstallation';
import * as os from 'os';
import { IVerificationGutterStatusParams } from './api/verificationGutterStatusParams';

const LanguageServerId = 'dafny-vscode';
const LanguageServerName = 'Dafny Language Server';

function getLanguageServerLaunchArgsNew(): string[] {
  const oldVerifyOnValue = Configuration.get<string>(ConfigurationConstants.LanguageServer.AutomaticVerification);
  const map: Record<string, string> = {
    never: 'Never',
    onchange: 'Change',
    onsave: 'Save'
  };
  const verifyOn: string = map[oldVerifyOnValue];

  const launchArgs = Configuration.get<string[]>(ConfigurationConstants.LanguageServer.LaunchArgs);
  const specifiedCores = parseInt(Configuration.get<string>(ConfigurationConstants.LanguageServer.VerificationVirtualCores));
  // This is a temporary fix to prevent 0 cores from being used, since the languages server currently does not handle 0 cores correctly: https://github.com/dafny-lang/dafny/pull/3276
  const cores = isNaN(specifiedCores) || specifiedCores === 0 ? Math.ceil((os.cpus().length + 1) / 2) : Math.max(1, specifiedCores);
  const displayGutterIcons = Configuration.get<boolean>(ConfigurationConstants.LanguageServer.DisplayGutterStatus);
  return [
    `--verify-on:${verifyOn}`,
    `--verification-time-limit:${Configuration.get<string>(ConfigurationConstants.LanguageServer.VerificationTimeLimit)}`,
    getVerifierCachingPolicy(),
    `--cores:${cores}`,
    `--notify-ghostness:${Configuration.get<string>(ConfigurationConstants.LanguageServer.MarkGhostStatements)}`,
    '--notify-line-verification-status:false',
    `--show-assertions:${displayGutterIcons ? 'All' : 'Implicit'}`,
    ...getDafnyPluginsArgument(),
    ...launchArgs
  ];
}

function getLanguageServerLaunchArgsOld(): string[] {
  const launchArgs = Configuration.get<string[]>(ConfigurationConstants.LanguageServer.LaunchArgs);
  return [
    getVerificationArgument(),
    getVerifierTimeLimitArgument(),
    getVerifierCachingPolicyOld(),
    getVerifierVirtualCoresArgument(),
    getMarkGhostStatementsArgument(),
    getDisplayGutterStatusArgument(),
    ...getDafnyPluginsArgumentOld(),
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
  return `--cache-verification=${verifySnapshots}`;
}

function getVerifierCachingPolicyOld(): string {
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

function getDafnyPluginsArgumentOld(): string[] {
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

function getDafnyPluginsArgument(): string[] {
  const plugins = Configuration.get<string[]>(ConfigurationConstants.LanguageServer.DafnyPlugins);
  if(plugins === null || !Array.isArray(plugins)) {
    return [];
  }
  return (
    plugins
      .filter(plugin => plugin !== null && plugin !== '')
      .map((plugin, i) => `--plugin:${i}=${plugin}`)
  );
}

type DiagnosticListener = (uri: Uri, diagnostics: Diagnostic[]) => void;

export class DafnyLanguageClient extends LanguageClient {

  // eslint-disable-next-line max-params
  private constructor(id: string, name: string, serverOptions: ServerOptions, clientOptions: LanguageClientOptions,
    private readonly diagnosticsListeners: DiagnosticListener[], forceDebug?: boolean) {
    super(id, name, serverOptions, clientOptions, forceDebug);
    this.diagnosticsListeners = diagnosticsListeners;
    this.onReady().then(() => {
      this.onNotification('dafny/textDocument/symbolStatus', params => this._onVerificationSymbolStatus.fire(params));
    });
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

  public static async create(installer: DafnyInstaller): Promise<DafnyLanguageClient> {
    const exec = await installer.getCliExecutable(true, getLanguageServerLaunchArgsNew(), getLanguageServerLaunchArgsOld());

    installer.statusOutput.appendLine(`Language server: ${JSON.stringify(exec)}`);
    const serverOptions: ServerOptions = {
      run: exec,
      debug: exec
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

  private readonly _onVerificationSymbolStatus: EventEmitter<IVerificationSymbolStatusParams> = new EventEmitter();

  public OnVerificationSymbolStatus: Event<IVerificationSymbolStatusParams> = this._onVerificationSymbolStatus.event;

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
