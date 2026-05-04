# CI/CD Pipeline Guide

This document describes the comprehensive CI/CD pipeline implemented for the QR Scanner Registry project.

## Overview

The CI/CD pipeline is built using GitHub Actions and provides automated testing, building, and deployment workflows. It ensures code quality, prevents regressions, and maintains high standards across all contributions.

## Workflows

### 1. CI Workflow (`ci.yml`)

**Triggers:** Push to `main`/`develop` branches, Pull Requests

**Jobs:**
- **Lint**: Code style and formatting checks
- **Test**: Unit tests with coverage reporting (Node.js 22.18.0 and 22.x)
- **Build**: Application build verification
- **E2E**: End-to-end smoke tests for PRs
- **Security**: Dependency audit and vulnerability scanning

**Features:**
- Multi-version Node.js testing
- Coverage reporting to Codecov
- Build artifact storage
- Security vulnerability scanning

### 2. Pull Request Checks (`pr-checks.yml`)

**Triggers:** Pull Request events (opened, synchronize, reopened, ready_for_review)

**Features:**
- Merge conflict detection
- Code quality enforcement
- Coverage threshold validation (80% minimum)
- Automated PR comments with test results
- Merge blocking on test failures

**Jobs:**
- **PR Validation**: Comprehensive validation suite
- **PR Ready**: Success indicator for merge readiness
- **PR Blocked**: Failure indicator preventing merge

### 3. Main Branch Workflow (`main.yml`)

**Triggers:** Push to `main` branch

**Features:**
- Full test suite execution
- Comprehensive E2E testing across all test suites
- Extended artifact retention (30 days)
- Failure notifications

**Test Suites:**
- Infrastructure tests
- Authentication tests
- Scanner functionality tests
- Scan history tests
- User workflow tests
- Cross-browser tests

### 4. Nightly Build (`nightly.yml`)

**Triggers:** Scheduled (2 AM UTC daily), Manual dispatch

**Features:**
- Multi-version Node.js testing (20.x, 22.x, 22.18.0)
- Cross-browser E2E testing (Chromium, Firefox, WebKit)
- Performance testing with Lighthouse
- Security scanning with Snyk
- Comprehensive test matrix

## Branch Protection

The following branch protection rules should be configured for the `main` branch:

### Required Status Checks
- `lint` (from ci.yml)
- `test (22.18.0)` (from ci.yml)
- `test (22.x)` (from ci.yml)
- `build` (from ci.yml)
- `pr-validation` (from pr-checks.yml)
- `pr-ready` (from pr-checks.yml)

### Additional Settings
- ✅ Require branches to be up to date before merging
- ✅ Require pull request reviews before merging (1 reviewer)
- ✅ Dismiss stale reviews when new commits are pushed
- ✅ Require review from code owners
- ✅ Require signed commits (recommended)
- ✅ Require linear history (recommended)
- ✅ Include administrators

## Code Quality Standards

### Test Coverage
- Minimum 80% coverage required for all PRs
- Coverage reports generated for unit tests
- E2E tests cover critical user workflows

### Linting and Formatting
- ESLint for code quality
- Prettier for code formatting
- TypeScript strict mode enabled
- Accessibility checks included

### Security
- Automated dependency auditing
- Vulnerability scanning with configurable severity thresholds
- CSRF protection validation
- Input sanitization checks

## Environment Variables

The following environment variables are used in CI:

### Required for Full Functionality
- `CODECOV_TOKEN`: For coverage reporting
- `LHCI_GITHUB_APP_TOKEN`: For Lighthouse CI
- `SNYK_TOKEN`: For security scanning

### Test Environment
- `NODE_ENV=test`: Set automatically in test environments
- Test database configurations handled by test setup

## Artifacts and Reports

### Build Artifacts
- **Retention**: 7 days (CI), 30 days (main branch)
- **Contents**: Built application, test results, coverage reports

### Test Reports
- Unit test results with coverage
- E2E test results with screenshots/videos on failure
- Performance reports from Lighthouse
- Security scan results

## Performance Testing

### Lighthouse CI Configuration
- Performance score minimum: 80%
- Accessibility score minimum: 90%
- Best practices score minimum: 80%
- SEO score minimum: 80%

### Test URLs
- `http://localhost:4321` (preview server)

## Troubleshooting

### Common Issues

1. **Test Failures**
   - Check test logs in GitHub Actions
   - Run tests locally: `npm run test`
   - Check coverage: `npm run test:coverage`

2. **Build Failures**
   - Verify Node.js version matches `.nvmrc`
   - Check for TypeScript errors
   - Ensure all dependencies are installed

3. **E2E Test Failures**
   - Check browser compatibility
   - Verify test environment setup
   - Review Playwright configuration

4. **Coverage Below Threshold**
   - Add missing unit tests
   - Check coverage report for uncovered lines
   - Ensure test files are properly configured

### Local Development

To run the same checks locally:

```bash
# Install dependencies
npm ci

# Run linting
npm run lint

# Run unit tests with coverage
npm run test:coverage

# Run E2E tests
npm run e2e

# Build application
npm run build

# Run security audit
npm audit --audit-level=moderate
npx audit-ci --moderate
```

## Monitoring and Notifications

### Success Indicators
- ✅ All tests pass
- ✅ Coverage meets threshold
- ✅ Build completes successfully
- ✅ Security scans pass

### Failure Notifications
- GitHub PR comments with detailed results
- Failed status checks block merging
- Email notifications for main branch failures

## Continuous Improvement

### Metrics Tracked
- Test execution time
- Coverage trends
- Build success rates
- Security vulnerability counts

### Regular Reviews
- Monthly review of CI performance
- Quarterly security audit
- Annual workflow optimization

## Getting Help

For CI/CD related issues:
1. Check the GitHub Actions logs
2. Review this documentation
3. Check the project's issue tracker
4. Contact the development team

## Configuration Files

- `.github/workflows/ci.yml` - Main CI workflow
- `.github/workflows/pr-checks.yml` - PR validation
- `.github/workflows/main.yml` - Main branch workflow
- `.github/workflows/nightly.yml` - Nightly builds
- `.github/CODEOWNERS` - Code review assignments
- `lighthouserc.js` - Performance testing configuration
- `vitest.config.ts` - Unit test configuration
- `playwright.config.ts` - E2E test configuration