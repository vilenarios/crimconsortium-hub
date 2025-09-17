#!/usr/bin/env node

/**
 * Local Development Server for CrimConsortium
 * Serves static site with ArNS undername simulation for testing
 */

import fs from 'fs-extra';
import path from 'path';
import { createServer } from 'http';
import { URL } from 'url';
import { Logger } from '../src/lib/utils.js';

class CrimConsortiumDevServer {
  constructor(port = 3000) {
    this.port = port;
    this.logger = new Logger();
    
    // Simulate ArNS undernames locally
    this.undernamePaths = {
      'crimconsortium': './dist/main',
      'data_crimconsortium': './dist/data',
      'search_crimconsortium': './dist/search', 
      'members_crimconsortium': './dist/members',
      'stats_crimconsortium': './dist/stats'
    };
    
    // MIME types
    this.mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.pdf': 'application/pdf'
    };
  }

  async start() {
    this.logger.info('🚀 Starting CrimConsortium development server...');
    
    // Check if build exists
    if (!await fs.exists('./dist/main/index.html')) {
      this.logger.error('Build not found. Run "npm run build" first.');
      process.exit(1);
    }
    
    const server = createServer((req, res) => this.handleRequest(req, res));
    
    server.listen(this.port, () => {
      this.logger.success(`Development server running on http://localhost:${this.port}`);
      console.log('');
      console.log('🌐 Local ArNS Undername Simulation:');
      console.log(`   Main Site: http://localhost:${this.port}/`);
      console.log(`   Data API: http://localhost:${this.port}/data_crimconsortium/`);
      console.log(`   Search: http://localhost:${this.port}/search_crimconsortium/`);
      console.log(`   Members: http://localhost:${this.port}/members_crimconsortium/`);
      console.log(`   Stats: http://localhost:${this.port}/stats_crimconsortium/`);
      console.log('');
      console.log('📝 Test the site in your browser and verify:');
      console.log('   ✅ CrimRXiv consortium design matches');
      console.log('   ✅ Member grid loads properly');
      console.log('   ✅ Recent articles display');
      console.log('   ✅ Search functionality works');
      console.log('   ✅ Mobile responsive design');
      console.log('');
      console.log('Press Ctrl+C to stop the server');
    });
    
    // Graceful shutdown
    process.on('SIGINT', () => {
      this.logger.info('Shutting down development server...');
      server.close(() => {
        this.logger.success('Server stopped');
        process.exit(0);
      });
    });
  }

  async handleRequest(req, res) {
    try {
      const url = new URL(req.url, `http://localhost:${this.port}`);
      let filePath = null;
      
      // Route ArNS undername simulation
      if (url.pathname.startsWith('/data_crimconsortium')) {
        filePath = this.resolveUndernamePath('data_crimconsortium', url.pathname.replace('/data_crimconsortium', ''));
      } else if (url.pathname.startsWith('/search_crimconsortium')) {
        filePath = this.resolveUndernamePath('search_crimconsortium', url.pathname.replace('/search_crimconsortium', ''));
      } else if (url.pathname.startsWith('/members_crimconsortium')) {
        filePath = this.resolveUndernamePath('members_crimconsortium', url.pathname.replace('/members_crimconsortium', ''));
      } else if (url.pathname.startsWith('/stats_crimconsortium')) {
        filePath = this.resolveUndernamePath('stats_crimconsortium', url.pathname.replace('/stats_crimconsortium', ''));
      } else {
        // Main site
        filePath = this.resolveMainSitePath(url.pathname);
      }
      
      if (!filePath || !await fs.exists(filePath)) {
        this.send404(res);
        return;
      }
      
      await this.serveFile(filePath, res);
      
    } catch (error) {
      this.logger.error('Request handling failed', error.message);
      this.send500(res, error.message);
    }
  }

  resolveUndernamePath(undername, pathname) {
    const basePath = this.undernamePaths[undername];
    if (!basePath) return null;
    
    // Default to index.json for undername roots
    if (pathname === '/' || pathname === '') {
      return path.join(basePath, 'index.json');
    }
    
    return path.join(basePath, pathname.substring(1));
  }

  resolveMainSitePath(pathname) {
    const basePath = this.undernamePaths['crimconsortium'];
    
    // Default to index.html
    if (pathname === '/' || pathname === '') {
      return path.join(basePath, 'index.html');
    }
    
    // Try exact path first
    let filePath = path.join(basePath, pathname.substring(1));
    
    // If it's a directory, try index.html
    if (!path.extname(filePath)) {
      filePath = path.join(filePath, 'index.html');
    }
    
    return filePath;
  }

  async serveFile(filePath, res) {
    try {
      const ext = path.extname(filePath);
      const mimeType = this.mimeTypes[ext] || 'text/plain';
      
      // Set CORS headers for local development
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      const content = await fs.readFile(filePath);
      
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Content-Length': content.length
      });
      
      res.end(content);
      
      this.logger.info(`✅ Served: ${filePath}`);
      
    } catch (error) {
      this.logger.error(`Failed to serve file: ${filePath}`, error.message);
      this.send500(res, error.message);
    }
  }

  send404(res) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>404 - Not Found</title></head>
      <body style="font-family: system-ui; text-align: center; padding: 2rem;">
        <h1>404 - Not Found</h1>
        <p>The requested resource was not found.</p>
        <a href="/" style="color: #000;">← Back to Homepage</a>
      </body>
      </html>
    `;
    
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  send500(res, error) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>500 - Server Error</title></head>
      <body style="font-family: system-ui; text-align: center; padding: 2rem;">
        <h1>500 - Server Error</h1>
        <p>An error occurred: ${error}</p>
        <a href="/" style="color: #000;">← Back to Homepage</a>
      </body>
      </html>
    `;
    
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(html);
  }
}

// Start server if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new CrimConsortiumDevServer();
  server.start().catch(error => {
    console.error('Server failed to start:', error);
    process.exit(1);
  });
}

export default CrimConsortiumDevServer;