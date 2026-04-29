import * as assert from 'assert';
import { pickAssetForPlatform } from '../../language/releaseAssetMatcher';

// Real v4.11.0 asset list (verified via `gh release view v4.11.0`).
const v411Assets = [
  'dafny-4.11.0-arm64-macos-13.zip',
  'dafny-4.11.0-x64-macos-13.zip',
  'dafny-4.11.0-x64-ubuntu-22.04.zip',
  'dafny-4.11.0-x64-windows-2022.zip',
  'DafnyRef.pdf'
];

// Real v4.10.0 asset list.
const v410Assets = [
  'dafny-4.10.0-arm64-macos-11.zip',
  'dafny-4.10.0-x64-macos-11.zip',
  'dafny-4.10.0-x64-ubuntu-20.04.zip',
  'dafny-4.10.0-x64-windows-2019.zip',
  'DafnyRef.pdf'
];

// Real v3.13.1 asset list.
const v3131Assets = [
  'dafny-3.13.1-arm64-macos-11.zip',
  'dafny-3.13.1-x64-macos-11.zip',
  'dafny-3.13.1-x64-ubuntu-20.04.zip',
  'dafny-3.13.1-x64-windows-2019.zip'
];

// Realistic-nightly slice: the nightly release actually contains ~900 assets
// from many dates across several months. The matcher must pin to the exact
// version string the caller asked for, not pick an arbitrary dated build.
const nightlyAssets = [
  'dafny-nightly-2025-08-15-ad4b829-x64-ubuntu-22.04.zip',
  'dafny-nightly-2025-08-15-ad4b829-x64-windows-2022.zip',
  'dafny-nightly-2025-08-15-ad4b829-x64-macos-13.zip',
  'dafny-nightly-2025-12-01-e97464d-arm64-macos-14.zip',
  'dafny-nightly-2025-12-01-e97464d-x64-macos-14.zip',
  'dafny-nightly-2025-12-01-e97464d-x64-ubuntu-22.04.zip',
  'dafny-nightly-2025-12-01-e97464d-x64-windows-2022.zip',
  'dafny-nightly-2026-04-28-99d0f0d-arm64-macos-14.zip',
  'dafny-nightly-2026-04-28-99d0f0d-x64-macos-14.zip',
  'dafny-nightly-2026-04-28-99d0f0d-x64-ubuntu-22.04.zip',
  'dafny-nightly-2026-04-28-99d0f0d-x64-windows-2022.zip'
];

// Synthetic very-old style where Windows used a bare `win` token and macOS
// used `osx-<ver>`. Confirms we still match those and prefer the numbered
// runner when one is available.
const legacyAssets = [
  'dafny-3.12.0-x64-osx-10.14.2.zip',
  'dafny-3.12.0-arm64-osx-11.0.zip',
  'dafny-3.12.0-x64-ubuntu-16.04.zip',
  'dafny-3.12.0-x64-win.zip'
];

suite('pickAssetForPlatform', () => {
  test('v4.11.0 macOS x64 picks macos-13 asset (regression for issue #6472)', () => {
    assert.strictEqual(
      pickAssetForPlatform(v411Assets, '4.11.0', 'x64', 'Darwin'),
      'dafny-4.11.0-x64-macos-13.zip'
    );
  });

  test('v4.11.0 macOS arm64 picks arm64 asset', () => {
    assert.strictEqual(
      pickAssetForPlatform(v411Assets, '4.11.0', 'arm64', 'Darwin'),
      'dafny-4.11.0-arm64-macos-13.zip'
    );
  });

  test('v4.11.0 Linux picks ubuntu asset', () => {
    assert.strictEqual(
      pickAssetForPlatform(v411Assets, '4.11.0', 'x64', 'Linux'),
      'dafny-4.11.0-x64-ubuntu-22.04.zip'
    );
  });

  test('v4.11.0 Windows picks windows asset', () => {
    assert.strictEqual(
      pickAssetForPlatform(v411Assets, '4.11.0', 'x64', 'Windows_NT'),
      'dafny-4.11.0-x64-windows-2022.zip'
    );
  });

  test('v4.10.0 macOS picks macos-11 asset', () => {
    assert.strictEqual(
      pickAssetForPlatform(v410Assets, '4.10.0', 'x64', 'Darwin'),
      'dafny-4.10.0-x64-macos-11.zip'
    );
  });

  test('v3.13.1 macOS arm64 picks macos-11 asset', () => {
    assert.strictEqual(
      pickAssetForPlatform(v3131Assets, '3.13.1', 'arm64', 'Darwin'),
      'dafny-3.13.1-arm64-macos-11.zip'
    );
  });

  test('nightly pins to the requested date on macOS arm64', () => {
    assert.strictEqual(
      pickAssetForPlatform(nightlyAssets, 'nightly-2026-04-28-99d0f0d', 'arm64', 'Darwin'),
      'dafny-nightly-2026-04-28-99d0f0d-arm64-macos-14.zip'
    );
  });

  test('nightly pins to the requested date on Linux x64', () => {
    assert.strictEqual(
      pickAssetForPlatform(nightlyAssets, 'nightly-2026-04-28-99d0f0d', 'x64', 'Linux'),
      'dafny-nightly-2026-04-28-99d0f0d-x64-ubuntu-22.04.zip'
    );
  });

  test('nightly pins to the requested date on Windows x64', () => {
    assert.strictEqual(
      pickAssetForPlatform(nightlyAssets, 'nightly-2026-04-28-99d0f0d', 'x64', 'Windows_NT'),
      'dafny-nightly-2026-04-28-99d0f0d-x64-windows-2022.zip'
    );
  });

  test('older nightly date is still reachable when requested explicitly', () => {
    assert.strictEqual(
      pickAssetForPlatform(nightlyAssets, 'nightly-2025-08-15-ad4b829', 'x64', 'Darwin'),
      'dafny-nightly-2025-08-15-ad4b829-x64-macos-13.zip'
    );
  });

  test('unknown nightly date returns undefined instead of a wrong-date asset', () => {
    assert.strictEqual(
      pickAssetForPlatform(nightlyAssets, 'nightly-2099-01-01-deadbee', 'x64', 'Darwin'),
      undefined
    );
  });

  test('legacy style: macOS arm64 picks osx-11.0', () => {
    assert.strictEqual(
      pickAssetForPlatform(legacyAssets, '3.12.0', 'arm64', 'Darwin'),
      'dafny-3.12.0-arm64-osx-11.0.zip'
    );
  });

  test('legacy style: macOS x64 picks osx-10.14.2', () => {
    assert.strictEqual(
      pickAssetForPlatform(legacyAssets, '3.12.0', 'x64', 'Darwin'),
      'dafny-3.12.0-x64-osx-10.14.2.zip'
    );
  });

  test('legacy style: Windows bare `win` token is matched', () => {
    assert.strictEqual(
      pickAssetForPlatform(legacyAssets, '3.12.0', 'x64', 'Windows_NT'),
      'dafny-3.12.0-x64-win.zip'
    );
  });

  test('arm64 requested but only x64 assets exist: returns undefined', () => {
    assert.strictEqual(
      pickAssetForPlatform(v410Assets, '4.10.0', 'arm64', 'Windows_NT'),
      undefined
    );
  });

  test('no assets match the OS family: returns undefined', () => {
    assert.strictEqual(
      pickAssetForPlatform([ 'dafny-4.11.0-x64-ubuntu-22.04.zip', 'DafnyRef.pdf' ], '4.11.0', 'x64', 'Darwin'),
      undefined
    );
  });

  test('empty asset list: returns undefined', () => {
    assert.strictEqual(pickAssetForPlatform([], '4.11.0', 'x64', 'Darwin'), undefined);
  });

  test('unrelated .zip attachments are ignored', () => {
    const assets = [
      'notes.zip',
      'random-x64-macos-14.zip',
      'dafny-4.11.0-x64-macos-13.zip'
    ];
    assert.strictEqual(
      pickAssetForPlatform(assets, '4.11.0', 'x64', 'Darwin'),
      'dafny-4.11.0-x64-macos-13.zip'
    );
  });

  test('unknown OS type returns undefined', () => {
    assert.strictEqual(
      pickAssetForPlatform(v411Assets, '4.11.0', 'x64', 'FreeBSD'),
      undefined
    );
  });

  test('version mismatch returns undefined (assets for a different version are not usable)', () => {
    // If the caller asked for 4.11.0 but only 4.10.0 assets are listed, we
    // must not silently fall back to a different version.
    assert.strictEqual(
      pickAssetForPlatform(v410Assets, '4.11.0', 'x64', 'Darwin'),
      undefined
    );
  });

  suite('tiebreak across multiple matching OS tokens', () => {
    // Simulates a runner-transition window where Dafny ships the same
    // single-date nightly against both the outgoing and incoming runner.
    const dualBuildAssets = [
      'dafny-nightly-2025-12-01-e97464d-arm64-macos-13.zip',
      'dafny-nightly-2025-12-01-e97464d-arm64-macos-14.zip',
      'dafny-nightly-2025-12-01-e97464d-x64-ubuntu-20.04.zip',
      'dafny-nightly-2025-12-01-e97464d-x64-ubuntu-22.04.zip',
      'dafny-nightly-2025-12-01-e97464d-x64-win.zip',
      'dafny-nightly-2025-12-01-e97464d-x64-windows-2019.zip',
      'dafny-nightly-2025-12-01-e97464d-x64-windows-2022.zip'
    ];

    test('macOS picks the higher-numbered macos token', () => {
      assert.strictEqual(
        pickAssetForPlatform(dualBuildAssets, 'nightly-2025-12-01-e97464d', 'arm64', 'Darwin'),
        'dafny-nightly-2025-12-01-e97464d-arm64-macos-14.zip'
      );
    });

    test('Linux picks the higher-numbered ubuntu token', () => {
      assert.strictEqual(
        pickAssetForPlatform(dualBuildAssets, 'nightly-2025-12-01-e97464d', 'x64', 'Linux'),
        'dafny-nightly-2025-12-01-e97464d-x64-ubuntu-22.04.zip'
      );
    });

    test('Windows picks windows-2022 over windows-2019 and bare `win`', () => {
      assert.strictEqual(
        pickAssetForPlatform(dualBuildAssets, 'nightly-2025-12-01-e97464d', 'x64', 'Windows_NT'),
        'dafny-nightly-2025-12-01-e97464d-x64-windows-2022.zip'
      );
    });

    test('multi-component version tokens compare lexicographically by component (osx-11.0 > osx-10.14.2)', () => {
      const multiCompAssets = [
        'dafny-3.12.0-arm64-osx-10.14.2.zip',
        'dafny-3.12.0-arm64-osx-11.0.zip'
      ];
      assert.strictEqual(
        pickAssetForPlatform(multiCompAssets, '3.12.0', 'arm64', 'Darwin'),
        'dafny-3.12.0-arm64-osx-11.0.zip'
      );
    });

    test('numeric-equal tokens fall back to lexicographic order for stability', () => {
      // Two tokens whose numeric tails parse identically; the tiebreak must
      // still be deterministic so callers never see flaky selections. `macos`
      // and `osx` both have numeric tail `14`, so localeCompare decides.
      const assets = [
        'dafny-0.0.0-x64-macos-14.zip',
        'dafny-0.0.0-x64-osx-14.zip'
      ];
      assert.strictEqual(
        pickAssetForPlatform(assets, '0.0.0', 'x64', 'Darwin'),
        'dafny-0.0.0-x64-osx-14.zip' // 'osx' > 'macos' lexicographically
      );
    });
  });
});
