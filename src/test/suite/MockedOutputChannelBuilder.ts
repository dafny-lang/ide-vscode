import * as vscode from 'vscode';

/** Helper to created a mocked output channel, where writtenContent() can be invoked to inspect what was written to. */
export class MockedOutputChannelBuilder {
  public outputChannel: vscode.OutputChannel;
  private content: string;
  public constructor() {
    this.content = '';
    this.outputChannel = {
      writeStatus: (str: string) => {
        this.content += str;
      },
      append: (str: string) => {
        this.content += str;
      },
      appendLine: (str: string) => {
        this.content += str + '\n';
      },
      show() { }
    } as unknown as vscode.OutputChannel;
  }

  public writtenContent(): string {
    return this.content;
  }
}
