#!/usr/bin/env node

/**
 * E2E Test Runner Script
 *
 * This script provides different ways to run E2E tests:
 * - Infrastructure tests (no dev server needed)
 * - Application tests (requires dev server)
 * - Cross-browser testing
 * - CI/CD mode
 */

import { spawn } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

const args = process.argv.slice(2);
const command = args[0] || "help";

// Configuration
const PLAYWRIGHT_CONFIG = "playwright.config.ts";
const DEV_SERVER_URL = "http://localhost:4321";
const DEV_SERVER_TIMEOUT = 120000;

// Test categories
const TEST_CATEGORIES = {
  infrastructure: ["e2e/basic-infrastructure.spec.ts"],
  auth: ["e2e/auth.spec.ts"],
  scanner: ["e2e/scanner.spec.ts"],
  history: ["e2e/scan-history.spec.ts"],
  workflow: ["e2e/user-workflow.spec.ts"],
  smoke: ["e2e/example.spec.ts"],
  all: [
    "e2e/infrastructure.spec.ts",
    "e2e/auth.spec.ts",
    "e2e/scanner.spec.ts",
    "e2e/scan-history.spec.ts",
    "e2e/user-workflow.spec.ts",
    "e2e/example.spec.ts",
  ],
};

// Browser projects
const BROWSERS = ["chromium", "firefox", "webkit"];
const MOBILE_BROWSERS = ["Mobile Chrome", "Mobile Safari"];

function runCommand(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${cmd} ${args.join(" ")}`);

    const child = spawn(cmd, args, {
      stdio: "inherit",
      shell: true,
      ...options,
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on("error", (error) => {
      reject(error);
    });
  });
}

async function checkDevServer() {
  try {
    const response = await fetch(DEV_SERVER_URL);
    return response.ok;
  } catch {
    return false;
  }
}

async function runTests(testFiles, options = {}) {
  const {
    project = "chromium",
    reporter = "list",
    headed = false,
    debug = false,
    ui = false,
    needsDevServer = false,
  } = options;

  // Check if dev server is needed and running
  if (needsDevServer) {
    const serverRunning = await checkDevServer();
    if (!serverRunning) {
      console.log("⚠️  Dev server not running. Starting dev server...");
      console.log('Please run "npm run dev" in another terminal and try again.');
      process.exit(1);
    }
  }

  const playwrightArgs = ["test", ...testFiles, `--project=${project}`, `--reporter=${reporter}`];

  if (headed) playwrightArgs.push("--headed");
  if (debug) playwrightArgs.push("--debug");
  if (ui) playwrightArgs.push("--ui");

  try {
    await runCommand("npx", ["playwright", ...playwrightArgs]);
    console.log("✅ Tests completed successfully!");
  } catch (error) {
    console.error("❌ Tests failed:", error.message);
    process.exit(1);
  }
}

async function runCrossBrowserTests(testFiles) {
  console.log("🌐 Running cross-browser tests...");

  for (const browser of BROWSERS) {
    console.log(`\n📱 Testing on ${browser}...`);
    try {
      await runTests(testFiles, {
        project: browser,
        reporter: "dot",
        needsDevServer: testFiles.some((f) => !f.includes("infrastructure")),
      });
    } catch (error) {
      console.error(`❌ ${browser} tests failed:`, error.message);
    }
  }
}

async function runMobileTests(testFiles) {
  console.log("📱 Running mobile tests...");

  for (const browser of MOBILE_BROWSERS) {
    console.log(`\n📱 Testing on ${browser}...`);
    try {
      await runTests(testFiles, {
        project: browser,
        reporter: "dot",
        needsDevServer: testFiles.some((f) => !f.includes("infrastructure")),
      });
    } catch (error) {
      console.error(`❌ ${browser} tests failed:`, error.message);
    }
  }
}

function printHelp() {
  console.log(`
🎭 E2E Test Runner

Usage: node scripts/test-e2e.js <command> [options]

Commands:
  help                    Show this help message
  infrastructure         Run infrastructure tests (no dev server needed)
  auth                   Run authentication tests
  scanner                Run scanner functionality tests
  history                Run scan history tests
  workflow               Run complete user workflow tests
  smoke                  Run basic smoke tests
  all                    Run all tests
  cross-browser          Run tests across all browsers
  mobile                 Run tests on mobile devices
  
Options:
  --headed               Run tests in headed mode (visible browser)
  --debug                Run tests in debug mode
  --ui                   Run tests with Playwright UI
  --reporter=<type>      Use specific reporter (list, html, json, junit)
  --project=<browser>    Run on specific browser (chromium, firefox, webkit)

Examples:
  node scripts/test-e2e.js infrastructure
  node scripts/test-e2e.js auth --headed
  node scripts/test-e2e.js all --reporter=html
  node scripts/test-e2e.js cross-browser
  node scripts/test-e2e.js workflow --debug

Environment Variables:
  TEST_SUPABASE_URL      Test database URL (optional, uses mocks)
  TEST_SUPABASE_ANON_KEY Test database anon key (optional)
  TEST_GOOGLE_CLIENT_ID  Test OAuth client ID (optional)
`);
}

async function main() {
  // Parse additional options
  const options = {
    headed: args.includes("--headed"),
    debug: args.includes("--debug"),
    ui: args.includes("--ui"),
    reporter: args.find((arg) => arg.startsWith("--reporter="))?.split("=")[1] || "list",
    project: args.find((arg) => arg.startsWith("--project="))?.split("=")[1] || "chromium",
  };

  switch (command) {
    case "help":
      printHelp();
      break;

    case "infrastructure":
      console.log("🔧 Running infrastructure tests...");
      await runTests(TEST_CATEGORIES.infrastructure, options);
      break;

    case "auth":
      console.log("🔐 Running authentication tests...");
      await runTests(TEST_CATEGORIES.auth, { ...options, needsDevServer: true });
      break;

    case "scanner":
      console.log("📷 Running scanner tests...");
      await runTests(TEST_CATEGORIES.scanner, { ...options, needsDevServer: true });
      break;

    case "history":
      console.log("📋 Running scan history tests...");
      await runTests(TEST_CATEGORIES.history, { ...options, needsDevServer: true });
      break;

    case "workflow":
      console.log("🔄 Running user workflow tests...");
      await runTests(TEST_CATEGORIES.workflow, { ...options, needsDevServer: true });
      break;

    case "smoke":
      console.log("💨 Running smoke tests...");
      await runTests(TEST_CATEGORIES.smoke, { ...options, needsDevServer: true });
      break;

    case "all":
      console.log("🎯 Running all tests...");
      await runTests(TEST_CATEGORIES.all, { ...options, needsDevServer: true });
      break;

    case "cross-browser":
      await runCrossBrowserTests(TEST_CATEGORIES.infrastructure);
      break;

    case "mobile":
      await runMobileTests(TEST_CATEGORIES.infrastructure);
      break;

    default:
      console.error(`❌ Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

// Handle uncaught errors
process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});

// Run the script
main().catch((error) => {
  console.error("❌ Script failed:", error);
  process.exit(1);
});
