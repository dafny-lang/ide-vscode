import { ExtensionContext, Event, EventEmitter } from 'vscode';
import { DafnyLanguageClient } from '../language/dafnyLanguageClient';
import { IVerificationSymbolStatusParams } from '../language/api/verificationSymbolStatusParams';


/**
 * This class shows verification tasks through the VSCode testing UI.
 */
export default class SymbolStatusService {
  private readonly updatesPerFile: Map<string, IVerificationSymbolStatusParams> = new Map();
  private readonly _onUpdates: EventEmitter<IVerificationSymbolStatusParams> = new EventEmitter();
  public onUpdates: Event<IVerificationSymbolStatusParams> = this._onUpdates.event;

  public constructor(
    context: ExtensionContext,
    languageClient: DafnyLanguageClient) {

    context.subscriptions.push(
      languageClient.onVerificationSymbolStatus(params => {
        this.updatesPerFile.set(params.uri, params);
        this._onUpdates.fire(params);
      })
    );
  }

  public getUpdatesForFile(uri: string): IVerificationSymbolStatusParams | undefined {
    return this.updatesPerFile.get(uri);
  }
}