export function timeout(ms: number): Promise<void>;
export function timeout<TResult>(ms: number, result: TResult): Promise<TResult>;
export function timeout<TResult>(ms: number, result?: TResult): Promise<TResult | undefined> {
  return new Promise<TResult | undefined>(resolve => {
    setTimeout(() => resolve(result), ms);
  });
}
