import { config } from 'dotenv';
import { execSync } from 'child_process';

// Load environment variables
config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Testing Supabase connection with curl...');
console.log('Supabase URL:', supabaseUrl);

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

try {
  // Test basic connectivity with curl
  const curlCommand = `curl -s -o /dev/null -w "%{http_code}" "${supabaseUrl}/rest/v1/users?select=count" -H "apikey: ${supabaseServiceKey}" -H "Authorization: Bearer ${supabaseServiceKey}"`;
  
  console.log('Testing with curl...');
  const result = execSync(curlCommand, { encoding: 'utf8', timeout: 10000 });
  
  console.log('HTTP Status Code:', result.trim());
  
  if (result.trim() === '200') {
    console.log('✅ Supabase is reachable via curl!');
    console.log('The issue is likely with Node.js fetch configuration.');
  } else {
    console.log('❌ Supabase returned status:', result.trim());
  }
  
} catch (error) {
  console.error('❌ Curl test failed:', error.message);
  console.log('This suggests a network connectivity issue.');
}