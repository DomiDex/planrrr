import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { generateSecureToken } from './utils';

export interface VaultConfig {
  encryptionKey?: string;
  vaultPath?: string;
  algorithm?: string;
}

export class SecretVault {
  private encryptionKey: Buffer;
  private vaultPath: string;
  private algorithm: string;

  constructor(config: VaultConfig = {}) {
    const key = config.encryptionKey || process.env.VAULT_ENCRYPTION_KEY;
    if (!key) {
      throw new Error('Vault encryption key is required');
    }

    this.encryptionKey = Buffer.from(key, 'base64');
    this.vaultPath = config.vaultPath || '.env.vault';
    this.algorithm = config.algorithm || 'aes-256-gcm';
  }

  encrypt(text: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = (cipher as any).getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
    };
  }

  decrypt(encrypted: string, iv: string, tag: string): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.encryptionKey,
      Buffer.from(iv, 'hex')
    );
    
    (decipher as any).setAuthTag(Buffer.from(tag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  saveSecrets(secrets: Record<string, string>): void {
    const data = JSON.stringify(secrets);
    const { encrypted, iv, tag } = this.encrypt(data);
    
    const vault = {
      version: '1.0.0',
      algorithm: this.algorithm,
      encrypted,
      iv,
      tag,
      timestamp: new Date().toISOString(),
    };
    
    fs.writeFileSync(this.vaultPath, JSON.stringify(vault, null, 2));
    console.log(`✅ Secrets saved to ${this.vaultPath}`);
  }

  loadSecrets(): Record<string, string> {
    if (!fs.existsSync(this.vaultPath)) {
      throw new Error(`Vault file not found: ${this.vaultPath}`);
    }
    
    const vaultData = JSON.parse(fs.readFileSync(this.vaultPath, 'utf8'));
    const decrypted = this.decrypt(vaultData.encrypted, vaultData.iv, vaultData.tag);
    
    return JSON.parse(decrypted);
  }

  addSecret(key: string, value: string): void {
    const secrets = this.loadSecrets();
    secrets[key] = value;
    this.saveSecrets(secrets);
  }

  getSecret(key: string): string | undefined {
    const secrets = this.loadSecrets();
    return secrets[key];
  }

  removeSecret(key: string): void {
    const secrets = this.loadSecrets();
    delete secrets[key];
    this.saveSecrets(secrets);
  }

  listSecrets(): string[] {
    const secrets = this.loadSecrets();
    return Object.keys(secrets);
  }

  exportToEnv(): void {
    const secrets = this.loadSecrets();
    for (const [key, value] of Object.entries(secrets)) {
      process.env[key] = value;
    }
  }

  static generateVaultKey(): string {
    return crypto.randomBytes(32).toString('base64');
  }

  static initializeVault(vaultPath: string = '.env.vault'): SecretVault {
    const keyPath = '.vault.key';
    
    let encryptionKey: string;
    if (fs.existsSync(keyPath)) {
      encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
    } else {
      encryptionKey = SecretVault.generateVaultKey();
      fs.writeFileSync(keyPath, encryptionKey);
      console.log(`🔑 Vault key generated and saved to ${keyPath}`);
      console.log('⚠️  Add .vault.key to .gitignore!');
    }
    
    return new SecretVault({ encryptionKey, vaultPath });
  }
}

// CLI interface for vault operations
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    const vault = SecretVault.initializeVault();
    
    switch (command) {
      case 'init':
        console.log('✅ Vault initialized');
        break;
        
      case 'add':
        const key = args[1];
        const value = args[2];
        if (!key || !value) {
          console.error('Usage: vault add <key> <value>');
          process.exit(1);
        }
        vault.addSecret(key, value);
        console.log(`✅ Added ${key} to vault`);
        break;
        
      case 'get':
        const getKey = args[1];
        if (!getKey) {
          console.error('Usage: vault get <key>');
          process.exit(1);
        }
        const secret = vault.getSecret(getKey);
        console.log(secret || 'Secret not found');
        break;
        
      case 'list':
        const keys = vault.listSecrets();
        console.log('Stored secrets:');
        keys.forEach(k => console.log(`  - ${k}`));
        break;
        
      case 'remove':
        const removeKey = args[1];
        if (!removeKey) {
          console.error('Usage: vault remove <key>');
          process.exit(1);
        }
        vault.removeSecret(removeKey);
        console.log(`✅ Removed ${removeKey} from vault`);
        break;
        
      case 'export':
        vault.exportToEnv();
        console.log('✅ Secrets exported to environment');
        break;
        
      default:
        console.log('Usage: vault <command> [args]');
        console.log('Commands:');
        console.log('  init              Initialize vault');
        console.log('  add <key> <val>   Add secret');
        console.log('  get <key>         Get secret');
        console.log('  list              List all keys');
        console.log('  remove <key>      Remove secret');
        console.log('  export            Export to environment');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}