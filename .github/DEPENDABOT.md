# Dependabot Configuration

This repository uses Dependabot for automated dependency management.

## Configuration

Located at: `.github/dependabot.yml`

## How It Works

- **Schedule**: Runs every Monday at 09:00 UTC
- **Target Branch**: Creates PRs against `staging` (not `main`)
- **PR Limit**: Maximum 5 open PRs at once to avoid spam
- **Grouping**: All patch updates (e.g., `1.0.1` → `1.0.2`) are grouped into a single PR
- **Labels**: Automatically adds `dependencies` and `automated` labels to PRs

## Workflow

1. **Monday mornings**: Dependabot checks for outdated npm packages
2. **PR Creation**: Creates pull requests against `staging` branch
   - PR title: `deps: bump package-name from 1.0.0 to 1.1.0`
   - Includes changelog and release notes
3. **CI Testing**: GitHub Actions automatically run tests on the PR
4. **Your Review**:
   - Review the PR when convenient
   - Check that tests pass
   - Merge to `staging` if acceptable, or close if not needed
5. **Release**: Updates go to production with your next `staging` → `main` release

## Handling Dependabot PRs

### Merging a PR
Simply merge the PR to `staging` when you're ready. The update will be included in your next release.

### Ignoring Updates
If you don't want a specific update, you can:
- Close the PR (Dependabot won't recreate it for that version)
- Comment `@dependabot ignore this minor version` to skip all minor updates
- Comment `@dependabot ignore this major version` to skip major version updates

### Rebasing
If a Dependabot PR gets out of date, comment: `@dependabot rebase`

## Security Updates

Dependabot will also create PRs for security vulnerabilities. These should be prioritized:
1. Review the security advisory linked in the PR
2. Merge to `staging` quickly
3. Test in staging preview deployment
4. Fast-track release to `main` if critical

## Labels

All Dependabot PRs are tagged with:
- `dependencies` - Indicates it's a dependency update
- `automated` - Indicates it was created automatically

You can filter PRs by these labels in GitHub.

## Configuration Details

- **Package ecosystem**: npm
- **Directory**: `/` (root)
- **Commit message prefix**: `deps`
- **Update types grouped**: Patch updates are bundled together

## Disabling Dependabot

If you ever need to disable Dependabot, simply delete or rename `.github/dependabot.yml`.
