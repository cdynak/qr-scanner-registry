# End-to-End Tests

Playwright tests for the QR Scanner Registry app.

## Scope

The E2E suite intentionally covers the **unauthenticated** surface of the app —
the parts that render without a real OAuth session or camera:

- `smoke.spec.ts` — home page load, titles, the shared "Authentication
  Required" gate on protected pages, and the 404 / error pages.
- `basic-infrastructure.spec.ts` — self-contained checks of the Playwright
  harness itself (no app server required).

Authenticated flows (Google OAuth, scanning, saving, history) are covered by
the unit and integration tests under `src/test/`, because driving them end to
end requires a real OAuth handshake and camera hardware that are impractical to
automate reliably here.

## Running

The Playwright config starts the dev server automatically (in offline
`USE_MOCK_DB=true` mode) on `https://localhost:3000`, so no external services
are needed.

```bash
npm run e2e                # run the whole suite
npm run e2e:smoke          # smoke tests only
npm run e2e:infrastructure # harness checks only (no server)
npm run e2e:ui             # interactive UI mode
npm run e2e:debug          # step-through debugging
npm run e2e:report         # open the last HTML report
```

## Notes

- The dev server uses a self-signed certificate; `ignoreHTTPSErrors` is enabled
  in the config.
- Projects run on Desktop Chrome, Desktop Firefox, and Mobile Chrome.
