# Releasing

This document describes the branch strategy and release workflow for Motif.

## Branch Strategy

**Two main branches:**

- **`main`**: Production branch
  - Connected to Cloudflare Pages production deployment
  - Always stable and deployable
  - Protected - changes only via PR from `staging`

- **`staging`**: Development/integration branch
  - Where features are combined and tested together
  - Gets Cloudflare preview deployments (via PR)
  - Base branch for all feature development

**Feature branches**: Created from `staging` for individual features or fixes

## Development Workflows

### Normal Development (New Features)

**When to use**: Adding new features, improvements, or non-urgent fixes

1. Create feature branch from `staging`
2. Develop and test locally
3. Merge feature branch to `staging` (direct merge, no PR required)
4. Push to `staging` → triggers preview deployment
5. Test preview deployment at `staging.motif-32s.pages.dev`
6. When ready to release: Create PR from `staging` → `main`
7. Review PR (tests run automatically via GitHub Actions)
8. Merge to `main` → production deployment
9. Tag the release with semantic version

**Multiple features**: Develop multiple feature branches in parallel, merge each to `staging`, test them together before releasing.

### Hotfix Workflow (Urgent Production Fixes)

**When to use**: Critical bugs in production that can't wait for next release

1. Create hotfix branch from `main` (not staging)
2. Push hotfix branch
3. Create PR from hotfix branch → `main` to get preview deployment
4. Test preview deployment thoroughly
5. Merge PR → immediate production fix
6. Tag as patch version
7. **Important**: Merge `main` back to `staging` to keep branches in sync
8. Clean up hotfix branch

## Semantic Versioning

Use semantic versioning: `MAJOR.MINOR.PATCH`

- **PATCH** (v1.0.1): Bug fixes, small tweaks
- **MAJOR** (v2.0.0): Breaking changes
- **MINOR** (v1.1.0): New features (backwards compatible)

## Release Checklist

Before merging `staging` → `main`:

- [ ] GitHub Actions CI passing (unit tests, E2E tests, build validation)
- [ ] Preview deployment tested and working correctly
- [ ] Visual changes reviewed on preview deployment
- [ ] Cross-browser testing completed (if significant UI changes)
- [ ] Mobile experience verified (if applicable)
- [ ] Version number decided (follow semver)
- [ ] **Update CHANGELOG.md**: Review commits since last release and add concise summary under new version heading

After merging to `main`:

- [ ] Tag the release (`git tag -a v1.x.x -m "Release notes"`)
- [ ] Push tag (`git push origin v1.x.x`)
- [ ] Create GitHub release with notes (can copy from CHANGELOG)
- [ ] Update `package.json` version if needed

## Preview Deployments

Cloudflare Pages automatically creates preview deployments for **pull requests**:

- Open any PR (feature → staging, staging → main, hotfix → main)
- Cloudflare creates a preview URL
- Use this URL to test changes before merging

**Note**: Preview deployments are created on PRs, not on branch pushes alone.

## Branch Protection

**Recommended GitHub settings** (when repository is public):

- Protect `main` branch:
  - Require pull request reviews
  - Require status checks (CI tests) to pass
  - No force pushes
  - No deletions

- `staging` branch:
  - Allow direct pushes (for merging features)
  - No force pushes (to preserve history)
