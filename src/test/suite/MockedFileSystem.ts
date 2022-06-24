export type MethodMockup = string | ((str: string, params: any[]) => any);

export class MockedFileSystem {
  public expectations: MethodMockup[];
  public constructor(expectations: MethodMockup[]) {
    this.expectations = expectations;
  }
  private consumeExpecting(str: string, params: any[]) {
    if(this.expectations.length > 0) {
      const firstExpectation = this.expectations[0];
      if(typeof firstExpectation === 'string') {
        if(firstExpectation !== str) {
          throw `Expected ${firstExpectation}, but got fs.${str}`;
        }
      } else {
        firstExpectation(str, params);
      }
      this.expectations.splice(0, 1);
    } else {
      throw `Expected nothing, but got a call to fs.${str}`;
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
