# NOVA Android Release and In-App Update Setup

This repository is a Capacitor-based Android app (`com.nova.app`) with an Android Gradle project under `android/`.

## Detected project facts

- App ID: `com.nova.app`
- Current Android version name: `1.0`
- Current Android version code: `1`
- Android SDK target: API 36 (`compileSdkVersion = 36`, `targetSdkVersion = 36`)
- Build system: Gradle + Capacitor Android wrapper
- Branch: `main`
- Distribution model: direct APK installation / future GitHub Releases-backed update manifest
- No existing GitHub Actions workflows were present in the repository before this change

## Release signing

The app uses a Gradle signing configuration with a local `android/keystore.properties` file. This file is deliberately not committed.

Required local file:

```properties
storeFile=release-keystore.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=nova-release
keyPassword=YOUR_KEY_PASSWORD
```

In GitHub Actions, the corresponding secrets should be:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

These values are required for production release builds. The workflow fails closed if any are missing.

## GitHub Actions workflows

Two workflows are included:

1. `.github/workflows/android-dev.yml`
   - Runs on pushes to `main`, PRs targeting `main`, and manual dispatch.
   - Builds the web app, runs the TypeScript lint check, installs Android SDK components, and assembles a debug APK.
   - Uploads the APK and Gradle reports as artifacts.

2. `.github/workflows/android-release.yml`
   - Runs on `v*.*.*` tags or manual dispatch.
   - Validates version metadata.
   - Enforces that `versionCode` increases for production releases.
   - Builds a signed release APK using the configured keystore.
   - Verifies the APK signature and generates a public update manifest.
   - Publishes the APK and manifest as GitHub Release assets.

## Versioning convention

- Human-readable version: semantic version `MAJOR.MINOR.PATCH`
- Android `versionCode`: integer, monotonic, strictly increasing for production releases
- Existing source of truth: Android Gradle default values plus workflow-supplied release metadata

## Public update manifest

The release workflow generates a file named `nova-update-manifest.json` with the schema:

```json
{
  "versionName": "1.0.1",
  "versionCode": 101,
  "minimumSupportedVersionCode": 100,
  "apkUrl": "https://github.com/owner/repo/releases/download/v1.0.1/NOVA-v1.0.1.apk",
  "releaseNotes": [
    "Performance improvements",
    "Bug fixes and stability updates",
    "Updated Android release metadata"
  ],
  "releaseDate": "2026-10-28T00:00:00Z",
  "mandatory": false
}
```

This is suitable for an in-app update check if the APK is distributed from GitHub Releases or another stable HTTPS host.

## Important notes

- Real keystore files and passwords are never committed.
- The release workflow intentionally fails if signing credentials cannot be provided.
- The update manifest uses GitHub Release asset URLs so the files remain stable across app versions.
- If the original signing identity is lost, Android updates for existing installed users will not be compatible unless the same keystore is reused.
