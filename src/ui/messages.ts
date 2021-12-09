export namespace Messages {
  export namespace CompilationStatus {
    export const ParsingFailed = '$(thumbsdown) Parsing Failed';
    export const ResolutionFailed = '$(thumbsdown) Resolution Failed';
    export const CompilationSucceeded = '$(book) Resolved (not verified)';
    export const Verifying = '$(sync~spin) Verifying...';
    export const VerificationInProgressHeader = '$(sync~spin) ';
    export const VerificationSucceeded = '$(thumbsup) Verification Succeeded';
    export const VerificationFailed = '$(thumbsdown) Verification Failed';

    export const Verified = '$(thumbsup) Verified';
    export const NotVerified = '$(thumbsdown) Not Verified';
  }

  export namespace Compiler {
    export const CustomArgumentsPrompt = 'Dafny Compilation Arguments';
    export const NoArgumentsGiven = 'No additional arguments given';
  }

  export namespace Installation {
    export const Error = 'An error occurred during the installation of Dafny.';
    export const Outdated = 'Your Dafny installation is outdated: ';
  }

  export namespace Dotnet {
    export const NoCompatibleInstallation = 'There is no compatible dotnet runtime installed. Dafny requires the ASP.NET Core Runtime 5.0.';
    export const ChangeConfiguration = 'Change dafny.dotnetExecutablePath';
    export const VisitDownload = 'Get dotnet';
    export const DownloadUri = 'https://dotnet.microsoft.com/download/dotnet/5.0';
  }
}
