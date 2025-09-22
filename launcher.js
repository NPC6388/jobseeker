#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('\n🔍 JobSeeker - Automated Job Search Tool\n');

// Get the directory where the executable is located
const appDir = process.pkg ? path.dirname(process.execPath) : __dirname;

// Change to the app directory
process.chdir(appDir);

console.log(`📁 Working directory: ${appDir}`);

// Function to check if a command exists
function commandExists(command) {
    return new Promise((resolve) => {
        exec(`${command} --version`, (error) => {
            resolve(!error);
        });
    });
}

// Function to install dependencies
function installDependencies() {
    return new Promise((resolve, reject) => {
        console.log('📦 Installing dependencies...');
        const npmInstall = spawn('npm', ['install'], { stdio: 'inherit' });

        npmInstall.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error('Failed to install dependencies'));
            }
        });
    });
}

// Function to install Playwright browsers
function installPlaywright() {
    return new Promise((resolve, reject) => {
        console.log('🌐 Installing Playwright browsers...');
        const playwrightInstall = spawn('npx', ['playwright', 'install'], { stdio: 'inherit' });

        playwrightInstall.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error('Failed to install Playwright browsers'));
            }
        });
    });
}

// Function to start the web server
function startWebServer() {
    return new Promise((resolve, reject) => {
        console.log('🚀 Starting JobSeeker Web Interface...');
        console.log('📱 Web dashboard will be available at: http://localhost:3000');
        console.log('🎯 Opening in your default browser...\n');

        // Open browser after delay
        setTimeout(() => {
            const start = process.platform === 'darwin' ? 'open' :
                         process.platform === 'win32' ? 'start' : 'xdg-open';
            exec(`${start} http://localhost:3000`);
        }, 3000);

        const webServer = spawn('npm', ['run', 'web'], { stdio: 'inherit' });

        webServer.on('close', (code) => {
            console.log('\n🛑 JobSeeker has stopped');
            resolve(code);
        });

        webServer.on('error', (err) => {
            reject(err);
        });
    });
}

// Main execution
async function main() {
    try {
        // Check if Node.js is available
        const hasNode = await commandExists('node');
        if (!hasNode) {
            console.error('❌ Error: Node.js is not installed or not in PATH');
            console.log('Please install Node.js from https://nodejs.org/');
            process.exit(1);
        }

        console.log('✅ Node.js is available');

        // Check if dependencies are installed
        if (!fs.existsSync('node_modules')) {
            await installDependencies();
        }

        // Check if Playwright browsers are installed
        const playwrightPath = path.join(require('os').homedir(), 'AppData', 'Local', 'ms-playwright', 'chromium-1187');
        if (!fs.existsSync(playwrightPath)) {
            await installPlaywright();
        }

        console.log('✅ All dependencies verified\n');

        // Kill any existing process on port 3000
        exec('npx kill-port 3000', () => {
            // Start the web server
            startWebServer().catch((err) => {
                console.error('❌ Error starting web server:', err.message);
                process.exit(1);
            });
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down JobSeeker...');
    exec('npx kill-port 3000', () => {
        process.exit(0);
    });
});

main();