#!/usr/bin/env node
/* eslint-env node */

/**
 * Script to generate secure secrets for environment variables
 * Usage: node scripts/generate-secrets.js
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Generate a secure random secret
function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('base64');
}

// Generate all required secrets
function generateSecrets() {
  const secrets = {
    JWT_SECRET: generateSecret(32),
    JWT_REFRESH_SECRET: generateSecret(32),
    ENCRYPTION_SECRET: generateSecret(32),
    INTERNAL_API_KEY: generateSecret(32)
  };

  console.log('🔐 Generated Secure Secrets:\n');
  console.log('Add these to your .env file:\n');
  console.log('# ===== SECURE GENERATED SECRETS =====');
  
  Object.entries(secrets).forEach(([key, value]) => {
    console.log(`${key}="${value}"`);
  });
  
  console.log('# ===================================\n');
  
  // Optionally update .env file
  const envPath = path.join(__dirname, '..', '.env');
  
  if (fs.existsSync(envPath)) {
    console.log('📝 .env file found at:', envPath);
    console.log('⚠️  WARNING: Please manually update your .env file with the secrets above.');
    console.log('    We do not automatically update to prevent overwriting existing values.\n');
  } else {
    console.log('📝 No .env file found. Creating from .env.example...');
    
    const examplePath = path.join(__dirname, '..', '.env.example');
    if (fs.existsSync(examplePath)) {
      let envContent = fs.readFileSync(examplePath, 'utf8');
      
      // Replace empty secret values with generated ones
      Object.entries(secrets).forEach(([key, value]) => {
        const regex = new RegExp(`^${key}=""$`, 'm');
        envContent = envContent.replace(regex, `${key}="${value}"`);
      });
      
      fs.writeFileSync(envPath, envContent);
      console.log('✅ Created .env file with generated secrets!');
    } else {
      console.log('❌ .env.example not found. Please create it first.');
    }
  }
  
  console.log('\n🔒 Security Tips:');
  console.log('   - Never commit .env files to version control');
  console.log('   - Rotate secrets regularly (every 90 days)');
  console.log('   - Use different secrets for each environment');
  console.log('   - Store production secrets in a secure vault\n');
}

// Run the script
generateSecrets();