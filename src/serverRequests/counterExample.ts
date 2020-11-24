"use strict";
import { window, LanguageClient, ResponseError, TextDocumentIdentifier } from "../ideApi/_IdeApi";
import {
  LanguageServerRequest,
  Error,
  CounterExampleConfig,
} from "../stringResources/_StringResourcesModule";
import {
  ICounterExampleItem,
  ICounterExampleArguments,
} from "../typeInterfaces/_TypeInterfacesModule";

import { ICounterExample } from "./ICounterExample";

/**
 * Provides counter examples received from the Dafny language server.
 */
export class CounterExample implements ICounterExample {
  private static timeout: NodeJS.Timer;
  private readonly maxRequestsPerSecond: number =
    CounterExampleConfig.MaxRequestsPerSecond;
  private readonly oneSecInMs: number = 1000;

  private languageServer: LanguageClient;

  constructor(languageServer: LanguageClient) {
    this.languageServer = languageServer;
  }

  public getCounterExample(
    callback: Function,
    isAutoTriggered: boolean = false
  ) {
    if (!window.activeTextEditor) {
      return;
    }
    const arg: ICounterExampleArguments = {
      TextDocument: TextDocumentIdentifier.create(window.activeTextEditor.document.uri.toString()),
    };
    window.activeTextEditor.document.save().then(() => {
      // This timeout makes sure that the maximal amount of requests per second is capped.
      clearTimeout(CounterExample.timeout);
      const boundThis = this;
      CounterExample.timeout = setTimeout(
        function () {
          boundThis.languageServer
            .sendRequest<ICounterExampleItem[]>(
              LanguageServerRequest.CounterExample,
              arg
            )
            .then(
              (allCounterExamples: ICounterExampleItem[]) => {
                callback(allCounterExamples, isAutoTriggered);
              },
              (error: ResponseError<void>) => {
                window.showErrorMessage(
                  `${Error.CanNotGetCounterExample}: ${error.message}`
                );
              }
            );
        },
        isAutoTriggered ? this.oneSecInMs / this.maxRequestsPerSecond : 1
      );
    });
  }
}
