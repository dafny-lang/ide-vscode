import { Disposable } from 'vscode-languageclient';

interface IPreviousRequest {
  timeout: NodeJS.Timeout;
  reject: (error?: any) => any;
}

export class DebounceError extends Error {}

export interface IDebouncedFunction<TParam extends readonly any[], TResult> extends Disposable {
  (...args: TParam): Promise<TResult>,
}

export function debounce<TParam extends readonly any[], TResult>(fn: (...args: TParam) => TResult, delayMs: number): IDebouncedFunction<TParam, TResult> {
  let previousRequest: IPreviousRequest | undefined;
  const cancelPreviousRequest = () => {
    if(previousRequest != null) {
      clearTimeout(previousRequest.timeout);
      previousRequest.reject(new DebounceError());
    }
  };
  const debouncedFunction = (...args: TParam) => new Promise<TResult>((resolve, reject) => {
    cancelPreviousRequest();
    previousRequest = {
      reject,
      timeout: setTimeout(
        () => {
          previousRequest = undefined;
          resolve(fn(...args));
        },
        delayMs
      )
    };
  });
  debouncedFunction.dispose = cancelPreviousRequest;
  return debouncedFunction;
}
