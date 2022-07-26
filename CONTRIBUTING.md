# Release process:

## Semi-automated release process (preferred)

1. Run `./publish_process.js` (with Node installed)
   - Choose to bump the patch, minor or major version as asked.
   - Fix the ChangeLog that is automatically populated and opened for you.
   - If there is a new release of Dafny, it will suggest to bump the Dafny version.
   Then it creates the branch, pushes it and give you a link for the PR.
2. Create the PR, have it reviewed and merged (adding more commits is fine)
3. Relaunch the script. It will detect the PR merge;
   - Confirm the publication of the new version.

## Manual release process stps

1. Look for all the recent changes since the last version https://github.com/dafny-lang/ide-vscode/commits/master
   and write a summary of each relevant commit in `CHANGELOG.md`
2. Update `package.json`
  - Upgrade the version number of the extension in `package.json` (line 5) (let's assume it's A.B.C)
  - [If Dafny changed] Search for `"dafny.preferredVersion":`, and add the most recent Dafny version number to the head of the list (let's assume it's X.Y.Z)
3. [If Dafny changed] Update `src/constants.ts`
  - Change `LanguageServerConstants.LatestVersion = "X.Y.Z"` for the same version number that you put.
4. Commit your changes in a branch named `release-A.B.C
   Your commit message could be `chore: Release vA.B.C` optionally adding ` with support for Dafny X.Y.Z`
5. Push this branch on the server, have it merged (after necessary approval)
6. Pull the most recent master branch of the extension.
7. Add the tag with the command `git tag vA.B.C` and push it with `git push origin vA.B.C`

This last step will trigger the workflow, which will automatically release the new version.
