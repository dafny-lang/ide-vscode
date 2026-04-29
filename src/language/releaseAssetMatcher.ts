/**
 * Pure helpers for selecting a Dafny release asset from GitHub Releases API
 * output. No VS Code or Node-specific imports — kept in its own module so it
 * can be unit-tested directly under plain Node/Mocha.
 *
 * Dafny release asset names follow the pattern
 *   dafny-<version>-<arch>-<os-token>[-<os-version>].zip
 * where <os-token> is one of:
 *   - Darwin:  macos-<year> (current) or osx-<version> (very old)
 *   - Linux:   ubuntu-<version>
 *   - Windows: windows-<year> (current) or win (very old)
 */

/**
 * Given the list of asset names that a specific release actually published,
 * the Dafny version the caller wants, and the target (arch, os.type()), pick
 * the best matching asset name, or return undefined if no asset matches.
 *
 * Version-pinning is load-bearing for the `nightly` tag: the nightly release
 * accumulates hundreds of dated builds (e.g. `dafny-nightly-2026-04-28-...`)
 * across many months, and the caller's resolved version string (e.g.
 * `nightly-2026-04-28-99d0f0d`) is what distinguishes "today's nightly" from
 * all the older ones. For stable tags there is only one Dafny asset per
 * (arch, os), so the version filter is a no-op.
 *
 * When several assets still match after version-pinning (e.g. a future nightly
 * lists both macos-13 and macos-14 variants of the same build), the one with
 * the highest OS-version suffix wins, matching "the newest runner Dafny built
 * this release on".
 */
export function pickAssetForPlatform(
  assetNames: readonly string[],
  version: string,
  arch: string,
  osType: string
): string | undefined {
  const osFamilyPrefixes = osTokenPrefixesFor(osType);
  if(osFamilyPrefixes === undefined) {
    return undefined;
  }
  // Accept only .zip files matching `dafny-<version>-<arch>-<os-token>...`.
  // Anchoring on `dafny-<version>-` avoids picking a differently-dated nightly
  // or an unrelated attachment; requiring `-<arch>-` avoids picking an arm64
  // build when x64 was requested (and vice versa).
  const versionPrefix = `dafny-${version}-`;
  const archSegment = `-${arch}-`;
  const candidates = assetNames
    .filter(name => name.endsWith('.zip'))
    .filter(name => name.startsWith(versionPrefix))
    .filter(name => name.includes(archSegment))
    .map(name => {
      const afterArch = name.substring(name.lastIndexOf(archSegment) + archSegment.length);
      const osToken = afterArch.replace(/\.zip$/, '');
      return { name, osToken };
    })
    .filter(c => osFamilyPrefixes.some(prefix => c.osToken === prefix || c.osToken.startsWith(`${prefix}-`)));
  if(candidates.length === 0) {
    return undefined;
  }
  if(candidates.length === 1) {
    return candidates[0].name;
  }
  // Tiebreak by the numeric tail of the OS token (macos-14 > macos-13, and
  // `windows-2022` beats bare `win`). Fall back to lexicographic order for
  // total stability.
  candidates.sort((a, b) => compareOsTokens(b.osToken, a.osToken));
  return candidates[0].name;
}

function osTokenPrefixesFor(osType: string): readonly string[] | undefined {
  switch(osType) {
  case 'Darwin':
    return [ 'macos', 'osx' ];
  case 'Linux':
    return [ 'ubuntu' ];
  case 'Windows_NT':
    return [ 'windows', 'win' ];
  default:
    return undefined;
  }
}

function compareOsTokens(a: string, b: string): number {
  const aParts = parseOsTokenVersion(a);
  const bParts = parseOsTokenVersion(b);
  for(let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const diff = (aParts[i] ?? -1) - (bParts[i] ?? -1);
    if(diff !== 0) {
      return diff;
    }
  }
  return a.localeCompare(b);
}

function parseOsTokenVersion(token: string): number[] {
  // e.g. 'macos-14' → [14]; 'osx-10.14.2' → [10,14,2]; 'win' → []
  const dashIndex = token.indexOf('-');
  if(dashIndex < 0) {
    return [];
  }
  return token.substring(dashIndex + 1).split('.').map(n => {
    const parsed = Number.parseInt(n, 10);
    return Number.isFinite(parsed) ? parsed : -1;
  });
}
