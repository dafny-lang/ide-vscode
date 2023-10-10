export namespace Messages {
  export namespace CompilationStatus {
    export const Parsing = '$(sync~spin) Parsing...';
    export const Resolving = '$(sync~spin) Resolving...';
    export const ParsingFailed = '$(thumbsdown) Parsing Failed';
    export const ResolutionFailed = '$(thumbsdown) Resolution Failed';
    export const PreparingVerification = '$(sync~spin) Preparing verification...';
    export const CompilationSucceeded = '$(book) Resolved (not verified)';
    export const Verifying = '$(sync~spin) Verifying';
    export const VerificationSucceeded = '$(thumbsup) Verification Succeeded';
    export const VerificationFailedOld = '$(thumbsdown) Verification Failed';
    export const VerificationFailed = '$(thumbsdown) Could not prove';

    export const Verified = '$(thumbsup) Verified';
    export const NotVerified = '$(thumbsdown) Not Verified';
  }

  export namespace Compiler {
    export const CustomArgumentsPrompt = 'Dafny Compilation Arguments';
    export const NoArgumentsGiven = 'No additional arguments given';
  }

  export namespace Installation {
    export const Start = 'Starting Dafny installation';
    export const Error = 'An error occurred during the installation of Dafny.';
    export const Completed = 'Dafny installation completed';
    export const Outdated = 'Your Dafny installation is outdated: ';
  }

  export namespace Dotnet {
    export const IsNotAnExecutableFile = ' is not an executable dotnet file.';
    export const NotASupportedDotnetInstallation = ' is not a compatible dotnet file. Dafny requires the .NET Runtime 5.0 or greater, found ';
    export const FailedDotnetExecution = 'Failed to execute dotnet. Dafny requires the .NET Runtime 5.0 or greater.';
    export const NoCompatibleInstallation = 'No compatible dotnet runtime found. Dafny requires the .NET Runtime 5.0 or greater.';
    export const ChangeConfiguration = 'Configure the absolute path to dotnet';
    export const VisitDownload = 'Get .NET SDK';
    export const DownloadUri = 'https://dotnet.microsoft.com/download/dotnet/6.0';
  }
}
