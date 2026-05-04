import { config } from 'dotenv';
import https from 'https';
import { createClient } from '@supabase/supabase-js';

// Set NODE_ENV to development
process.env.NODE_ENV = 'development';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Load environment variables
config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Testing different fetch implementations...');

// Test 1: Native Node.js https module
async function testNativeHttps() {
  console.log('\n1. Testing native Node.js https module...');
  return new Promise((resolve, reject) => {
    const req = https.get(supabaseUrl, (res) => {
      console.log('✅ Native HTTPS successful:', res.statusCode);
      resolve(res.statusCode);
    });
    
    req.on('error', (err) => {
      console.log('❌ Native HTTPS failed:', err.message);
      reject(err);
    });
    
    req.setTimeout(5000, () => {
      console.log('❌ Native HTTPS timed out');
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// Test 2: Node.js built-in fetch
async function testBuiltinFetch() {
  console.log('\n2. Testing Node.js built-in fetch...');
  try {
    const response = await fetch(supabaseUrl);
    console.log('✅ Built-in fetch successful:', response.status);
    return response.status;
  } catch (err) {
    console.log('❌ Built-in fetch failed:', err.message);
    throw err;
  }
}

// Test 3: Custom fetch with agent
async function testCustomFetch() {
  console.log('\n3. Testing custom fetch with https agent...');
  
  const customFetch = (url, options = {}) => {
    const agent = new https.Agent({
      rejectUnauthorized: false,
      keepAlive: true,
    });
    
    return fetch(url, {
      ...options,
      agent,
      headers: {
        'User-Agent': 'QR-Scanner-Registry/1.0',
        ...options.headers,
      },
    });
  };
  
  try {
    const response = await customFetch(supabaseUrl);
    console.log('✅ Custom fetch successful:', response.status);
    return response.status;
  } catch (err) {
    console.log('❌ Custom fetch failed:', err.message);
    throw err;
  }
}

// Test 4: Supabase with custom fetch
async function testSupabaseWithCustomFetch() {
  console.log('\n4. Testing Supabase with custom fetch...');
  
  const customFetch = (url, options = {}) => {
    const agent = new https.Agent({
      rejectUnauthorized: false,
      keepAlive: true,
    });
    
    return fetch(url, {
      ...options,
      agent,
      headers: {
        'User-Agent': 'QR-Scanner-Registry/1.0',
        ...options.headers,
      },
    });
  };
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: customFetch,
    },
  });
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log('❌ Supabase with custom fetch failed:', error.message);
      throw new Error(error.message);
    } else {
      console.log('✅ Supabase with custom fetch successful!');
      console.log('Query result:', data);
      return data;
    }
  } catch (err) {
    console.log('❌ Supabase with custom fetch failed:', err.message);
    throw err;
  }
}

async function runAllTests() {
  const tests = [
    { name: 'Native HTTPS', fn: testNativeHttps },
    { name: 'Built-in Fetch', fn: testBuiltinFetch },
    { name: 'Custom Fetch', fn: testCustomFetch },
    { name: 'Supabase Custom Fetch', fn: testSupabaseWithCustomFetch },
  ];
  
  for (const test of tests) {
    try {
      await test.fn();
    } catch (err) {
      console.log(`Test "${test.name}" failed:`, err.message);
    }
  }
}

runAllTests();