#!/usr/bin/env tsx
// Package: @repo/api
// Path: apps/api/src/test/orpc-test.ts
// Test script to verify ORPC functionality

import { createApp } from '../app.js';
import { serve } from '@hono/node-server';

const PORT = 4001; // Use different port for testing

async function testORPC() {
  console.log('=== ORPC Functionality Test ===\n');
  
  // Start the server
  const app = createApp();
  const server = serve({
    fetch: app.fetch,
    port: PORT,
    hostname: 'localhost'
  });
  
  console.log(`✅ Test server started on http://localhost:${PORT}\n`);
  
  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  try {
    // Test 1: Health check endpoint
    console.log('1. Testing health check endpoint:');
    const healthResponse = await fetch(`http://localhost:${PORT}/api/orpc/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const healthData = await healthResponse.json();
    console.log('   Status:', healthResponse.status);
    console.log('   Response:', JSON.stringify(healthData, null, 2));
    
    // Test 2: Auth register endpoint (should fail with validation error)
    console.log('\n2. Testing auth.register (validation error expected):');
    const registerResponse = await fetch(`http://localhost:${PORT}/api/orpc/auth.register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid-email',
        password: '123',
        name: 'Test'
      })
    });
    const registerData = await registerResponse.json();
    console.log('   Status:', registerResponse.status);
    console.log('   Response:', JSON.stringify(registerData, null, 2));
    
    // Test 3: Auth login endpoint (should fail with user not found)
    console.log('\n3. Testing auth.login (user not found expected):');
    const loginResponse = await fetch(`http://localhost:${PORT}/api/orpc/auth.login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123'
      })
    });
    const loginData = await loginResponse.json();
    console.log('   Status:', loginResponse.status);
    console.log('   Response:', JSON.stringify(loginData, null, 2));
    
    // Test 4: Protected endpoint without auth (should fail)
    console.log('\n4. Testing protected endpoint without auth:');
    const postsResponse = await fetch(`http://localhost:${PORT}/api/orpc/posts.list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamId: '123',
        page: 1,
        limit: 10
      })
    });
    const postsData = await postsResponse.json();
    console.log('   Status:', postsResponse.status);
    console.log('   Response:', JSON.stringify(postsData, null, 2));
    
    // Test 5: Non-existent endpoint
    console.log('\n5. Testing non-existent endpoint:');
    const notFoundResponse = await fetch(`http://localhost:${PORT}/api/orpc/nonexistent.endpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const notFoundData = await notFoundResponse.json();
    console.log('   Status:', notFoundResponse.status);
    console.log('   Response:', JSON.stringify(notFoundData, null, 2));
    
    console.log('\n✅ All ORPC tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Close the server
    server.close();
    console.log('\n✅ Test server closed');
    process.exit(0);
  }
}

// Run the test
console.log('Starting ORPC test server...\n');
testORPC().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});