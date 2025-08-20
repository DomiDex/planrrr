#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { z } from 'zod';
import { checkEnvFile, getRequiredEnvVars, maskSecret } from '../utils';

const services = [
  { name: 'Web App', path: 'apps/web', schema: () => import('../web') },
  { name: 'API Service', path: 'apps/api', schema: () => import('../api') },
  { name: 'Worker Service', path: 'apps/worker', schema: () => import('../worker') },
];

async function validateService(service: typeof services[0]) {
  console.log(chalk.blue.bold(`\n📋 Validating ${service.name}...`));
  
  const envPath = path.join(process.cwd(), service.path, '.env');
  const examplePath = path.join(process.cwd(), service.path, '.env.example');
  
  // Check if .env.example exists
  if (!fs.existsSync(examplePath)) {
    console.log(chalk.red(`  ❌ Missing .env.example file`));
  } else {
    console.log(chalk.green(`  ✓ .env.example found`));
  }
  
  // Check if .env exists
  const envCheck = checkEnvFile(envPath);
  if (!envCheck.exists) {
    console.log(chalk.yellow(`  ⚠️  No .env file found (will use defaults)`));
  } else {
    console.log(chalk.green(`  ✓ .env file found`));
    
    if (envCheck.invalid.length > 0) {
      console.log(chalk.yellow(`  ⚠️  Empty values for: ${envCheck.invalid.join(', ')}`));
    }
  }
  
  // Load and validate schema
  try {
    const module = await service.schema();
    const schema = Object.values(module).find(v => v instanceof z.ZodObject) as z.ZodSchema;
    
    if (schema) {
      // Get required variables
      const shape = (schema as any)._def.shape();
      const required: string[] = [];
      const optional: string[] = [];
      
      for (const [key, value] of Object.entries(shape)) {
        if ((value as any).isOptional()) {
          optional.push(key);
        } else {
          required.push(key);
        }
      }
      
      console.log(chalk.gray(`  📊 Required: ${required.length}, Optional: ${optional.length}`));
      
      // Try to parse current environment
      const result = schema.safeParse(process.env);
      
      if (result.success) {
        console.log(chalk.green(`  ✅ Environment validation passed`));
      } else {
        console.log(chalk.red(`  ❌ Environment validation failed`));
        
        const errors = result.error.flatten();
        if (errors.formErrors.length > 0) {
          console.log(chalk.red(`     Form errors: ${errors.formErrors.join(', ')}`));
        }
        
        for (const [field, messages] of Object.entries(errors.fieldErrors)) {
          console.log(chalk.red(`     ${field}: ${messages?.join(', ')}`));
        }
      }
    }
  } catch (error) {
    console.log(chalk.red(`  ❌ Failed to load schema: ${error}`));
  }
}

async function checkSecrets() {
  console.log(chalk.blue.bold('\n🔐 Checking for exposed secrets...'));
  
  const sensitivePatterns = [
    { pattern: /[A-Za-z0-9+/]{32,}={0,2}/g, name: 'Base64 strings' },
    { pattern: /[a-f0-9]{32,}/g, name: 'Hex strings' },
    { pattern: /sk_[a-zA-Z0-9]{32,}/g, name: 'Stripe keys' },
    { pattern: /[A-Z0-9]{20}/g, name: 'AWS-like keys' },
  ];
  
  const filesToCheck = [
    'apps/web/.env.example',
    'apps/api/.env.example',
    'apps/worker/.env.example',
  ];
  
  let secretsFound = false;
  
  for (const file of filesToCheck) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf-8');
      
      for (const { pattern, name } of sensitivePatterns) {
        const matches = content.match(pattern);
        if (matches && matches.length > 0) {
          // Filter out false positives (like color codes, example values)
          const suspicious = matches.filter(m => 
            !m.includes('example') && 
            !m.includes('your-') &&
            !m.startsWith('000000') &&
            m.length > 20
          );
          
          if (suspicious.length > 0) {
            console.log(chalk.red(`  ⚠️  Potential ${name} in ${file}`));
            secretsFound = true;
          }
        }
      }
    }
  }
  
  if (!secretsFound) {
    console.log(chalk.green('  ✅ No exposed secrets detected in example files'));
  }
}

async function generateReport() {
  console.log(chalk.blue.bold('\n📊 Environment Configuration Report\n'));
  
  const report = {
    timestamp: new Date().toISOString(),
    services: [] as any[],
    recommendations: [] as string[],
  };
  
  for (const service of services) {
    const serviceReport = {
      name: service.name,
      path: service.path,
      hasEnvFile: fs.existsSync(path.join(service.path, '.env')),
      hasExampleFile: fs.existsSync(path.join(service.path, '.env.example')),
    };
    
    report.services.push(serviceReport);
  }
  
  // Recommendations
  if (report.services.some(s => !s.hasExampleFile)) {
    report.recommendations.push('Create .env.example files for all services');
  }
  
  if (report.services.every(s => !s.hasEnvFile)) {
    report.recommendations.push('Run "pnpm generate-secrets" to create initial secrets');
  }
  
  // Display report
  console.table(report.services);
  
  if (report.recommendations.length > 0) {
    console.log(chalk.yellow.bold('\n💡 Recommendations:'));
    report.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`);
    });
  }
  
  // Save report
  const reportPath = 'env-validation-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(chalk.gray(`\n📄 Full report saved to ${reportPath}`));
}

async function main() {
  console.log(chalk.cyan.bold('🔍 Environment Validation Tool'));
  console.log(chalk.gray('================================\n'));
  
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log('Usage: pnpm --filter @repo/env check [options]');
    console.log('\nOptions:');
    console.log('  --service <name>  Validate specific service only');
    console.log('  --secrets        Check for exposed secrets');
    console.log('  --report         Generate detailed report');
    console.log('  --fix            Auto-generate missing configs');
    return;
  }
  
  if (args.includes('--service')) {
    const serviceName = args[args.indexOf('--service') + 1];
    const service = services.find(s => s.name.toLowerCase().includes(serviceName.toLowerCase()));
    if (service) {
      await validateService(service);
    } else {
      console.log(chalk.red(`Service "${serviceName}" not found`));
    }
  } else {
    for (const service of services) {
      await validateService(service);
    }
  }
  
  if (args.includes('--secrets')) {
    await checkSecrets();
  }
  
  if (args.includes('--report')) {
    await generateReport();
  }
  
  console.log(chalk.cyan.bold('\n✨ Validation complete!\n'));
  
  // Quick tips
  console.log(chalk.gray('Quick commands:'));
  console.log(chalk.gray('  Generate secrets:  pnpm --filter @repo/env generate-secrets'));
  console.log(chalk.gray('  Check specific:    pnpm --filter @repo/env check --service web'));
  console.log(chalk.gray('  Full report:       pnpm --filter @repo/env check --report'));
}

main().catch(console.error);