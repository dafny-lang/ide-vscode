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
    getVerifierCachingPolicy(),
    getVerifierVirtualCoresArgument(),
    getMarkGhostStatementsArgument(),
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

export class DafnyLanguageClient extends LanguageClient {
  // eslint-disable-next-line max-params
  private constructor(id: string, name: string, serverOptions: ServerOptions, clientOptions: LanguageClientOptions, forceDebug?: boolean) {
    super(id, name, serverOptions, clientOptions, forceDebug);
  }

  public getCounterExamples(param: ICounterExampleParams): Promise<ICounterExampleItem[]> {
    return this.sendRequest<ICounterExampleItem[]>('dafny/counterExample', param);
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
    const launchArguments = [ getLanguageServerRuntimePath(context), ...getLanguageServerLaunchArgs() ];
    statusOutput.appendLine(`Language server arguments: ${DafnyLanguageClient.argumentsToCommandLine(launchArguments)}`);
    const serverOptions: ServerOptions = {
      run: { command: dotnetExecutable, args: launchArguments },
      debug: { command: dotnetExecutable, args: launchArguments }
    };
    const clientOptions: LanguageClientOptions = {
      documentSelector: [ DafnyDocumentFilter ],
      diagnosticCollectionName: LanguageServerId
    };
    return new DafnyLanguageClient(LanguageServerId, LanguageServerName, serverOptions, clientOptions);
  }

  public onGhostDiagnostics(callback: (params: IGhostDiagnosticsParams) => void): Disposable {
    return this.onNotification('dafny/ghost/diagnostics', callback);
  }

  public onCompilationStatus(callback: (params: ICompilationStatusParams) => void): Disposable {
    return this.onNotification('dafny/compilation/status', callback);
  }

  public onServerVersion(callback: (version: string) => void): Disposable {
    return this.onNotification('dafnyLanguageServerVersionReceived', callback);
  }

  // TODO Legacy verification status messages
  public onVerificationStarted(callback: (params: IVerificationStartedParams) => void): Disposable {
    return this.onNotification('dafny/verification/started', callback);
  }

  public onVerificationCompleted(callback: (params: IVerificationCompletedParams) => void): Disposable {
    return this.onNotification('dafny/verification/completed', callback);
  }
}
