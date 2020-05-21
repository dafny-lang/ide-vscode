export interface ILanguageServer {
  startLanguageServer(): void;
  registerServerRestartCommand(): void;
}
