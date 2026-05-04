# End-to-End Testing with Playwright

This directory contains comprehensive end-to-end tests for the QR Scanner Registry application using Playwright.

## Test Structure

### Test Files

- **`infrastructure.spec.ts`** - Tests the E2E testing infrastructure itself
- **`auth.spec.ts`** - Tests Google OAuth authentication flows (with mocking)
- **`scanner.spec.ts`** - Tests QR/barcode scanning functionality (with camera mocking)
- **`scan-history.spec.ts`** - Tests scan history management and CRUD operations
- **`user-workflow.spec.ts`** - Tests complete user workflows end-to-end
- **`example.spec.ts`** - Basic smoke tests for the application

### Support Files

- **`test-config.ts`** - Configuration and helper functions for tests
- **`setup.ts`** - Custom test fixtures and utilities
- **`global-setup.ts`** - Global test setup (database, server warmup)
- **`global-teardown.ts`** - Global test cleanup

## Running Tests

### Prerequisites

1. Install dependencies:
   ```bash
   npm install
   ```

2. Install Playwright browsers:
   ```bash
   npx playwright install
   ```

### Test Commands

```bash
# Run all E2E tests
npm run e2e

# Run tests with UI mode
npm run e2e:ui

# Run tests in debug mode
npm run e2e:debug

# Run specific test file
npm run e2e -- e2e/infrastructure.spec.ts

# Run tests for specific browser
npm run e2e -- --project=chromium
npm run e2e -- --project=firefox
npm run e2e -- --project=webkit

# Run tests with specific reporter
npm run e2e -- --reporter=html
npm run e2e -- --reporter=json
```

## Test Configuration

### Browser Support

Tests run on multiple browsers and devices:
- **Desktop**: Chrome, Firefox, Safari
- **Mobile**: Chrome (Pixel 5), Safari (iPhone 12)
- **Tablet**: iPad Pro

### Mocking Strategy

#### Authentication Mocking
- Google OAuth endpoints are mocked to simulate successful/failed authentication
- Supabase authentication is mocked for consistent test data
- Session management is tested with mock cookies

#### Camera Mocking
- `navigator.mediaDevices.getUserMedia` is mocked to provide fake video streams
- Camera permissions are mocked to test permission flows
- QR/barcode detection is simulated with custom events

#### API Mocking
- All Supabase API calls are mocked with predictable responses
- Scan CRUD operations use in-memory mock data
- Network errors and edge cases are simulated

### Test Database

Tests use mocked data instead of a real database to ensure:
- Fast test execution
- Predictable test data
- No side effects between tests
- Easy CI/CD integration

## Test Coverage

### Authentication Tests (`auth.spec.ts`)
- ✅ Login button display when not authenticated
- ✅ Google OAuth login flow
- ✅ Session persistence across page reloads
- ✅ Logout functionality
- ✅ Protected route access control
- ✅ OAuth error handling

### Scanner Tests (`scanner.spec.ts`)
- ✅ Camera permission requests
- ✅ Camera feed display
- ✅ Permission denied handling
- ✅ QR code scanning simulation
- ✅ Barcode scanning simulation
- ✅ Scan result saving
- ✅ Scanning error handling
- ✅ Multiple scans in sequence
- ✅ Scan content validation

### Scan History Tests (`scan-history.spec.ts`)
- ✅ Scan history display
- ✅ Authentication requirement
- ✅ Scan details display
- ✅ Scan deletion with confirmation
- ✅ Deletion cancellation
- ✅ Pagination support
- ✅ Filtering by scan type
- ✅ Search functionality
- ✅ Empty state handling
- ✅ API error handling
- ✅ Data refresh
- ✅ Navigation to scanner
- ✅ Scan details modal

### User Workflow Tests (`user-workflow.spec.ts`)
- ✅ Complete user journey (login → scan → save → view → delete → logout)
- ✅ Multiple scans in one session
- ✅ Authentication persistence
- ✅ Network error handling
- ✅ Responsive design testing

### Infrastructure Tests (`infrastructure.spec.ts`)
- ✅ Basic Playwright functionality
- ✅ Multi-browser support
- ✅ Mobile viewport support
- ✅ Camera permissions mocking
- ✅ API mocking capabilities
- ✅ Screenshot and video recording
- ✅ Network interception
- ✅ Local/session storage support

## Cross-Browser Testing

Tests are configured to run on:

1. **Chromium** (Desktop Chrome)
2. **Firefox** (Desktop Firefox)
3. **WebKit** (Desktop Safari)
4. **Mobile Chrome** (Pixel 5)
5. **Mobile Safari** (iPhone 12)
6. **iPad** (iPad Pro)

Each browser project includes:
- Camera and microphone permissions
- Proper viewport configuration
- Mobile-specific testing scenarios

## CI/CD Integration

### GitHub Actions Support

The tests are configured for GitHub Actions with:
- Node.js version matrix testing
- Automatic browser installation
- Test result reporting (HTML, JSON, JUnit)
- Screenshot and video artifacts on failure
- Parallel test execution

### Environment Variables

Tests support environment-specific configuration:
```bash
# Test database (optional - uses mocks if not provided)
TEST_SUPABASE_URL=https://test.supabase.co
TEST_SUPABASE_ANON_KEY=test-anon-key
TEST_SUPABASE_SERVICE_KEY=test-service-key

# Test OAuth (optional - uses mocks if not provided)
TEST_GOOGLE_CLIENT_ID=test-client-id
TEST_GOOGLE_CLIENT_SECRET=test-client-secret
```

## Best Practices

### Test Organization
- Each test file focuses on a specific feature area
- Tests are grouped using `test.describe()` blocks
- Helper functions are extracted to support files
- Mock data is centralized in configuration files

### Mocking Strategy
- External services (Google OAuth, Supabase) are always mocked
- Camera and media APIs are mocked for consistent testing
- Network requests are intercepted and mocked
- Test data is predictable and isolated

### Error Handling
- Tests cover both happy path and error scenarios
- Network failures are simulated and tested
- Permission denied scenarios are covered
- Invalid input handling is verified

### Performance
- Tests use parallel execution where possible
- Mocking reduces external dependencies
- Test data is minimal and focused
- Cleanup is performed between tests

## Troubleshooting

### Common Issues

1. **Tests timeout**: Check if the dev server is running properly
2. **Camera tests fail**: Ensure camera mocking is set up correctly
3. **Authentication tests fail**: Verify OAuth mocking configuration
4. **Cross-browser failures**: Check browser-specific implementations

### Debug Mode

Use debug mode to step through tests:
```bash
npm run e2e:debug -- e2e/auth.spec.ts
```

### Test Reports

HTML reports are generated in `playwright-report/`:
```bash
npx playwright show-report
```

## Future Enhancements

- [ ] Visual regression testing with screenshots
- [ ] Performance testing with Lighthouse
- [ ] Accessibility testing integration
- [ ] Real device testing with BrowserStack
- [ ] Load testing for concurrent users