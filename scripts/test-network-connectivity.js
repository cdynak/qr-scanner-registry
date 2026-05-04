import https from "https";

console.log("Testing network connectivity to various endpoints...");

const testEndpoints = [
  "https://www.google.com",
  "https://api.github.com",
  "https://httpbin.org/get",
  "https://gekcxzrhbicxyiaywdat.supabase.co",
];

async function testEndpoint(url) {
  console.log(`\nTesting: ${url}`);

  return new Promise((resolve) => {
    const req = https.get(url, (res) => {
      console.log(`✅ ${url} - Status: ${res.statusCode}`);
      resolve({ success: true, status: res.statusCode });
    });

    req.on("error", (err) => {
      console.log(`❌ ${url} - Error: ${err.message}`);
      resolve({ success: false, error: err.message });
    });

    req.setTimeout(10000, () => {
      console.log(`❌ ${url} - Timeout`);
      req.destroy();
      resolve({ success: false, error: "Timeout" });
    });
  });
}

async function testAllEndpoints() {
  console.log("Node.js version:", process.version);
  console.log("Platform:", process.platform);

  for (const endpoint of testEndpoints) {
    await testEndpoint(endpoint);
  }

  // Test with curl as well
  console.log("\n--- Testing with curl ---");

  const { spawn } = await import("child_process");

  return new Promise((resolve) => {
    const curl = spawn("curl", ["-I", "-s", "--max-time", "10", process.env.SUPABASE_URL]);

    let output = "";
    curl.stdout.on("data", (data) => {
      output += data.toString();
    });

    curl.stderr.on("data", (data) => {
      console.log("Curl stderr:", data.toString());
    });

    curl.on("close", (code) => {
      if (code === 0) {
        console.log("✅ Curl successful:");
        console.log(output);
      } else {
        console.log(`❌ Curl failed with code: ${code}`);
      }
      resolve();
    });
  });
}

testAllEndpoints();
