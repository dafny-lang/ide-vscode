import { MethodMockup, MockedFileSystem } from './MockedFileSystem';

export class MockedWorkspace {
  public sections: { [section: string]: Map<string, string> };
  public fs: MockedFileSystem | undefined;

  public constructor(
    sections: { [section: string]: Map<string, string> }
  ) {
    this.sections = sections;
  }
  public getConfiguration(section: string): Map<string, string> {
    return this.sections[section];
  }
  public setFileExpects(expectations: MethodMockup[]): void {
    this.fs = new MockedFileSystem(expectations);
  }
}
