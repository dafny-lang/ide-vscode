export type MethodMockup = string | ((method: string, params: any[]) => any);

export class MockedFileSystem {
  public expectations: MethodMockup[];
  public constructor(expectations: MethodMockup[]) {
    this.expectations = expectations;
  }
  private consumeExpecting(method: string, params: any[]) {
    if(this.expectations.length > 0) {
      const firstExpectation = this.expectations[0];
      if(typeof firstExpectation === 'string') {
        if(firstExpectation !== method) {
          throw `Expected ${firstExpectation}, but got fs.${method}`;
        }
      } else {
        firstExpectation(method, params);
      }
      this.expectations.splice(0, 1);
    } else {
      throw `Expected nothing, but got a call to fs.${method}`;
    }
  }
  public delete(...params: any[]): Promise<void> {
    try {
      return Promise.resolve(this.consumeExpecting('delete', params));
    } catch(e: unknown) {
      return Promise.reject(e);
    }
  }
}
