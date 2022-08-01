
export interface IDisposable {
	dispose(): void;
}

export interface Event<T> {
	(listener: (e: T) => any, thisArgs?: any, disposables?: IDisposable[] /*| DisposableStore*/): IDisposable;
}

/**
 * Given an event, returns another event which only fires once.
 */
export function once<T>(event: Event<T>): Event<T> {
  return (listener, thisArgs = null, disposables?) => {
    const result: IDisposable = event(e => {
      result.dispose();

      return listener.call(thisArgs, e);
    }, null, disposables);

    return result;
  };
}

export function toPromise<T>(event: Event<T>): Promise<T> {
  return new Promise(c => once(event)(c));
}