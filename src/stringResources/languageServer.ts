/**
 * Strings in this class have to match the command strings registered in the language server.
 * LSP extended commands.
 */
export class LanguageServerRequest {
  public static Compile: string = "compile";
  public static CounterExample: string = "dafny/counterExample";
}

/**
 * Strings in this file have to match the command strings registered in the language server.
 * Server side send commands that the client should listen to.
 * LSP extended notifications.
 */
export class LanguageServerNotification {
  public static Error: string = "ERROR";
  public static Warning: string = "WARNING";
  public static Info: string = "INFO";
  public static UpdateStatusbar: string = "updateStatusbar";
  public static ServerStarted: string = "serverStarted";
  public static DafnyLanguageServerVersionReceived: string =
    "dafnyLanguageServerVersionReceived";

  public static VerificationStarted: string = "dafny/verification/started";
  public static VerificationCompleted: string = "dafny/verification/completed";
}

/**
 * Configuration settings for the Dafny language server
 * These settings are mostly no longer necessary
 * with the later adapted languageServerInstaller for the Dafny language server Github CI.
 */
export class LanguageServerConfig {
  public static ServerFolder: string = "dafnyLanguageServer";
  public static RequiredVersion: string = "3.0.0";

  private static DownloadBaseUri: string =
    "https://github.com/dafny-lang/language-server-csharp/releases/download";
  public static getServerDownloadAddress(platformSuffix: string): string {
    return `${this.DownloadBaseUri}/v${LanguageServerConfig.RequiredVersion}/DafnyLS-${platformSuffix}.zip`;
  }
}
