# Release process:

1. Look for all the recent changes since the last version https://github.com/dafny-lang/ide-vscode/commits/master
   and write a summary of each relevant commit in `CHANGELOG.md`
2. Update `package.json`
  - Upgrade the version number of the extension in `package.json` (line 5) (let's assume it's A.B.C)
  - Search for `"dafny.preferredVersion":`, and add the most recent Dafny version number to the head of the list (let's assume it's X.Y.Z)
3. Update `src/constants.ts`
  - Change `LanguageServerConstants.LatestVersion = "X.Y.Z"` for the same version number that you put.
4. Commit your changes in a branch named `dafny-X.Y.Z`
   Your commit message could be `chore: Bump version to A.B.C`
5. Push this branch on the server, have it merged (after necessary approval)
6. Pull the most recent master branch of the extension.
7. Add the tag with the command `git tag vA.B.C` and push it with `git push origin vA.B.C`

This last step will trigger the Github bot, which will automatically release the new version.
