import * as fs from 'fs';
import * as path from 'path';

import { ExtensionContext } from 'vscode';
import { Disposable, LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';

import Configuration from '../configuration';
import { ConfigurationConstants, LanguageConstants, LanguageServerConstants } from '../constants';
import { getDotnetExecutablePath } from '../dotnet';
import { ICompilationStatusParams } from './api/compilationStatus';
import { ICounterExampleItem, ICounterExampleParams } from './api/counterExample';

const LanguageServerId = 'dafny-vscode';
const LanguageServerName = 'Dafny Language Server';

export function isCustomLanguageServerInstallation(context: ExtensionContext): boolean {
  return getLanguageServerRuntimePath(context) == null;
}

export async function isLanguageServerRuntimeAccessible(context: ExtensionContext): Promise<boolean> {
  const languageServerDll = getLanguageServerRuntimePath(context);
  try {
    await fs.promises.access(languageServerDll, fs.constants.R_OK);
    return true;
  } catch(error: unknown) {
    console.error(`cannot access language server: ${error}`);
    return false;
  }
}

function getLanguageServerRuntimePath(context: ExtensionContext): string {
  const configuredPath = getConfiguredLanguageServerRuntimePath() ?? LanguageServerConstants.DefaultPath;
  if(path.isAbsolute(configuredPath)) {
    return configuredPath;
  }
  return path.join(context.extensionPath, configuredPath);
}

function getConfiguredLanguageServerRuntimePath(): string | null {
  return Configuration.get<string | null>(ConfigurationConstants.LanguageServer.RuntimePath);
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

  public static async create(context: ExtensionContext): Promise<DafnyLanguageClient> {
    const dotnetExecutable = await getDotnetExecutablePath();
    const launchArguments = [ getLanguageServerRuntimePath(context), ...getLanguageServerLaunchArgs() ];
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

  public onServerVersion(callback: (version: string) => void): Disposable {
    return this.onNotification('dafnyLanguageServerVersionReceived', callback);
  }

  // TODO legacy status messages for dafny 3.2.
}
