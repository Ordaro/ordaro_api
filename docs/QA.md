# Quality Assurance Guide

This document outlines the QA processes and tools used in the Ordaro API project.

## Overview

Our QA system ensures code quality through:

- **TypeScript strict type checking**
- **ESLint with comprehensive rules**
- **Prettier code formatting**
- **Pre-commit hooks with Husky**
- **Automated testing**
- **CI/CD quality gates**

## Quick Commands

### Run All QA Checks

```bash
npm run qa          # Run all checks (type-check, lint, format-check, test)
npm run qa:fix      # Run all checks and fix issues automatically
```

### Individual Checks

```bash
npm run type-check    # TypeScript type checking
npm run lint         # ESLint checking
npm run lint:fix     # ESLint with auto-fix
npm run format       # Format code with Prettier
npm run format:check # Check if code is formatted
npm run test         # Run tests
npm run test:cov     # Run tests with coverage
```

## Type Checking

### Strict TypeScript Configuration

- **Strict mode enabled** - All strict checks active
- **No implicit any** - All types must be explicit
- **Unused variables detection** - Catches unused code
- **Null safety** - Prevents null/undefined errors

### Key Settings

```json
{
  "strict": true,
  "noImplicitAny": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noImplicitReturns": true,
  "noUncheckedIndexedAccess": true
}
```

## Linting Rules

### ESLint Configuration

- **TypeScript ESLint** - TypeScript-specific rules
- **Import organization** - Automatic import sorting
- **Unused imports removal** - Clean import statements
- **Code style enforcement** - Consistent coding patterns

### Key Rules

- ✅ **Consistent type imports** - Use `import type` for types
- ✅ **Prefer nullish coalescing** - Use `??` over `||`
- ✅ **Optional chaining** - Use `?.` for safe property access
- ✅ **No unused imports** - Automatically remove unused imports
- ✅ **Import ordering** - Alphabetical and grouped imports
- ⚠️ **No console.log** - Warnings for console statements
- ❌ **No debugger** - Error for debugger statements

## Code Formatting

### Prettier Configuration

- **Consistent formatting** - Automatic code formatting
- **Cross-platform compatibility** - Works on Windows/Mac/Linux
- **Integration with ESLint** - No conflicts between tools

### Settings

```json
{
  "endOfLine": "auto",
  "singleQuote": true,
  "trailingComma": "all",
  "tabWidth": 2,
  "semi": true
}
```

## Pre-commit Hooks

### Husky + lint-staged

Automatically runs on every commit:

1. **ESLint** - Fixes linting issues
2. **Prettier** - Formats code
3. **Type checking** - Validates TypeScript
4. **Tests** - Runs relevant tests

### Configuration

```json
{
  "lint-staged": {
    "*.{ts,js}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

## Testing

### Jest Configuration

- **Unit tests** - Test individual components
- **Integration tests** - Test component interactions
- **Coverage reporting** - Track test coverage
- **Watch mode** - Continuous testing during development

### Commands

```bash
npm run test         # Run all tests
npm run test:watch   # Watch mode for development
npm run test:cov     # Generate coverage report
npm run test:e2e     # End-to-end tests
```

## CI/CD Integration

### GitHub Actions

Automated QA checks on:

- **Push to main/develop**
- **Pull requests**
- **Multiple Node.js versions** (18.x, 20.x)

### Quality Gates

All checks must pass:

1. ✅ Type checking
2. ✅ Linting
3. ✅ Format checking
4. ✅ Tests with coverage
5. ✅ Build success

## IDE Integration

### VS Code Settings

Recommended extensions:

- **ESLint** - Real-time linting
- **Prettier** - Code formatting
- **TypeScript Hero** - Import organization
- **Error Lens** - Inline error display

### Settings.json

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

## Quality Metrics

### Code Coverage

- **Target**: 80%+ coverage
- **Reports**: Generated in `coverage/` directory
- **CI Integration**: Uploaded to Codecov

### Type Safety

- **Zero `any` types** in production code
- **Strict null checks** enabled
- **No implicit returns** allowed

### Code Style

- **Consistent formatting** via Prettier
- **Import organization** via ESLint
- **No unused code** via TypeScript + ESLint

## Troubleshooting

### Common Issues

#### Type Errors

```bash
# Check specific file
npx tsc --noEmit src/path/to/file.ts

# Check all files
npm run type-check
```

#### Linting Errors

```bash
# Fix automatically
npm run lint:fix

# Check specific file
npx eslint src/path/to/file.ts --fix
```

#### Format Issues

```bash
# Format all files
npm run format

# Check formatting
npm run format:check
```

#### Pre-commit Hook Issues

```bash
# Skip hooks (not recommended)
git commit --no-verify

# Fix issues first
npm run qa:fix
```

## Best Practices

### Development Workflow

1. **Write code** with proper types
2. **Run QA checks** frequently: `npm run qa`
3. **Fix issues** before committing
4. **Let pre-commit hooks** handle final cleanup
5. **Review CI results** after pushing

### Code Quality

- **Use explicit types** instead of `any`
- **Handle null/undefined** cases properly
- **Write tests** for new features
- **Keep functions small** and focused
- **Use meaningful names** for variables and functions

### Performance

- **Run type-check** in watch mode during development
- **Use lint:fix** to automatically resolve issues
- **Configure IDE** for real-time feedback
- **Run tests in watch mode** for TDD

## Configuration Files

### Key Files

- `tsconfig.json` - TypeScript configuration
- `eslint.config.mjs` - ESLint rules
- `.prettierrc` - Prettier settings
- `package.json` - Scripts and lint-staged config
- `.husky/pre-commit` - Pre-commit hook
- `.github/workflows/qa.yml` - CI/CD pipeline

### Customization

All QA tools can be customized by modifying their respective configuration files. Changes will be automatically picked up by the development workflow.

---

**Remember**: Quality is not an accident; it's the result of consistent practices and automated processes! 🚀
