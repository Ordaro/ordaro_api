# Package Versioning Guide

This project uses [Semantic Versioning](https://semver.org/) (SemVer) and [standard-version](https://github.com/conventional-changelog/standard-version) for automated version management and changelog generation.

## Version Format

Versions follow the format: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes that are incompatible with previous versions
- **MINOR**: New features that are backward compatible
- **PATCH**: Bug fixes that are backward compatible

Examples:

- `1.0.0` → `1.0.1` (patch: bug fix)
- `1.0.0` → `1.1.0` (minor: new feature)
- `1.0.0` → `2.0.0` (major: breaking change)

## Commit Message Format

This project follows the [Conventional Commits](https://www.conventionalcommits.org/) specification. Your commit messages should follow this format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: A new feature
- `fix`: A bug fix
- `perf`: A performance improvement
- `refactor`: Code refactoring
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `chore`: Maintenance tasks
- `test`: Adding or updating tests
- `build`: Build system changes
- `ci`: CI/CD changes
- `revert`: Reverting a previous commit
- `security`: Security fixes

### Examples

```bash
# New feature
git commit -m "feat(email): add Auth0 email integration"

# Bug fix
git commit -m "fix(auth): resolve JWT token validation issue"

# Breaking change (use ! after type)
git commit -m "feat!(api): change authentication method"

# Multiple changes
git commit -m "feat(api): add user management

- Add user creation endpoint
- Add user update endpoint
- Add user deletion endpoint"
```

## Versioning Workflow

### 1. Development

During development, make commits with conventional commit messages:

```bash
git commit -m "feat(users): add user invitation endpoint"
git commit -m "fix(email): resolve template rendering issue"
```

### 2. Release Process

When ready to release:

#### Patch Release (Bug Fixes)

```bash
npm run release:patch
```

This will:

- Bump version from `1.0.0` → `1.0.1`
- Generate/update CHANGELOG.md
- Create a git tag
- Create a commit with the version bump

#### Minor Release (New Features)

```bash
npm run release:minor
```

This will:

- Bump version from `1.0.0` → `1.1.0`
- Generate/update CHANGELOG.md
- Create a git tag
- Create a commit with the version bump

#### Major Release (Breaking Changes)

```bash
npm run release:major
```

This will:

- Bump version from `1.0.0` → `2.0.0`
- Generate/update CHANGELOG.md
- Create a git tag
- Create a commit with the version bump

#### Automatic Release (Recommended)

```bash
npm run release
```

This will automatically determine the version bump based on your commit messages:

- `feat:` commits → minor bump
- `fix:` commits → patch bump
- `feat!:` or `BREAKING CHANGE:` → major bump

### 3. Pre-release Versions

For alpha, beta, or release candidate versions:

```bash
# Alpha release
npm run release:alpha

# Beta release
npm run release:beta

# Release candidate
npm run release:rc
```

### 4. Push to Repository

After running the release command:

```bash
# Push commits and tags
git push --follow-tags origin main
# or
git push --follow-tags origin development
```

## Changelog

The `CHANGELOG.md` file is automatically generated based on your commit messages. It includes:

- **Added**: New features (`feat:`)
- **Fixed**: Bug fixes (`fix:`)
- **Changed**: Changes to existing functionality (`refactor:`, `style:`, `chore:`)
- **Removed**: Removed features (`revert:`)
- **Security**: Security fixes (`security:`)
- **Performance Improvements**: Performance enhancements (`perf:`)

### Manual Changelog Updates

You can manually edit `CHANGELOG.md` to add:

- Migration guides
- Detailed feature descriptions
- Breaking change explanations
- Deprecation notices

The automated tool will preserve your manual edits in the "Unreleased" section.

## Best Practices

### 1. Commit Frequently

Make small, focused commits with clear messages:

```bash
# Good
git commit -m "feat(api): add pagination to users endpoint"

# Bad
git commit -m "update stuff"
```

### 2. Use Scopes

Scopes help organize changes:

```bash
feat(auth): add OAuth2 support
fix(email): resolve template issue
docs(api): update authentication guide
```

Common scopes:

- `auth`, `api`, `email`, `queue`, `db`, `config`, `docs`, `test`

### 3. Breaking Changes

Mark breaking changes clearly:

```bash
# Option 1: Use ! after type
git commit -m "feat!(api): change authentication flow"

# Option 2: Use BREAKING CHANGE in footer
git commit -m "feat(api): update user model

BREAKING CHANGE: User model now requires email field"
```

### 4. Release Regularly

Don't wait too long between releases:

- **Patch releases**: Weekly or as needed for bug fixes
- **Minor releases**: Monthly for new features
- **Major releases**: When breaking changes are necessary

### 5. Review Before Release

Before running `npm run release`:

1. Review all commits since last release
2. Ensure all tests pass: `npm run qa`
3. Update documentation if needed
4. Check that CHANGELOG.md looks correct

## Version Tags

Each release creates a git tag:

```bash
# List tags
git tag

# View specific tag
git show v1.0.0

# Checkout specific version
git checkout v1.0.0
```

## Troubleshooting

### Release Failed

If the release command fails:

1. Check for uncommitted changes:

   ```bash
   git status
   ```

2. Ensure you're on the correct branch:

   ```bash
   git branch
   ```

3. Check for existing tags:
   ```bash
   git tag -l
   ```

### Wrong Version Bump

If the automatic version bump is incorrect:

1. Use specific version commands:

   ```bash
   npm run release:patch  # Force patch
   npm run release:minor  # Force minor
   npm run release:major  # Force major
   ```

2. Or manually edit `package.json` and run:
   ```bash
   npm run release -- --release-as 1.2.3
   ```

### Changelog Not Updated

If CHANGELOG.md wasn't updated:

1. Check commit messages follow conventional format
2. Manually edit CHANGELOG.md if needed
3. Run release again (it will merge changes)

## CI/CD Integration

You can integrate versioning into your CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
name: Release
on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run release
      - uses: actions/checkout@v3
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
      - run: git push --follow-tags origin main
```

## Quick Reference

```bash
# Check current version
npm version

# View changelog
cat CHANGELOG.md

# Create patch release
npm run release:patch

# Create minor release
npm run release:minor

# Create major release
npm run release:major

# Automatic release (recommended)
npm run release

# Push with tags
git push --follow-tags origin <branch>
```

## Resources

- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [standard-version Documentation](https://github.com/conventional-changelog/standard-version)
- [Keep a Changelog](https://keepachangelog.com/)
