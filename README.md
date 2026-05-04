# QR Scanner Registry

[![CI](https://github.com/your-username/qr-scanner-registry/workflows/CI/badge.svg)](https://github.com/your-username/qr-scanner-registry/actions/workflows/ci.yml)
[![Main Branch](https://github.com/your-username/qr-scanner-registry/workflows/Main%20Branch%20CI%2FCD/badge.svg)](https://github.com/your-username/qr-scanner-registry/actions/workflows/main.yml)
[![codecov](https://codecov.io/gh/your-username/qr-scanner-registry/branch/main/graph/badge.svg)](https://codecov.io/gh/your-username/qr-scanner-registry)

A modern web application that allows users to authenticate with Google, scan QR codes and barcodes using their device camera, and store scan results in a database.

## Tech Stack

- [Astro](https://astro.build/) v5.5.5 - Modern web framework for building fast, content-focused websites
- [React](https://react.dev/) v19.0.0 - UI library for building interactive components
- [TypeScript](https://www.typescriptlang.org/) v5 - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) v4.0.17 - Utility-first CSS framework

## Prerequisites

- Node.js v22.14.0 (as specified in `.nvmrc`)
- npm (comes with Node.js)

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/przeprogramowani/10x-astro-starter.git
cd 10x-astro-starter
```

2. Install dependencies:

```bash
npm install
```

3. Run the development server:

```bash
npm run dev
```

4. Build for production:

```bash
npm run build
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run test` - Run unit tests
- `npm run test:watch` - Run unit tests in watch mode
- `npm run test:ui` - Run unit tests with UI
- `npm run test:coverage` - Run unit tests with coverage report
- `npm run e2e` - Run end-to-end tests
- `npm run e2e:ui` - Run end-to-end tests with UI
- `npm run e2e:debug` - Run end-to-end tests in debug mode
- `npm run e2e:infrastructure` - Run infrastructure E2E tests
- `npm run e2e:auth` - Run authentication E2E tests
- `npm run e2e:scanner` - Run scanner E2E tests
- `npm run e2e:history` - Run scan history E2E tests
- `npm run e2e:workflow` - Run user workflow E2E tests
- `npm run e2e:smoke` - Run smoke E2E tests
- `npm run e2e:cross-browser` - Run cross-browser E2E tests
- `npm run e2e:mobile` - Run mobile E2E tests

## CI/CD Pipeline

This project uses GitHub Actions for continuous integration and deployment:

### Workflows

- **CI (`ci.yml`)** - Runs on every push and pull request
  - Linting and code formatting checks
  - Unit tests with coverage reporting
  - Build verification
  - E2E smoke tests for PRs
  - Security audit

- **Pull Request Checks (`pr-checks.yml`)** - Validates PRs before merge
  - Comprehensive validation including merge conflict detection
  - Coverage threshold enforcement (80% minimum)
  - Automated PR comments with test results
  - Blocks merging on test failures

- **Main Branch (`main.yml`)** - Runs on main branch updates
  - Full test suite including comprehensive E2E tests
  - Cross-browser testing
  - Test result artifacts with 30-day retention
  - Failure notifications

- **Nightly (`nightly.yml`)** - Scheduled comprehensive testing
  - Multi-version Node.js testing (20.x, 22.x, 22.18.0)
  - Cross-browser E2E testing
  - Performance testing with Lighthouse
  - Security scanning

### Test Coverage

The project maintains a minimum of 80% test coverage across:
- Unit tests for all components and utilities
- Integration tests for API endpoints
- End-to-end tests for complete user workflows

## Project Structure

```md
.
├── src/
│   ├── layouts/    # Astro layouts
│   ├── pages/      # Astro pages
│   │   └── api/    # API endpoints
│   ├── components/ # UI components (Astro & React)
│   └── assets/     # Static assets
├── public/         # Public assets
```

## AI Development Support

This project is configured with AI development tools to enhance the development experience, providing guidelines for:

- Project structure
- Coding practices
- Frontend development
- Styling with Tailwind
- Accessibility best practices
- Astro and React guidelines

### Cursor IDE

The project includes AI rules in `.cursor/rules/` directory that help Cursor IDE understand the project structure and provide better code suggestions.

### GitHub Copilot

AI instructions for GitHub Copilot are available in `.github/copilot-instructions.md`

### Windsurf

The `.windsurfrules` file contains AI configuration for Windsurf.

## Contributing

Please follow the AI guidelines and coding practices defined in the AI configuration files when contributing to this project.

## License

MIT
