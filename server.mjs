import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import fs from 'fs/promises';
import path from 'path';

import swaggerUi from 'swagger-ui-express';

import { browse } from './lib/browse-optimized.mjs';
import { validateBody, parseSchema } from './lib/validation.mjs';
import { browserPool } from './lib/browser-pool.mjs';

// Configure logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

const app = express();
const port = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"]
        }
    }
}));

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX || 100, // Limit each IP to 100 requests per windowMs
    message: {
        status: 'error',
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

app.use(limiter);

// JSON body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url} - ${req.ip}`);
    next();
});

// Direct OpenAPI specification (bypassing swagger-jsdoc temporarily)
const specs = {
    openapi: '3.1.0',
        info: {
            title: 'Parser API',
            version: '2.0.0',
            description: 'A web scraping API powered by Puppeteer with stealth capabilities',
            contact: {
            name: 'API Support',
            url: 'https://github.com',
            email: 'support@example.com'
        },
        license: {
            name: 'MIT',
            url: 'https://opensource.org/licenses/MIT'
            }
        },
        servers: [
            {
                url: `http://localhost:${port}`,
                description: 'Development server'
            }
        ],
    paths: {
        '/parse': {
            post: {
                summary: 'Parse a web page with advanced options',
                description: `Extract content, take screenshots, and monitor network requests from any web page. This endpoint uses stealth mode and adblockers for reliable scraping.

**Optional Field Cases & Common Combinations:**

**📸 Screenshot Cases:**
- \`screenshot.enabled: false\` (default): No screenshot, fastest response
- \`screenshot: { enabled: true, full_page: false }\`: Viewport screenshot only
- \`screenshot: { enabled: true, full_page: true }\`: Complete page screenshot (slower)

**🌐 Network Monitoring Cases:**
- \`network.enabled: false\` (default): No network monitoring, fastest response
- \`network.enabled: true\`: Monitor all requests, includes response data
- \`network: { enabled: false, block_urls: [...] }\`: Block ads/trackers without monitoring
- \`network: { enabled: true, allow_types: ["document", "script"] }\`: Monitor + filter resource types
- \`network: { enabled: false, wait_until: "networkidle2" }\`: Wait for stability without monitoring

**📱 Viewport Cases:**
- Default \`{ width: 1200, height: 800 }\`: Standard desktop viewport
- \`{ width: 375, height: 667 }\`: iPhone simulation
- \`{ width: 768, height: 1024 }\`: Tablet simulation
- \`{ width: 1920, height: 1080 }\`: HD desktop simulation

**⏱️ Timeout Cases:**
- \`timeout: 30000\` (default): Standard timeout for most sites
- \`timeout: 45000+\`: Heavy sites, full-page screenshots, slow connections
- \`timeout: 15000\`: Fast sites, viewport screenshots only

**🤖 User Agent Cases:**
- Omit field: Use default Chrome user agent (recommended)
- Mobile simulation: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)..."
- Bot identification: "MyBot/1.0 (+https://example.com/bot)"
- Legacy browser: "Mozilla/5.0 (compatible; MSIE 11.0; Windows NT 10.0)"

**🔒 Proxy Cases:**
- \`proxy.enabled: false\` (default): Direct connection
- \`proxy: { enabled: true, type: "hybrid" }\`: Try direct, fallback to proxy if blocked
- \`proxy: { enabled: true, type: "static" }\`: Always use proxy
- Credentials from environment variables: Set PROXY_HOST, PROXY_PORT, etc.
- Credentials in request: Override environment with request parameters

**⚡ Performance Optimization Combinations:**
- **Fastest**: \`{ screenshot: false, network: false, timeout: 15000 }\`
- **Balanced**: \`{ screenshot: { enabled: true }, network: { wait_until: "networkidle2" }, timeout: 30000 }\`
- **Comprehensive**: \`{ screenshot: { enabled: true, full_page: true }, network: { enabled: true }, timeout: 45000 }\`

**🚫 Blocking & Filtering Combinations:**
- **Ad-free browsing**: \`{ network: { block_urls: ["ads", "doubleclick", "facebook.com/tr"] } }\`
- **Essential resources only**: \`{ network: { allow_types: ["document", "script", "stylesheet"] } }\`
- **Monitor + Block**: \`{ network: { enabled: true, block_urls: ["analytics"], allow_types: ["document", "xhr"] } }\`

**💾 Data Saving Cases:**
- \`save: false\` (default): Don't save data, return response only
- \`save: true\`: Save parsed data to data directory with timestamp for later analysis
- Data saved includes: HTML content, screenshots (if enabled), network requests (if monitored), and metadata`,
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['url'],
                                properties: {
                                    url: {
                                        type: 'string',
                                        format: 'uri',
                                        description: 'Target URL to parse'
                                    },
                                    screenshot: {
                                        type: 'object',
                                        properties: {
                                            enabled: { type: 'boolean', default: false },
                                            full_page: { type: 'boolean', default: false }
                                        }
                                    },
                                    network: {
                                        type: 'object',
                                        properties: {
                                            enabled: { type: 'boolean', default: false },
                                            block_urls: { type: 'array', items: { type: 'string' } },
                                            allow_types: { type: 'array', items: { type: 'string' } },
                                            wait_until: { type: 'string', enum: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'] }
                                        }
                                    },
                                    viewport: {
                                        type: 'object',
                                        properties: {
                                            width: { type: 'integer', minimum: 320, maximum: 3840, default: 1200 },
                                            height: { type: 'integer', minimum: 240, maximum: 2160, default: 800 }
                                        }
                                    },
                                    timeout: {
                                        type: 'integer',
                                        minimum: 5000,
                                        maximum: 60000,
                                        default: 30000
                                    },
                                    user_agent: {
                                        type: 'string',
                                        maxLength: 500
                                    },
                                    proxy: {
                                        type: 'object',
                                        properties: {
                                            enabled: { type: 'boolean', default: false },
                                            type: { type: 'string', enum: ['static', 'hybrid'], default: 'hybrid' },
                                            host: { type: 'string' },
                                            port: { type: 'integer', minimum: 1, maximum: 65535 },
                                            username: { type: 'string' },
                                            password: { type: 'string' }
                                        }
                                    },
                                    save: {
                                        type: 'boolean',
                                        default: false,
                                        description: 'Save parsed data to local data directory for later analysis'
                                    }
                                }
                            },
                            examples: {
                                comprehensive_scraping: {
                                    summary: 'Comprehensive scraping with full monitoring',
                                    value: {
                                        url: 'https://example.com',
                                        screenshot: {
                                            enabled: true,
                                            full_page: true
                                        },
                                        network: {
                                            enabled: true,
                                            block_urls: ['ads.example.com', 'analytics', 'facebook.com/tr'],
                                            allow_types: ['document', 'script', 'stylesheet', 'xhr', 'fetch'],
                                            wait_until: 'networkidle0'
                                        },
                                        viewport: {
                                            width: 1920,
                                            height: 1080
                                        },
                                        timeout: 45000,
                                        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                                        proxy: {
                                            enabled: true,
                                            type: 'hybrid',
                                            host: 'your.proxy.host',
                                            port: 8080,
                                            username: 'your_proxy_username',
                                            password: 'your_proxy_password'
                                        },
                                        save: true
                                    }
                                },
                                mobile_simulation: {
                                    summary: 'Mobile device simulation',
                                    value: {
                                        url: 'https://mobile-site.com',
                                        screenshot: {
                                            enabled: true,
                                            full_page: false
                                        },
                                        viewport: {
                                            width: 375,
                                            height: 667
                                        },
                                        user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15',
                                        timeout: 30000
                                    }
                                },
                                fast_content_only: {
                                    summary: 'Fast content extraction (no screenshots/monitoring)',
                                    value: {
                                        url: 'https://fast-site.com',
                                        network: {
                                            block_urls: ['ads', 'tracking', 'analytics'],
                                            wait_until: 'domcontentloaded'
                                        },
                                        timeout: 15000
                                    }
                                },
                                anti_detection: {
                                    summary: 'Anti-detection with proxy fallback',
                                    value: {
                                        url: 'https://protected-site.com',
                                        screenshot: {
                                            enabled: true,
                                            full_page: false
                                        },
                                        network: {
                                            block_urls: ['analytics', 'tracking', 'ads'],
                                            allow_types: ['document', 'script', 'stylesheet', 'image'],
                                            wait_until: 'networkidle2'
                                        },
                                        viewport: {
                                            width: 1366,
                                            height: 768
                                        },
                                        timeout: 45000,
                                        proxy: {
                                            enabled: true,
                                            type: 'hybrid'
                                        }
                                    }
                                },
                                minimal_request: {
                                    summary: 'Minimal request (only URL required)',
                                    value: {
                                        url: 'https://simple-site.com'
                                    }
                                }
                            }
                        }
                    }
                },
                responses: {
                    '200': {
                        description: 'Successfully parsed the page',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ParseResponse' }
                            }
                        }
                    },
                    '400': {
                        description: 'Validation error',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string', example: 'error' },
                                        message: { type: 'string', example: 'Validation failed' },
                                        errors: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    field: { type: 'string' },
                                                    message: { type: 'string' }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    },
        components: {
            schemas: {
                ParseResponse: {
                    type: 'object',
                    properties: {
                        status: {
                            type: 'string',
                            enum: ['ok', 'error']
                        },
                        data: {
                            type: 'object',
                            properties: {
                                exec: {
                                    type: 'number',
                                    description: 'Execution time in seconds'
                                },
                                network: {
                                    type: 'array',
                                    description: 'Network requests made during page load'
                                },
                                metrics: {
                                    type: 'object',
                                    description: 'Page performance metrics'
                                },
                                title: {
                                    type: 'string',
                                    description: 'Page title'
                                },
                                html: {
                                    type: 'string',
                                    description: 'Page HTML content'
                                },
                                screenshot: {
                                    type: 'string',
                                    description: 'Base64 encoded screenshot'
                                },
                                url: {
                                    type: 'string',
                                    description: 'Requested URL'
                                },
                                                            timestamp: {
                                type: 'string',
                                description: 'ISO timestamp'
                            },
                            saved: {
                                type: 'object',
                                description: 'Information about saved data (only present when save: true)',
                                properties: {
                                    filename: {
                                        type: 'string',
                                        description: 'Name of the saved file'
                                    },
                                    path: {
                                        type: 'string',
                                        description: 'Path to the saved file'
                                    },
                                    timestamp: {
                                        type: 'string',
                                        description: 'ISO timestamp when file was saved'
                                    }
                                }
                            }
                            }
                        }
                    }
                }
            }
        }
};

// Log the full generated spec for debugging
logger.info('Full generated OpenAPI spec:', JSON.stringify(specs, null, 2));

// Validate the generated spec has required fields
if (!specs.openapi) {
    logger.error('Missing openapi version field in generated spec');
}
if (!specs.info || !specs.info.version) {
    logger.error('Missing info.version field in generated spec');
}

app.use('/docs', swaggerUi.serve, swaggerUi.setup(specs, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Parser API Documentation',
    swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        tryItOutEnabled: true
    }
}));

app.get('/', (req, res) => {
    res.json({
        status: 'ok'
    });
});

// Raw OpenAPI spec endpoint for debugging
app.get('/openapi.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(specs);
});


app.post('/parse', validateBody(parseSchema), async (req, res) => {
    const startTime = Date.now();
    
    try {
        const params = req.validatedBody;
        
        logger.info(`Parsing request for URL: ${params.url}`);
        
        const results = await browse(params);

        // Save data to file if requested
        if (params.save === true) {
            try {
                const timestamp = Date.now();
                const urlHost = new URL(params.url).hostname.replace(/\./g, '_');
                const filename = `${urlHost}_${timestamp}.json`;
                const filePath = path.join('data', filename);
                
                // Ensure data directory exists
                await fs.mkdir('data', { recursive: true });
                
                // Save the complete results to file
                const dataToSave = {
                    ...results,
                    request: {
                        url: params.url,
                        timestamp: new Date().toISOString(),
                        parameters: params
                    }
                };
                
                await fs.writeFile(filePath, JSON.stringify(dataToSave, null, 2));
                
                // Add saved file info to response
                results.data.saved = {
                    filename,
                    path: filePath,
                    timestamp: new Date().toISOString()
                };
                
                logger.info(`Data saved to ${filePath} for ${params.url}`);
            } catch (saveError) {
                logger.error(`Failed to save data for ${params.url}:`, saveError);
                // Don't fail the request if saving fails, just log the error
                results.data.save_error = 'Failed to save data to file';
            }
        }

        const totalTime = (Date.now() - startTime) / 1000;
        logger.info(`Request completed in ${totalTime}s for ${params.url}`);

        res.json(results);
        
    } catch (error) {
        const totalTime = (Date.now() - startTime) / 1000;
        logger.error(`Request failed after ${totalTime}s:`, error);
        
        res.status(500).json({
            status: 'error',
            data: {
                exec: totalTime,
                reason: 'server_error',
                message: 'Internal server error'
            }
        });
    }
});



// Global error handler
app.use((error, req, res, next) => {
    logger.error('Unhandled error:', error);
    
    res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).send('error: not found');
});

// Graceful shutdown
const gracefulShutdown = async () => {
    logger.info('Starting graceful shutdown...');
    
    await browserPool.closeAll();
    
    process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

const server = app.listen(port, () => {
    logger.info(`🚀 Parser API v2.0.0 listening on port ${port}`);
    logger.info(`📚 API Documentation available at http://localhost:${port}/docs`);
});

// Handle server errors
server.on('error', (error) => {
    logger.error('Server error:', error);
});

export default app;