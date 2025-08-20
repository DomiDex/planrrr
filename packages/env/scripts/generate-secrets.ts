#!/usr/bin/env tsx

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { generateSecret, generateSecureToken, maskSecret } from '../utils';

interface SecretConfig {
  name: string;
  length: number;
  type: 'base64' | 'hex' | 'alphanumeric' | 'uuid';
  description: string;
}

const secrets: SecretConfig[] = [
  { name: 'BETTER_AUTH_SECRET', length: 32, type: 'base64', description: 'Authentication secret key' },
  { name: 'ENCRYPTION_SECRET', length: 32, type: 'base64', description: 'Data encryption key' },
  { name: 'FIELD_ENCRYPTION_KEY', length: 32, type: 'base64', description: 'Field-level encryption key' },
  { name: 'SESSION_SECRET', length: 32, type: 'base64', description: 'Session management secret' },
  { name: 'CSRF_SECRET', length: 16, type: 'alphanumeric', description: 'CSRF protection token' },
  { name: 'JWT_SECRET', length: 32, type: 'base64', description: 'JWT signing secret' },
  { name: 'JWT_REFRESH_SECRET', length: 32, type: 'base64', description: 'JWT refresh token secret' },
  { name: 'API_SECRET_KEY', length: 32, type: 'base64', description: 'API authentication key' },
  { name: 'INTERNAL_API_KEY', length: 32, type: 'hex', description: 'Internal service communication key' },
  { name: 'WEBHOOK_SECRET', length: 32, type: 'base64', description: 'Webhook validation secret' },
];

function generateSecretValue(config: SecretConfig): string {
  switch (config.type) {
    case 'base64':
      return crypto.randomBytes(config.length).toString('base64');
    case 'hex':
      return crypto.randomBytes(config.length).toString('hex');
    case 'alphanumeric':
      return generateSecret(config.length);
    case 'uuid':
      return crypto.randomUUID();
    default:
      return generateSecureToken(config.length);
  }
}

function main() {
  console.log(chalk.blue.bold('🔐 Secret Generation Tool\n'));
  
  const args = process.argv.slice(2);
  const outputFile = args.includes('--save') ? '.env.secrets' : null;
  const showValues = !args.includes('--mask');
  const format = args.includes('--docker') ? 'docker' : 'env';
  
  const generatedSecrets: Record<string, string> = {};
  
  console.log(chalk.yellow('Generating secure secrets...\n'));
  
  for (const config of secrets) {
    const value = generateSecretValue(config);
    generatedSecrets[config.name] = value;
    
    console.log(chalk.green(`✓ ${config.name}`));
    console.log(chalk.gray(`  ${config.description}`));
    console.log(chalk.cyan(`  Value: ${showValues ? value : maskSecret(value)}`));
    console.log();
  }
  
  if (outputFile) {
    const envContent = Object.entries(generatedSecrets)
      .map(([key, value]) => {
        const config = secrets.find(s => s.name === key);
        const comment = config ? `# ${config.description}` : '';
        return `${comment}\n${key}="${value}"`;
      })
      .join('\n\n');
    
    fs.writeFileSync(outputFile, envContent);
    console.log(chalk.green.bold(`\n✅ Secrets saved to ${outputFile}`));
    console.log(chalk.red.bold('⚠️  Remember to add this file to .gitignore!\n'));
  }
  
  if (format === 'docker') {
    console.log(chalk.blue.bold('\nDocker Compose format:\n'));
    console.log('```yaml');
    console.log('environment:');
    for (const [key, value] of Object.entries(generatedSecrets)) {
      console.log(`  ${key}: "${showValues ? value : '${' + key + '}'}"`);
    }
    console.log('```');
  }
  
  // Generate commands for manual secret setting
  console.log(chalk.blue.bold('\nManual commands:\n'));
  for (const [key, value] of Object.entries(generatedSecrets)) {
    console.log(`export ${key}="${showValues ? value : '<generated-value>'}"`);
  }
  
  // Security recommendations
  console.log(chalk.yellow.bold('\n🔒 Security Recommendations:\n'));
  console.log('1. Never commit secrets to version control');
  console.log('2. Use different secrets for each environment');
  console.log('3. Rotate secrets regularly (every 90 days)');
  console.log('4. Store production secrets in a secure vault');
  console.log('5. Use environment-specific .env files');
  console.log('6. Enable audit logging for secret access');
  
  // Verification command
  console.log(chalk.blue.bold('\n🔍 To verify your environment:\n'));
  console.log('pnpm --filter @repo/env check');
}

main();