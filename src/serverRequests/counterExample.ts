"use strict";
import { ide, LanguageClient, ResponseError } from "../ideApi/_IdeApi";
import {
  LanguageServerRequest,
  Error,
  CounterExampleConfig,
} from "../stringResources/_StringResourcesModule";
import {
  ICounterExamples,
  ICounterExampleArguments,
} from "../typeInterfaces/_TypeInterfacesModule";

import { ICounterExample } from "./ICounterExample";

/**
 * Provides Counter Examples provided by the Dafny language server.
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
    if (!ide.window.activeTextEditor) {
      return;
    }
    const arg: ICounterExampleArguments = {
      DafnyFile: ide.window.activeTextEditor.document.fileName,
    };
    ide.window.activeTextEditor.document.save().then(() => {
      // This timeout makes sure, that server requests per second were capped.
      clearTimeout(CounterExample.timeout);
      const boundThis = this;
      CounterExample.timeout = setTimeout(
        function () {
          boundThis.languageServer
            .sendRequest<ICounterExamples>(
              LanguageServerRequest.CounterExample,
              arg
            )
            .then(
              (allCounterExamples: ICounterExamples) => {
                callback(allCounterExamples, isAutoTriggered);
              },
              (error: ResponseError<void>) => {
                ide.window.showErrorMessage(
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
