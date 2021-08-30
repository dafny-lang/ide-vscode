import * as fs from 'fs';

import { Disposable, LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';

import Configuration from '../configuration';
import { ConfigurationConstants, LanguageConstants } from '../constants';
import { getDotnetExecutablePath } from '../dotnet';
import { ICompilationStatusParams } from './api/compilationStatus';
import { ICounterExampleItem, ICounterExampleParams } from './api/counterExample';

const LanguageServerId = 'dafny-vscode';
const LanguageServerName = 'Dafny Language Server';

export async function isLanguageServerRuntimeAccessible(): Promise<boolean> {
  const languageServerDll = getLanguageServerRuntimePath();
  try {
    await fs.promises.access(languageServerDll, fs.constants.R_OK);
    return true;
  } catch(error: unknown) {
    console.error(`cannot access language server: ${error}`);
    return false;
  }
}

function getLanguageServerRuntimePath(): string {
  return Configuration.get<string>(ConfigurationConstants.LanguageServer.RuntimePath);
}

function getLanguageServerLaunchArgs(): string[] {
  const launchArgs = Configuration.get<string[]>(ConfigurationConstants.LanguageServer.LaunchArgs);
  return [ getVerificationArgument(), ...launchArgs ];
}

function getVerificationArgument(): string {
  return `--documents:verify=${Configuration.get<string>(ConfigurationConstants.LanguageServer.AutomaticVerification)}`;
}

export class DafnyLanguageClient extends LanguageClient {
  // eslint-disable-next-line max-params
  private constructor(id: string, name: string, serverOptions: ServerOptions, clientOptions: LanguageClientOptions, forceDebug?: boolean) {
    super(id, name, serverOptions, clientOptions, forceDebug);
  }

  public getCounterExamples(param: ICounterExampleParams): Promise<ICounterExampleItem[]> {
    return this.sendRequest<ICounterExampleItem[]>('dafny/counterExample', param);
  }

  public static async create(): Promise<DafnyLanguageClient> {
    const dotnetExecutable = await getDotnetExecutablePath();
    const launchArguments = [ getLanguageServerRuntimePath(), ...getLanguageServerLaunchArgs() ];
    const serverOptions: ServerOptions = {
      run: { command: dotnetExecutable, args: launchArguments },
      debug: { command: dotnetExecutable, args: launchArguments }
    };
    const clientOptions: LanguageClientOptions = {
      documentSelector: [
        { scheme: 'file', language: LanguageConstants.Id }
      ],
      diagnosticCollectionName: LanguageServerId
    };
    return new DafnyLanguageClient(LanguageServerId, LanguageServerName, serverOptions, clientOptions);
  }

  public onCompilationStatus(callback: (params: ICompilationStatusParams) => void): Disposable {
    return this.onNotification('dafny/compilation/status', callback);
  }

  // TODO legacy status messages for dafny 3.2.
}
