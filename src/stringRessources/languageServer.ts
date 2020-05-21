// tslint:disable:max-classes-per-file

/**
 * Strings in this class have to match the command strings on the Language Server side!
 * LSP extended commands.
 */
export class LanguageServerRequest {
  public static Compile: string = "compile";
  public static CounterExample: string = "counterExample";
}

/**
 * Strings in this file have to match the command strings on the Language Server side!
 * Server side send commands that the client should listen to.
 * LSP extended notifications.
 */
export class LanguageServerNotification {
  public static Error: string = "ERROR";
  public static Warning: string = "WARNING";
  public static Info: string = "INFO";
  public static UpdateStatusbar: string = "updateStatusbar";
  public static ServerStarted: string = "serverStarted";
  public static ActiveVerifiyingDocument: string = "activeVerifiyingDocument";
  public static Verify: string = "verify";
  public static Ready: string = "ready";
  public static CounterExample: string = "counterExample";
}
