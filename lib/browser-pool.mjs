import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import winston from 'winston';
import { createProxyLaunchOptions } from './proxy-utils.mjs';

// Configure logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Configure Puppeteer plugins
puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

class BrowserPool {
    constructor(maxBrowsers = 3) {
        this.browsers = [];
        this.maxBrowsers = maxBrowsers;
        this.currentIndex = 0;
    }

    async getBrowser(proxyConfig = null) {
        // For proxy requests, always create a new browser instance
        // to avoid proxy configuration conflicts
        if (proxyConfig) {
            return await this.createBrowser(proxyConfig);
        }

        if (this.browsers.length < this.maxBrowsers) {
            const browser = await this.createBrowser();
            this.browsers.push(browser);
            return browser;
        }

        // Round-robin selection
        const browser = this.browsers[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.browsers.length;
        
        // Check if browser is still connected
        if (!browser.isConnected()) {
            logger.warn('Browser disconnected, creating new one');
            await browser.close().catch(() => {});
            const newBrowser = await this.createBrowser();
            this.browsers[this.currentIndex] = newBrowser;
            return newBrowser;
        }

        return browser;
    }

    async createBrowser(proxyConfig = null) {
        const launchOptions = createProxyLaunchOptions(proxyConfig);
        const browser = await puppeteer.launch(launchOptions);
        
        const proxyMsg = proxyConfig ? ` with proxy ${proxyConfig.host}:${proxyConfig.port}` : '';
        logger.info(`New browser instance created${proxyMsg}`);
        
        return browser;
    }

    async closeAll() {
        logger.info('Closing all browser instances');
        await Promise.all(
            this.browsers.map(browser => 
                browser.close().catch(err => 
                    logger.error('Error closing browser:', err)
                )
            )
        );
        this.browsers = [];
    }
}

// Export singleton instance
export const browserPool = new BrowserPool();

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Received SIGINT, closing browsers...');
    await browserPool.closeAll();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, closing browsers...');
    await browserPool.closeAll();
    process.exit(0);
});
