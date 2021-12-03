import { ExtensionContext, Disposable, OutputChannel } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';

import Configuration from '../configuration';
import { ConfigurationConstants } from '../constants';
import { getDotnetExecutablePath } from '../dotnet';
import { DafnyDocumentFilter } from '../tools/vscode';
import { ICompilationStatusParams, IVerificationCompletedParams, IVerificationStartedParams } from './api/compilationStatus';
import { ICounterExampleItem, ICounterExampleParams } from './api/counterExample';
import { IGhostDiagnosticsParams } from './api/ghostDiagnostics';
import { getLanguageServerRuntimePath } from './dafnyInstallation';

const LanguageServerId = 'dafny-vscode';
const LanguageServerName = 'Dafny Language Server';

function getLanguageServerLaunchArgs(): string[] {
  const launchArgs = Configuration.get<string[]>(ConfigurationConstants.LanguageServer.LaunchArgs);
  return [
    getVerificationArgument(),
    getVerifierTimeLimitArgument(),
    getVerifierVirtualCoresArgument(),
    getMarkGhostStatementsArgument(),
    ...launchArgs
  ];
}

function getVerificationArgument(): string {
  return `--documents:verify=${Configuration.get<string>(ConfigurationConstants.LanguageServer.AutomaticVerification)}`;
}

function getVerifierTimeLimitArgument(): string {
  return `--verifier:timelimit=${Configuration.get<string>(ConfigurationConstants.LanguageServer.VerificationTimeLimit)}`;
}

function getVerifierVirtualCoresArgument(): string {
  return `--verifier:vcscores=${Configuration.get<string>(ConfigurationConstants.LanguageServer.VerificationVirtualCores)}`;
}

function getMarkGhostStatementsArgument(): string {
  return `--ghost:markStatements=${Configuration.get<string>(ConfigurationConstants.LanguageServer.MarkGhostStatements)}`;
}

export class DafnyLanguageClient extends LanguageClient {
  private statusOutput: OutputChannel;

  // eslint-disable-next-line max-params
  private constructor(
      id: string,
      name: string,
      serverOptions: ServerOptions,
      clientOptions: LanguageClientOptions,
      outputChannel: OutputChannel,
      forceDebug?: boolean
    ) {
    super(id, name, serverOptions, clientOptions, forceDebug);
    this.statusOutput = outputChannel;
  }

  public getCounterExamples(param: ICounterExampleParams): Promise<ICounterExampleItem[]> {
    return this.sendLoggedRequest<ICounterExampleParams, ICounterExampleItem[]>(
      'dafny/counterExample', param
    );
  }

  public static async create(context: ExtensionContext, outputChannel: OutputChannel): Promise<DafnyLanguageClient> {
    const dotnetExecutable = await getDotnetExecutablePath();
    const launchArguments = [ getLanguageServerRuntimePath(context), ...getLanguageServerLaunchArgs() ];
    const serverOptions: ServerOptions = {
      run: { command: dotnetExecutable, args: launchArguments },
      debug: { command: dotnetExecutable, args: launchArguments }
    };
    const clientOptions: LanguageClientOptions = {
      documentSelector: [ DafnyDocumentFilter ],
      diagnosticCollectionName: LanguageServerId
    };
    return new DafnyLanguageClient(LanguageServerId, LanguageServerName, serverOptions, clientOptions, outputChannel);
  }

  public onGhostDiagnostics(callback: (params: IGhostDiagnosticsParams) => void): Disposable {
    return this.onLoggedNotification('dafny/ghost/diagnostics', callback);
  }

  public onCompilationStatus(callback: (params: ICompilationStatusParams) => void): Disposable {
    return this.onLoggedNotification('dafny/compilation/status', callback);
  }

  public onServerVersion(callback: (version: string) => void): Disposable {
    return this.onLoggedNotification('dafnyLanguageServerVersionReceived', callback);
  }

  // TODO Legacy verification status messages
  public onVerificationStarted(callback: (params: IVerificationStartedParams) => void): Disposable {
    return this.onLoggedNotification('dafny/verification/started', callback);
  }

  public onVerificationCompleted(callback: (params: IVerificationCompletedParams) => void): Disposable {
    return this.onLoggedNotification('dafny/verification/completed', callback);
  }

  private onLoggedNotification<TParams, TResult>(route: string, callback: (params: TParams) => TResult): Disposable {
    return this.onNotification(route, (params: TParams) => {
      this.statusOutput.appendLine(`Received ${route}`);
      this.statusOutput.appendLine(JSON.stringify(params));
      return callback(params);
    });
  }

  private sendLoggedRequest<TParam, TResult>(route: string, param: TParam): Promise<TResult>  {
    this.statusOutput.appendLine(`Sent ${JSON.stringify(param)} to ${route}`);
    return this.sendRequest<TResult>(route, param);
  }
}
