import winston from 'winston';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({ format: winston.format.simple() })
    ]
});

/**
 * Get proxy configuration from request params or environment variables
 * @param {Object} requestProxy - Proxy configuration from request body
 * @returns {Object|null} Proxy configuration or null if not available
 */
export const getProxyConfig = (requestProxy = {}) => {
    // If proxy is disabled in request, return null
    if (requestProxy.enabled === false) {
        return null;
    }

    let proxyConfig = null;

    // First, try to get from request parameters
    if (requestProxy.enabled && requestProxy.host && requestProxy.port) {
        proxyConfig = {
            enabled: true,
            type: requestProxy.type || 'hybrid',
            host: requestProxy.host,
            port: requestProxy.port,
            username: requestProxy.username,
            password: requestProxy.password
        };
    }
    // If not complete in request, try environment variables
    else if (process.env.PROXY_HOST && process.env.PROXY_PORT) {
        proxyConfig = {
            enabled: true,
            type: requestProxy.type || 'hybrid',
            host: process.env.PROXY_HOST,
            port: parseInt(process.env.PROXY_PORT, 10),
            username: requestProxy.username || process.env.PROXY_USERNAME,
            password: requestProxy.password || process.env.PROXY_PASSWORD
        };
    }
    // If neither request nor env have complete config but proxy is requested
    else if (requestProxy.enabled === true) {
        throw new Error('Proxy is enabled but host, port, username, or password are missing from both request and environment variables');
    }

    if (proxyConfig) {
        // Validate proxy configuration
        if (!proxyConfig.host || !proxyConfig.port) {
            throw new Error('Proxy host and port are required');
        }
        
        // Username and password are optional but log if missing
        if (!proxyConfig.username || !proxyConfig.password) {
            logger.warn('Proxy authentication credentials are missing');
        }

        logger.info(`Using proxy: ${proxyConfig.host}:${proxyConfig.port} (type: ${proxyConfig.type})`);
    }

    return proxyConfig;
};

/**
 * Create launch options with proxy configuration
 * @param {Object} proxyConfig - Proxy configuration
 * @returns {Object} Browser launch options
 */
export const createProxyLaunchOptions = (proxyConfig = null) => {
    const baseOptions = {
        headless: true,
        args: [
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-setuid-sandbox',
            '--no-sandbox',
            '--disable-extensions',
            '--disable-plugins',
            '--disable-images',
            '--disable-background-networking',
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows'
        ]
    };

    if (proxyConfig) {
        const proxyServer = `${proxyConfig.host}:${proxyConfig.port}`;
        baseOptions.args.push(`--proxy-server=${proxyServer}`);
        logger.info(`Configured browser with proxy: ${proxyServer}`);
    }

    return baseOptions;
};

/**
 * Determine if a response indicates the request was blocked
 * @param {Object} response - Puppeteer response object
 * @param {Object} page - Puppeteer page object
 * @returns {boolean} True if the request appears to be blocked
 */
export const isPageBlocked = async (response, page) => {
    if (!response) {
        return true; // No response usually means blocked
    }

    const status = response.status();
    const url = response.url();

    // Common blocking status codes
    if ([403, 429, 503].includes(status)) {
        logger.warn(`Potential blocking detected: ${status} for ${url}`);
        return true;
    }

    // Check for common blocking patterns in the page content
    try {
        const title = await page.title();
        const content = await page.content();
        
        const blockingIndicators = [
            'blocked',
            'access denied',
            'forbidden',
            'rate limit',
            'captcha',
            'cloudflare',
            'ddos protection',
            'security check',
            'bot detection'
        ];

        const titleLower = title.toLowerCase();
        const contentLower = content.toLowerCase();

        for (const indicator of blockingIndicators) {
            if (titleLower.includes(indicator) || contentLower.includes(indicator)) {
                logger.warn(`Blocking indicator detected: "${indicator}" in page content`);
                return true;
            }
        }

        // Check for very short content (might indicate blocking page)
        if (content.length < 500 && !contentLower.includes('<!doctype') && !contentLower.includes('<html')) {
            logger.warn(`Suspiciously short content detected: ${content.length} characters`);
            return true;
        }

        return false;
    } catch (error) {
        logger.error('Error checking if page is blocked:', error);
        return true; // Assume blocked if we can't check
    }
};

/**
 * Create error response for proxy-related failures
 * @param {Error} error - The original error
 * @param {string} url - The URL that was being accessed
 * @param {number} executionTime - Time taken for the request
 * @returns {Object} Standardized error response
 */
export const createProxyErrorResponse = (error, url, executionTime) => {
    const errorMessage = error.message || 'Proxy error';
    
    let reason = 'proxy_error';
    if (errorMessage.includes('PROXY_')) {
        reason = 'proxy_authentication_failed';
    } else if (errorMessage.includes('timeout')) {
        reason = 'proxy_timeout';
    } else if (errorMessage.includes('connection')) {
        reason = 'proxy_connection_failed';
    }

    return {
        status: 'error',
        data: {
            exec: executionTime,
            reason,
            message: errorMessage,
            url,
            timestamp: new Date().toISOString()
        }
    };
};
