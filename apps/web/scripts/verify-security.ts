#!/usr/bin/env node

/**
 * Security Verification Script
 * Verifies that CVE-2025-29927 and other security patches are properly applied
 */

import * as fs from 'fs';
import * as path from 'path';

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

interface SecurityCheck {
  name: string;
  description: string;
  test: () => boolean | Promise<boolean>;
  critical: boolean;
}

class SecurityVerification {
  private checks: SecurityCheck[] = [];
  private results: Map<string, boolean> = new Map();

  constructor() {
    this.initializeChecks();
  }

  private initializeChecks() {
    this.checks = [
      {
        name: 'Next.js Version',
        description: 'Verify Next.js is version 15.2.3 or higher (CVE-2025-29927 patch)',
        critical: true,
        test: () => {
          try {
            const packageJson = JSON.parse(
              fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')
            );
            const nextVersion = packageJson.dependencies?.next || '';
            
            // Extract version number
            const versionMatch = nextVersion.match(/(\d+)\.(\d+)\.(\d+)/);
            if (!versionMatch) return false;
            
            const [, major, minor, patch] = versionMatch.map(Number);
            
            // Check if version is 15.2.3 or higher
            if (major > 15) return true;
            if (major === 15 && minor > 2) return true;
            if (major === 15 && minor === 2 && patch >= 3) return true;
            
            return false;
          } catch (error) {
            console.error('Error checking Next.js version:', error);
            return false;
          }
        },
      },
      {
        name: 'Middleware Protection',
        description: 'Verify middleware.ts exists and contains security checks',
        critical: true,
        test: () => {
          try {
            const middlewarePath = path.join(process.cwd(), 'middleware.ts');
            if (!fs.existsSync(middlewarePath)) return false;
            
            const content = fs.readFileSync(middlewarePath, 'utf-8');
            
            // Check for CVE-2025-29927 protection
            const hasHeaderCheck = content.includes('x-middleware-subrequest');
            const hasSecurityHeaders = content.includes('X-Frame-Options');
            const hasAuthCheck = content.includes('isProtectedRoute');
            
            return hasHeaderCheck && hasSecurityHeaders && hasAuthCheck;
          } catch (error) {
            console.error('Error checking middleware:', error);
            return false;
          }
        },
      },
      {
        name: 'Environment Variables',
        description: 'Check if .env.example exists with security configurations',
        critical: false,
        test: () => {
          try {
            const envExamplePath = path.join(process.cwd(), '.env.example');
            return fs.existsSync(envExamplePath);
          } catch {
            return false;
          }
        },
      },
      {
        name: 'TypeScript Strict Mode',
        description: 'Verify TypeScript is configured with strict mode',
        critical: false,
        test: () => {
          try {
            const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
            const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
            return tsconfig.compilerOptions?.strict === true;
          } catch {
            return false;
          }
        },
      },
      {
        name: 'Security Headers in next.config.js',
        description: 'Check if next.config.js has security headers configured',
        critical: false,
        test: () => {
          try {
            const configPath = path.join(process.cwd(), 'next.config.js');
            if (!fs.existsSync(configPath)) return false;
            
            const content = fs.readFileSync(configPath, 'utf-8');
            return content.includes('headers') || content.includes('securityHeaders');
          } catch {
            return false;
          }
        },
      },
    ];
  }

  async runChecks(): Promise<void> {
    console.log(`\n${colors.blue}🔒 Running Security Verification${colors.reset}\n`);
    console.log('=' .repeat(60));

    let criticalFailures = 0;
    let warnings = 0;

    for (const check of this.checks) {
      process.stdout.write(`\n📋 ${check.name}... `);
      
      try {
        const result = await check.test();
        this.results.set(check.name, result);
        
        if (result) {
          console.log(`${colors.green}✓ PASSED${colors.reset}`);
          console.log(`   ${colors.green}${check.description}${colors.reset}`);
        } else {
          if (check.critical) {
            console.log(`${colors.red}✗ FAILED (CRITICAL)${colors.reset}`);
            console.log(`   ${colors.red}${check.description}${colors.reset}`);
            criticalFailures++;
          } else {
            console.log(`${colors.yellow}⚠ WARNING${colors.reset}`);
            console.log(`   ${colors.yellow}${check.description}${colors.reset}`);
            warnings++;
          }
        }
      } catch (error) {
        console.log(`${colors.red}✗ ERROR${colors.reset}`);
        console.log(`   ${colors.red}Error: ${error}${colors.reset}`);
        if (check.critical) criticalFailures++;
      }
    }

    console.log('\n' + '=' .repeat(60));
    console.log(`\n${colors.blue}📊 Security Verification Summary${colors.reset}\n`);

    const passedChecks = Array.from(this.results.values()).filter(r => r).length;
    const totalChecks = this.checks.length;

    console.log(`Total Checks: ${totalChecks}`);
    console.log(`${colors.green}Passed: ${passedChecks}${colors.reset}`);
    console.log(`${colors.red}Critical Failures: ${criticalFailures}${colors.reset}`);
    console.log(`${colors.yellow}Warnings: ${warnings}${colors.reset}`);

    if (criticalFailures > 0) {
      console.log(`\n${colors.red}❌ SECURITY VERIFICATION FAILED${colors.reset}`);
      console.log(`${colors.red}Critical security requirements not met!${colors.reset}`);
      process.exit(1);
    } else if (warnings > 0) {
      console.log(`\n${colors.yellow}⚠️  SECURITY VERIFICATION PASSED WITH WARNINGS${colors.reset}`);
      console.log(`${colors.yellow}Consider addressing the warnings for enhanced security.${colors.reset}`);
    } else {
      console.log(`\n${colors.green}✅ SECURITY VERIFICATION PASSED${colors.reset}`);
      console.log(`${colors.green}All security checks passed successfully!${colors.reset}`);
    }

    // Additional CVE-2025-29927 specific test
    console.log(`\n${colors.blue}🔍 CVE-2025-29927 Specific Test${colors.reset}\n`);
    this.testMiddlewareBypass();
  }

  private testMiddlewareBypass() {
    console.log('Testing middleware bypass vulnerability...');
    console.log('To manually test, run the development server and execute:');
    console.log(`\n${colors.yellow}curl -H "x-middleware-subrequest: middleware:middleware:middleware" \\`);
    console.log(`  http://localhost:3000/api/protected${colors.reset}\n`);
    console.log('Expected result: 403 Forbidden');
    console.log('If you get any other response, the vulnerability is NOT patched.\n');
  }
}

// Run verification
const verifier = new SecurityVerification();
verifier.runChecks().catch(console.error);