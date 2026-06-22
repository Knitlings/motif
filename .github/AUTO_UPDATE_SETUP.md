# Automated Update Post Setup

This document explains how the automated update posts are set up and how to maintain them.

## Overview

When you create a GitHub release for motif, a GitHub Action automatically:
1. Extracts the changelog for that version from `CHANGELOG.md`
2. Clones the knitlings repository
3. Creates a new update post in `content/updates/`
4. Opens a pull request in the knitlings repo for you to review and merge

## Setup

This is already configured and live. The steps below document how it was set up,
for reference if the PAT expires or needs to be regenerated.

✅ In place:
- GitHub Action workflow (`.github/workflows/create-update-post.yml`)
- Changelog extraction script (`.github/scripts/extract-changelog.cjs`)
- `KNITLINGS_PAT` secret in the motif repository

### 1. Create GitHub Personal Access Token (PAT)

The workflow needs permission to push to the knitlings repository.

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Name it: `KNITLINGS_AUTO_UPDATE`
4. Set expiration: 1 year (or "No expiration" if you're comfortable with that)
5. Select scopes:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `workflow` (Update GitHub Action workflows)
6. Click "Generate token"
7. **Copy the token immediately** (you won't be able to see it again)

### 2. Add Secret to Motif Repository

1. Go to the motif repository on GitHub
2. Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `KNITLINGS_PAT`
5. Value: Paste the token from step 1
6. Click "Add secret"

### 3. Target Repository

The workflow pushes update posts to `Knitlings/knitlings.com`, set via the `repository:` field in `.github/workflows/create-update-post.yml`:

```yaml
repository: Knitlings/knitlings.com  # Change this if the repo is renamed
```

## Testing

To test the workflow:

1. Create a test release in the motif repository
2. Check the Actions tab to see the workflow run
3. If successful, you'll see a new PR in the knitlings repository
4. Review the generated post and merge if it looks good

## Workflow Details

### What Gets Generated

Example update post filename: `content/updates/2025-11-22-motif-v1.1.0.md`

Example front matter:
```toml
+++
title = 'Motif 1.1.0 Released'
date = '2025-11-22'
draft = false
tool = 'motif'
version = '1.1.0'
release_url = 'https://github.com/Knitlings/motif/releases/tag/v1.1.0'
lace = '3'  # Random lace pattern (1-8) for decorative banner
+++
```

The post content is extracted from the corresponding version section in `CHANGELOG.md`.

### How Version Detection Works

The workflow:
1. Extracts the version from the release tag (e.g., `v1.1.0` → `1.1.0`)
2. Searches `CHANGELOG.md` for a section starting with `## [1.1.0]`
3. Extracts everything from that header until the next `## [X.X.X]` header
4. Cleans up whitespace and link references

### Troubleshooting

**Error: "Version X.X.X not found in CHANGELOG.md"**
- Make sure you've updated `CHANGELOG.md` before creating the release
- Verify the version format matches: `## [1.1.0] - YYYY-MM-DD`

**Error: "Permission denied" or "403"**
- Check that the PAT is correctly added to repository secrets
- Verify the PAT has the correct scopes (`repo` and `workflow`)
- Check if the PAT has expired

**PR not created**
- Check the Actions tab in the motif repository for error logs
- Verify the knitlings repository exists and is accessible
- Ensure the repository name in the workflow matches the actual repo name

## Manual Testing

You can test the changelog extraction locally:

```bash
cd motif
node .github/scripts/extract-changelog.cjs 1.1.0
```

This will print the extracted changelog for version 1.1.0.

## Future Tools

To add automated update posts for future tools:
1. Create similar workflows in those tool repositories
2. Update the `tool` front matter field accordingly
3. Use the same PAT secret name (`KNITLINGS_PAT`)
