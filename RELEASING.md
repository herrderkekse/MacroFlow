# Release Process

This document describes how to create MacroFlow releases consistently — from an alpha test build all the way to a production store release.

---

## Version Naming

MacroFlow follows a simplified [Semantic Versioning](https://semver.org/) scheme:

```
MAJOR.MINOR.PATCH[-suffix]
```

| Segment | When to increment |
|---------|-------------------|
| `MAJOR` | Breaking change or major rewrite |
| `MINOR` | New feature or significant improvement |
| `PATCH` | Bug fixes and small improvements |

### Suffixes

| Suffix | Release type | Audience |
|--------|--------------|----------|
| `-alpha` | Early test build | Internal / close testers |
| `-beta`  | Feature-complete test build | Wider testers |
| *(none)* | Production release | All users |

---

## Conventions at a Glance

| Artefact | Format | Example |
|----------|--------|---------|
| Branch | `release/X.Y.Z` | `release/0.0.2` |
| Git tag | `vX.Y.Z[-suffix]` | `v0.0.2-alpha` |
| GitHub release title | `vX.Y.Z-suffix — Short description` | `v0.0.2-alpha — Localization & Templates` |
| EAS profile (alpha/beta) | `preview` | APK, internal distribution |
| EAS profile (production) | `production` | AAB, Play Store / App Store |
| APK filename | `macroflow-vX.Y.Z-suffix.apk` | `macroflow-v0.0.2-alpha.apk` |

---

## Step-by-Step Release Process

### 1. Open a GitHub Issue

Before starting, open a tracking issue:

```
Title:  release: vX.Y.Z-suffix
Body:   List notable changes included in this release.
```

Note the issue number — you'll reference it in the PR and close it in the GitHub release.

---

### 2. Pull Latest `main`

```bash
git checkout main
git pull
```

---

### 3. Create the Release Branch

```bash
git checkout -b release/X.Y.Z
```

---

### 4. Bump the Version

Edit **two files**:

- `app.json` → `"version": "X.Y.Z"`
- `package.json` → `"version": "X.Y.Z"`

Then commit:

```bash
git add app.json package.json
git commit -m "chore(release): bump version to X.Y.Z"
git push --set-upstream origin release/X.Y.Z
```

---

### 5. Open a Pull Request

```bash
gh pr create \
  --title "chore(release): vX.Y.Z" \
  --body "Bump version to X.Y.Z for the vX.Y.Z-suffix release.

Closes #<issue-number>" \
  --base main
```

Wait for review, then merge to `main`. Keep history linear — use a regular merge commit (not squash) so the version bump commit is identifiable.

---

### 6. Tag the Release on `main`

After the PR is merged:

```bash
git checkout main
git pull
git tag vX.Y.Z-alpha          # or -beta, or no suffix for production
git push origin vX.Y.Z-alpha
```

> **Alpha / Beta** → append `-alpha` / `-beta`  
> **Production** → no suffix (e.g. `v1.0.0`)

---

### 7. Trigger the EAS Build

| Release type | EAS profile | Output |
|---|---|---|
| Alpha | `preview` | APK (internal distribution) |
| Beta | `preview` | APK (internal distribution) |
| Production | `production` | AAB (Play Store / App Store) |

```bash
# Alpha / Beta
eas build --profile preview --platform android --non-interactive

# Production
eas build --profile production --platform android --non-interactive
```

The command prints a build URL. Keep it — you'll need it in the next step.

---

### 8. Download the APK (Alpha / Beta)

Once the build finishes, retrieve the download URL and download the APK:

```bash
# List the latest Android build and grab its URL
eas build:list --platform android --limit 1

# Download
curl -L "<apk-download-url>" -o macroflow-vX.Y.Z-alpha.apk
```

For production AAB releases the bundle is submitted directly to the store in step 9b — no manual download needed.

---

### 9a. Create the GitHub Release (Alpha / Beta)

```bash
gh release create vX.Y.Z-alpha \
  --prerelease \
  --title "vX.Y.Z-alpha — Short Description" \
  --notes "## What's Changed

### Features
- ...

### Fixes
- ...

**Full Changelog:** https://github.com/herrderkekse/MacroFlow/compare/vX.Y.Z-PREV-alpha...vX.Y.Z-alpha" \
  macroflow-vX.Y.Z-alpha.apk
```

The APK is attached as a release asset so testers can sideload it directly.

### 9b. Submit to Store (Production only)

```bash
eas submit --platform android --latest
```

Then create a GitHub release **without** `--prerelease`:

```bash
gh release create vX.Y.Z \
  --title "vX.Y.Z — Short Description" \
  --notes "..."
```

---

### 10. Clean Up

```bash
# Delete the release branch locally (remote was already deleted after PR merge)
git branch -d release/X.Y.Z
```

---

## Quick-Reference Checklists

### Alpha Release Checklist

- [ ] Issue opened in GitHub
- [ ] `release/X.Y.Z` branch created from `main`
- [ ] Version bumped in `app.json` and `package.json`
- [ ] `chore(release): bump version to X.Y.Z` commit pushed
- [ ] PR created and merged
- [ ] Tag `vX.Y.Z-alpha` created on `main` and pushed
- [ ] `eas build --profile preview --platform android` triggered
- [ ] APK downloaded (`macroflow-vX.Y.Z-alpha.apk`)
- [ ] GitHub pre-release created with APK attached
- [ ] Release branch deleted locally

### Production Release Checklist

- [ ] All the alpha/beta checklist items above (without `-alpha`/`-beta` suffixes)
- [ ] `eas submit --platform android --latest` run
- [ ] GitHub release created **without** `--prerelease`
- [ ] Store listing reviewed and published

---

## Notes

- Never reuse a tag. If a tag was created in error, delete it on remote (`git push origin :refs/tags/vX.Y.Z-alpha`) before recreating.
- The `eas.json` `appVersionSource: "local"` means EAS reads the version directly from `app.json` — always bump there first.
- For iOS builds add `--platform ios` (or `--platform all`) to the EAS commands once an Apple developer account is configured.
