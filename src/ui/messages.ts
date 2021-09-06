export namespace Messages {
  export namespace CompilationStatus {
    export const ParsingFailed = '$(thumbsdown) Parsing Failed';
    export const ResolutionFailed = '$(thumbsdown) Resolution Failed';
    export const CompilationSucceeded = '$(thumbsup) Compilation Succeeded';
    export const Verifying = '$(sync~spin) Verifying...';
    export const VerificationSucceeded = '$(thumbsup) Verification Succeeded';
    export const VerificationFailed = '$(thumbsdown) Not verified';
  }

  export namespace Compiler {
    export const CustomArgumentsPrompt = 'Dafny Compilation Arguments';
    export const NoArgumentsGiven = 'No additional arguments given';
  }

  export namespace LanguageServer {
    export const DownloadFailed = 'Language server download failed: ';
    export const NoContent = 'No content';
  }
}
