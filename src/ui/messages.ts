export namespace Messages {
  export namespace CompilationStatus {
    export const ResolutionStarted = '$(sync~spin) Resolving...';
    export const ParsingFailed = '$(thumbsdown) Parsing Failed';
    export const ResolutionFailed = '$(thumbsdown) Resolution Failed';
    export const CompilationSucceeded = '$(book) Resolved (not verified)';
    export const Verifying = '$(sync~spin) Verifying';
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
    export const IsNotAnExecutableFile = ' is not an executable dotnet file.';
    export const NotASupportedDotnetInstallation = ' is not a compatible dotnet file. Dafny requires the ASP.NET Core Runtime 5.0 or 6.0, got ';
    export const FailedDotnetExecution = 'Failed to execute dotnet. Dafny requires the ASP.NET Core Runtime 5.0 or 6.0.';
    export const NoCompatibleInstallation = 'No compatible dotnet runtime found. Dafny requires the ASP.NET Core Runtime 5.0 or 6.0.';
    export const ChangeConfiguration = 'Configure the absolute path to dotnet';
    export const VisitDownload = 'Get dotnet';
    export const DownloadUri = 'https://dotnet.microsoft.com/download/dotnet/6.0';
  }
}
