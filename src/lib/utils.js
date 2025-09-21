/**
 * Utility functions for CrimRXiv Static Hub
 * Team-friendly with clear error messages and logging
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

/**
 * Logger utility with team-friendly output
 */
export class Logger {
  constructor(teamFriendly = process.env.TEAM_FRIENDLY_OUTPUT === 'true') {
    this.teamFriendly = teamFriendly;
    this.logLevel = process.env.LOG_LEVEL || 'info';
  }

  info(message, details = null) {
    if (this.teamFriendly) {
      console.log(chalk.blue('ℹ️ '), message);
      if (details) console.log('  ', details);
    } else {
      console.log(`[INFO] ${message}`, details || '');
    }
  }

  success(message, details = null) {
    if (this.teamFriendly) {
      console.log(chalk.green('✅'), message);
      if (details) console.log('  ', details);
    } else {
      console.log(`[SUCCESS] ${message}`, details || '');
    }
  }

  warning(message, details = null) {
    if (this.teamFriendly) {
      console.log(chalk.yellow('⚠️ '), message);
      if (details) console.log('  ', details);
    } else {
      console.warn(`[WARNING] ${message}`, details || '');
    }
  }

  error(message, details = null) {
    if (this.teamFriendly) {
      console.log(chalk.red('❌'), message);
      if (details) console.log('  ', details);
    } else {
      console.error(`[ERROR] ${message}`, details || '');
    }
  }

  progress(current, total, message = '') {
    if (this.teamFriendly) {
      const percentage = Math.round((current / total) * 100);
      const progressBar = '█'.repeat(Math.floor(percentage / 5)) + 
                         '░'.repeat(20 - Math.floor(percentage / 5));
      console.log(`📈 [${progressBar}] ${percentage}% ${message}`);
    } else {
      console.log(`Progress: ${current}/${total} (${Math.round((current/total)*100)}%) ${message}`);
    }
  }
}

/**
 * File system utilities with error handling
 */
export class FileHelper {
  constructor() {
    this.logger = new Logger();
  }

  async ensureDir(dirPath) {
    try {
      await fs.ensureDir(dirPath);
      return true;
    } catch (error) {
      this.logger.error(`Failed to create directory: ${dirPath}`, error.message);
      return false;
    }
  }

  async writeJSON(filePath, data, pretty = true) {
    try {
      await this.ensureDir(path.dirname(filePath));
      await fs.writeJSON(filePath, data, { spaces: pretty ? 2 : 0 });
      return true;
    } catch (error) {
      this.logger.error(`Failed to write JSON file: ${filePath}`, error.message);
      return false;
    }
  }

  async readJSON(filePath) {
    try {
      return await fs.readJSON(filePath);
    } catch (error) {
      this.logger.error(`Failed to read JSON file: ${filePath}`, error.message);
      return null;
    }
  }

  async exists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async readdir(dirPath) {
    try {
      return await fs.readdir(dirPath);
    } catch (error) {
      this.logger.error(`Failed to read directory: ${dirPath}`, error.message);
      return [];
    }
  }

  async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      this.logger.error(`Failed to get file size: ${filePath}`, error.message);
      return 0;
    }
  }

  formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}

/**
 * Validation utilities for team safety
 */
export class Validator {
  constructor() {
    this.logger = new Logger();
  }

  validateWalletPath(walletPath) {
    if (!walletPath) {
      this.logger.error('Wallet path not configured', 
        'Please set ARWEAVE_WALLET_PATH in your .env file');
      return false;
    }

    if (!fs.existsSync(walletPath)) {
      this.logger.error('Wallet file not found', 
        `No wallet file at: ${walletPath}`);
      return false;
    }

    try {
      const wallet = fs.readJSONSync(walletPath);
      if (!wallet.kty || !wallet.n) {
        this.logger.error('Invalid wallet format', 
          'Wallet file does not appear to be a valid Arweave wallet');
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error('Cannot read wallet file', error.message);
      return false;
    }
  }

  validateEnvironment() {
    const required = ['ARWEAVE_WALLET_PATH'];
    const missing = [];

    for (const envVar of required) {
      if (!process.env[envVar]) {
        missing.push(envVar);
      }
    }

    if (missing.length > 0) {
      this.logger.error('Missing required environment variables', 
        `Please configure: ${missing.join(', ')}`);
      return false;
    }

    return this.validateWalletPath(process.env.ARWEAVE_WALLET_PATH);
  }

  validateArticleData(article) {
    const required = ['id', 'title', 'slug'];
    const missing = [];

    for (const field of required) {
      if (!article[field]) {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      this.logger.warning(`Article missing required fields: ${article.id || 'unknown'}`, 
        `Missing: ${missing.join(', ')}`);
      return false;
    }

    return true;
  }
}

/**
 * Progress tracking utilities
 */
export class ProgressTracker {
  constructor(total, operation = 'Processing') {
    this.total = total;
    this.current = 0;
    this.operation = operation;
    this.startTime = Date.now();
    this.logger = new Logger();
    this.errors = [];
    this.successful = 0;
    this.failed = 0;
  }

  increment(message = '') {
    this.current++;
    
    if (this.current % 10 === 0 || this.current === this.total) {
      const elapsed = Date.now() - this.startTime;
      const rate = this.current / (elapsed / 1000);
      const eta = Math.round((this.total - this.current) / rate);
      
      this.logger.progress(
        this.current, 
        this.total, 
        `${this.operation} | ${rate.toFixed(1)}/sec | ETA: ${eta}s ${message}`
      );
    }
  }

  success(message = '') {
    this.successful++;
    this.increment(message);
  }

  fail(error, context = '') {
    this.failed++;
    this.errors.push({ error: error.message, context, timestamp: new Date() });
    this.increment(`❌ ${error.message}`);
  }

  complete() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    this.logger.success(
      `${this.operation} complete`,
      `${this.successful} successful, ${this.failed} failed in ${elapsed.toFixed(1)}s`
    );

    if (this.errors.length > 0) {
      this.logger.warning(`${this.errors.length} errors occurred`, 
        'Check logs for details');
    }

    return {
      total: this.total,
      successful: this.successful,
      failed: this.failed,
      errors: this.errors,
      duration: elapsed
    };
  }
}

/**
 * State management for team operations
 */
export class StateManager {
  constructor(stateDir = './data/state') {
    this.stateDir = stateDir;
    this.fileHelper = new FileHelper();
    this.logger = new Logger();
  }

  async init() {
    await this.fileHelper.ensureDir(this.stateDir);
  }

  async saveState(name, data) {
    const filePath = path.join(this.stateDir, `${name}.json`);
    const success = await this.fileHelper.writeJSON(filePath, {
      ...data,
      lastUpdated: new Date().toISOString(),
      version: '1.0'
    });

    if (success) {
      this.logger.success(`State saved: ${name}`);
    }
    return success;
  }

  async loadState(name) {
    const filePath = path.join(this.stateDir, `${name}.json`);
    const data = await this.fileHelper.readJSON(filePath);
    
    if (data) {
      this.logger.info(`State loaded: ${name}`, 
        `Last updated: ${data.lastUpdated || 'unknown'}`);
    }
    return data;
  }

  async hasState(name) {
    const filePath = path.join(this.stateDir, `${name}.json`);
    return await this.fileHelper.exists(filePath);
  }
}

/**
 * Cost tracking utilities
 */
export class CostTracker {
  constructor() {
    this.logger = new Logger();
    this.costs = {
      uploads: 0,
      deployments: 0,
      domains: 0,
      total: 0
    };
  }

  addUploadCost(arAmount, description = '') {
    this.costs.uploads += arAmount;
    this.costs.total += arAmount;
    this.logger.info(`Upload cost: ${arAmount} AR`, description);
  }

  addDeploymentCost(arAmount, description = '') {
    this.costs.deployments += arAmount;
    this.costs.total += arAmount;
    this.logger.info(`Deployment cost: ${arAmount} AR`, description);
  }

  addDomainCost(arAmount, description = '') {
    this.costs.domains += arAmount;
    this.costs.total += arAmount;
    this.logger.info(`Domain cost: ${arAmount} AR`, description);
  }

  getSummary() {
    const arToUsd = 10; // Approximate conversion rate
    
    return {
      uploads: {
        ar: this.costs.uploads,
        usd: this.costs.uploads * arToUsd
      },
      deployments: {
        ar: this.costs.deployments,
        usd: this.costs.deployments * arToUsd
      },
      domains: {
        ar: this.costs.domains,
        usd: this.costs.domains * arToUsd
      },
      total: {
        ar: this.costs.total,
        usd: this.costs.total * arToUsd
      }
    };
  }

  printSummary() {
    const summary = this.getSummary();
    
    this.logger.info('💰 Cost Summary');
    console.log(`  Uploads:     ${summary.uploads.ar.toFixed(4)} AR (~$${summary.uploads.usd.toFixed(2)})`);
    console.log(`  Deployments: ${summary.deployments.ar.toFixed(4)} AR (~$${summary.deployments.usd.toFixed(2)})`);
    console.log(`  Domains:     ${summary.domains.ar.toFixed(4)} AR (~$${summary.domains.usd.toFixed(2)})`);
    console.log(`  Total:       ${summary.total.ar.toFixed(4)} AR (~$${summary.total.usd.toFixed(2)})`);
  }
}

/**
 * Helper function to safely handle async operations with retries
 */
export async function withRetry(operation, maxRetries = 3, delay = 1000) {
  const logger = new Logger();
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) {
        logger.error(`Operation failed after ${maxRetries} attempts`, error.message);
        throw error;
      }
      
      logger.warning(`Attempt ${attempt} failed, retrying in ${delay}ms`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
}

/**
 * Format date for display
 */
export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Create URL-safe slug from title
 */
export function createSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Get publication year and month from date
 */
export function getPublicationPath(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const monthName = d.toLocaleDateString('en-US', { month: 'long' }).toLowerCase();
  
  return {
    year: year.toString(),
    month,
    monthName,
    path: `${year}/${month}-${monthName}`
  };
}

// Export default logger instance for convenience
export const logger = new Logger();
export const fileHelper = new FileHelper();
export const validator = new Validator();