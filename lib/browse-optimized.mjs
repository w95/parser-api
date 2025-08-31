import { browserPool } from './browser-pool.mjs';
import winston from 'winston';
import { getProxyConfig, isPageBlocked, createProxyErrorResponse } from './proxy-utils.mjs';

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
 * Parse a web page using Puppeteer
 * @param {Object} params - Parsing parameters
 * @param {string} params.url - URL to parse
 * @param {Object} params.screenshot - Screenshot configuration
 * @param {Object} params.network - Network configuration
 * @param {Object} params.viewport - Viewport configuration
 * @param {number} params.timeout - Request timeout
 * @param {string} params.user_agent - Custom user agent
 * @param {Object} params.proxy - Proxy configuration
 * @returns {Object} Parse results
 */
export const browse = async (params) => {
    const { url, screenshot, network, viewport, timeout, user_agent, proxy } = params;
    const start = Date.now();
    
    try {
        // Validate URL
        new URL(url); // Will throw if invalid
        
        // Get proxy configuration
        let proxyConfig;
        try {
            proxyConfig = getProxyConfig(proxy);
        } catch (error) {
            const executionTime = (Date.now() - start) / 1000;
            return createProxyErrorResponse(error, url, executionTime);
        }

        // Handle different proxy modes
        if (proxyConfig && proxyConfig.type === 'static') {
            // Static mode: always use proxy
            logger.info(`Using static proxy mode for ${url}`);
            return await performRequest(url, params, proxyConfig, start);
        } else if (proxyConfig && proxyConfig.type === 'hybrid') {
            // Hybrid mode: try without proxy first, then with proxy if blocked
            logger.info(`Using hybrid proxy mode for ${url}`);
            
            try {
                // First attempt without proxy
                logger.info(`Attempting request without proxy for ${url}`);
                const result = await performRequest(url, params, null, start);
                
                // Check if the request was blocked
                if (result.status === 'error' && shouldRetryWithProxy(result)) {
                    logger.info(`Request appears blocked, retrying with proxy for ${url}`);
                    return await performRequest(url, params, proxyConfig, start);
                }
                
                return result;
            } catch (error) {
                // If first attempt fails, try with proxy
                logger.info(`Request failed, retrying with proxy for ${url}: ${error.message}`);
                return await performRequest(url, params, proxyConfig, start);
            }
        } else {
            // No proxy or proxy disabled
            logger.info(`No proxy configuration for ${url}`);
            return await performRequest(url, params, null, start);
        }

    } catch (error) {
        const executionTime = (Date.now() - start) / 1000;
        const errorMessage = error.message || 'Unknown error';
        
        logger.error(`Error parsing ${url}: ${errorMessage}`);
        
        return {
            status: 'error',
            data: {
                exec: executionTime,
                reason: getErrorReason(error),
                message: errorMessage,
                url,
                timestamp: new Date().toISOString()
            }
        };
    }
};

/**
 * Perform the actual request with or without proxy
 */
async function performRequest(url, params, proxyConfig, startTime) {
    const { screenshot, network, viewport, timeout, user_agent } = params;
    let page = null;
    let browser = null;
    
    try {
        browser = await browserPool.getBrowser(proxyConfig);
        page = await browser.newPage();

        // Set proxy authentication if using proxy
        if (proxyConfig && proxyConfig.username && proxyConfig.password) {
            await page.authenticate({
                username: proxyConfig.username,
                password: proxyConfig.password
            });
        }

        // Configure viewport
        await page.setViewport({ 
            width: viewport.width, 
            height: viewport.height 
        });

        // Set user agent
        await page.setUserAgent(
            user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        const networkRequests = [];
        
        if (network.enabled) {
            await page.setRequestInterception(true);
            
            page.on('request', (request) => {
                const shouldBlock = shouldBlockRequest(request, network.allow_types, network.block_urls);
                
                if (shouldBlock.block) {
                    request.abort();
                } else {
                    request.continue();
                }

                networkRequests.push({
                    method: request.method(),
                    type: request.resourceType(),
                    url: request.url(),
                    headers: request.headers(),
                    blocked: shouldBlock.block,
                    reason: shouldBlock.reason
                });
            });
        }

        // Navigate to page with timeout
        const response = await page.goto(url, {
            waitUntil: network.wait_until,
            timeout
        });

        // Check if page was blocked (only for hybrid mode verification)
        if (proxyConfig && proxyConfig.type === 'hybrid' && await isPageBlocked(response, page)) {
            throw new Error('Page appears to be blocked');
        }

        // Capture screenshot if requested
        let screenshotData = '';
        if (screenshot.enabled) {
            screenshotData = await page.screenshot({
                fullPage: screenshot.full_page,
                encoding: 'base64',
                type: 'png'
            });
        }

        // Get page metrics and content
        const [metrics, title, html] = await Promise.all([
            page.metrics(),
            page.title(),
            page.content()
        ]);

        const executionTime = (Date.now() - startTime) / 1000;
        const proxyUsed = proxyConfig ? `${proxyConfig.host}:${proxyConfig.port}` : 'none';
        logger.info(`Successfully parsed ${url} in ${executionTime}s (proxy: ${proxyUsed})`);

        return {
            status: 'ok',
            data: {
                exec: executionTime,
                network: networkRequests,
                metrics,
                title,
                html,
                screenshot: screenshotData,
                url,
                timestamp: new Date().toISOString(),
                proxy_used: proxyUsed
            }
        };

    } catch (error) {
        const executionTime = (Date.now() - startTime) / 1000;
        const errorMessage = error.message || 'Unknown error';
        
        const proxyUsed = proxyConfig ? `${proxyConfig.host}:${proxyConfig.port}` : 'none';
        logger.error(`Error parsing ${url} (proxy: ${proxyUsed}): ${errorMessage}`);
        
        return {
            status: 'error',
            data: {
                exec: executionTime,
                reason: getErrorReason(error),
                message: errorMessage,
                url,
                timestamp: new Date().toISOString(),
                proxy_used: proxyUsed
            }
        };
    } finally {
        if (page) {
            await page.close().catch(err => 
                logger.error('Error closing page:', err)
            );
        }
        // Close proxy browsers immediately to avoid conflicts
        if (browser && proxyConfig) {
            await browser.close().catch(err => 
                logger.error('Error closing proxy browser:', err)
            );
        }
    }
}

/**
 * Check if we should retry with proxy based on the error result
 */
function shouldRetryWithProxy(result) {
    if (result.status !== 'error') {
        return false;
    }
    
    const reason = result.data.reason;
    const message = result.data.message.toLowerCase();
    
    // Retry with proxy for these types of errors
    const retryReasons = ['timeout', 'connection_refused', 'dns_error'];
    const retryMessages = ['blocked', 'access denied', 'forbidden', 'rate limit', 'captcha'];
    
    if (retryReasons.includes(reason)) {
        return true;
    }
    
    for (const retryMessage of retryMessages) {
        if (message.includes(retryMessage)) {
            return true;
        }
    }
    
    return false;
}

/**
 * Determine if a request should be blocked
 */
function shouldBlockRequest(request, allowTypes, blockUrls) {
    const url = request.url();
    const resourceType = request.resourceType();
    
    // Check if URL is in block list
    if (blockUrls.some(blockedUrl => url.includes(blockedUrl))) {
        return { block: true, reason: 'blocked_url' };
    }
    
    // Block data URIs for images (performance optimization)
    if (resourceType === 'image' && url.startsWith('data:image/')) {
        return { block: true, reason: 'data_uri_image' };
    }
    
    // Block fonts by default (performance optimization)
    if (resourceType === 'font') {
        return { block: true, reason: 'font_blocked' };
    }
    
    // Always allow document requests
    if (resourceType === 'document') {
        return { block: false, reason: 'document_allowed' };
    }
    
    // If allow list is specified, only allow those types
    if (allowTypes.length > 0) {
        if (!allowTypes.includes(resourceType)) {
            return { block: true, reason: 'not_in_allow_list' };
        }
    }
    
    return { block: false, reason: 'allowed' };
}

/**
 * Get user-friendly error reason
 */
function getErrorReason(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout') || message.includes('navigation timeout')) {
        return 'timeout';
    }
    if (message.includes('net::err_name_not_resolved')) {
        return 'dns_error';
    }
    if (message.includes('net::err_connection_refused')) {
        return 'connection_refused';
    }
    if (message.includes('net::err_ssl_version_or_cipher_mismatch')) {
        return 'ssl_error';
    }
    if (message.includes('invalid url')) {
        return 'invalid_url';
    }
    
    return 'unknown_error';
}
