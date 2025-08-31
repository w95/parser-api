# Parser API v2.0.0 🚀

A high-performance web scraping API built with Node.js, Express, and Puppeteer featuring stealth capabilities, advanced proxy support, browser pooling, and comprehensive data extraction capabilities.

## ✨ Features

- **🎭 Stealth Mode**: Built-in stealth plugins and adblockers to bypass detection
- **🏊 Browser Pooling**: Efficient browser instance management with up to 3 concurrent browsers
- **🔀 Advanced Proxy Support**: Static and hybrid proxy modes with automatic fallback
- **📸 Screenshot Capture**: Full-page or viewport screenshots with customizable options
- **🌐 Network Monitoring**: Request filtering, blocking, and detailed network analysis
- **💾 Data Persistence**: Optional saving of parsed data for later analysis
- **🛡️ Security**: Rate limiting, CORS, security headers, and comprehensive input validation
- **📚 API Documentation**: Interactive Swagger/OpenAPI documentation
- **📊 Monitoring**: Detailed logging with Winston and execution metrics
- **🐳 Docker Ready**: Complete containerization support

## 🏁 Quick Start

### Prerequisites

- Node.js 16+ (ES Modules support required)
- Chrome/Chromium browser dependencies (automatically handled in Docker)

### Installation

```bash
# Clone and install dependencies
npm install

# Copy environment configuration
cp .env.example .env
# Edit .env with your configuration
```

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

The API will be available at `http://localhost:3001`

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build manually
docker build -t parser-api .
docker run -p 3001:3001 --env-file .env parser-api
```

## 📚 API Documentation

Interactive Swagger documentation is available at `http://localhost:3001/docs`

Raw OpenAPI specification: `http://localhost:3001/openapi.json`

## 🔗 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | API status check |
| `/parse` | POST | Parse a web page with advanced options |
| `/docs` | GET | Interactive Swagger documentation |
| `/openapi.json` | GET | Raw OpenAPI specification |

## 🎯 Parse Endpoint

### `POST /parse`

Parse a web page and extract content with advanced configuration options including screenshots, network monitoring, proxy support, and data persistence.

**Request Format**: JSON POST body (not query parameters)

### Request Schema

```json
{
  "url": "string (required)",
  "screenshot": {
    "enabled": "boolean (default: false)",
    "full_page": "boolean (default: false)"
  },
  "network": {
    "enabled": "boolean (default: false)",
    "block_urls": "array of strings (default: [])",
    "allow_types": "array of strings (default: [])",
    "wait_until": "string (default: 'networkidle0')"
  },
  "viewport": {
    "width": "integer (default: 1200, range: 320-3840)",
    "height": "integer (default: 800, range: 240-2160)"
  },
  "timeout": "integer (default: 30000, range: 5000-60000)",
  "user_agent": "string (optional, max 500 chars)",
  "proxy": {
    "enabled": "boolean (default: false)",
    "type": "string (static|hybrid, default: hybrid)",
    "host": "string (optional)",
    "port": "integer (optional, range: 1-65535)",
    "username": "string (optional)",
    "password": "string (optional)"
  },
  "save": "boolean (default: false)"
}
```

### Resource Types (for `allow_types`)

- `document`, `script`, `stylesheet`, `image`, `font`, `xhr`, `fetch`, `websocket`, `manifest`, `media`, `texttrack`, `eventsource`, `other`

### Wait Until Options (for `wait_until`)

- `load` - Wait for the load event
- `domcontentloaded` - Wait for DOMContentLoaded event  
- `networkidle0` - Wait until there are no network connections for at least 500ms
- `networkidle2` - Wait until there are no more than 2 network connections for at least 500ms

### Proxy Modes

- **Static**: Always use the configured proxy
- **Hybrid**: Try direct connection first, fallback to proxy if blocked/failed

### Example Requests

#### Basic Scraping
```bash
curl -X POST http://localhost:3001/parse \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

#### Full-Featured Scraping
```bash
curl -X POST http://localhost:3001/parse \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "screenshot": {
      "enabled": true,
      "full_page": true
    },
    "network": {
      "enabled": true,
      "block_urls": ["ads.example.com", "analytics"],
      "allow_types": ["document", "script", "stylesheet", "xhr"],
      "wait_until": "networkidle0"
    },
    "viewport": {
      "width": 1920,
      "height": 1080
    },
    "timeout": 45000,
    "proxy": {
      "enabled": true,
      "type": "hybrid"
    },
    "save": true
  }'
```

#### Mobile Simulation
```bash
curl -X POST http://localhost:3001/parse \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://mobile-site.com",
    "screenshot": {
      "enabled": true,
      "full_page": false
    },
    "viewport": {
      "width": 375,
      "height": 667
    },
    "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15"
  }'
```

### Successful Response (200)

```json
{
  "status": "ok",
  "data": {
    "exec": 2.45,
    "network": [
      {
        "method": "GET",
        "type": "document",
        "url": "https://example.com/",
        "headers": {
          "user-agent": "Mozilla/5.0..."
        },
        "blocked": false,
        "reason": "document_allowed"
      }
    ],
    "metrics": {
      "Timestamp": 1398287.869696,
      "Documents": 1,
      "Nodes": 156,
      "JSHeapUsedSize": 2845688
    },
    "title": "Example Domain",
    "html": "<!doctype html>...",
    "screenshot": "data:image/png;base64,...",
    "url": "https://example.com",
    "timestamp": "2025-01-31T11:53:42.337Z",
    "proxy_used": "proxy.example.com:8080",
    "saved": {
      "filename": "example_com_1756652711572.json",
      "path": "data/example_com_1756652711572.json",
      "timestamp": "2025-01-31T11:53:42.337Z"
    }
  }
}
```

### Error Response (400/500)

```json
{
  "status": "error",
  "data": {
    "exec": 1.23,
    "reason": "timeout",
    "message": "Navigation timeout exceeded",
    "url": "https://example.com",
    "timestamp": "2025-01-31T11:53:42.337Z",
    "proxy_used": "none"
  }
}
```

### Validation Error Response (400)

```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": [
    {
      "field": "url",
      "message": "URL must be a valid HTTP or HTTPS URL"
    }
  ]
}
```

## ⚙️ Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Server Configuration
PORT=3001
NODE_ENV=development

# Logging
LOG_LEVEL=info

# Rate Limiting (requests per 15 minutes)
RATE_LIMIT_MAX=100

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Proxy Configuration (optional)
PROXY_HOST=your.proxy.host
PROXY_PORT=8080
PROXY_USERNAME=your_proxy_username
PROXY_PASSWORD=your_proxy_password
```

### Browser Pool Configuration

The browser pool maintains up to 3 concurrent browser instances for optimal performance:

- **Round-robin allocation**: Distributes requests across available browsers
- **Automatic recovery**: Recreates disconnected browser instances
- **Proxy isolation**: Proxy requests use dedicated browser instances
- **Graceful shutdown**: Properly closes all browsers on exit

## 🔒 Security & Performance

### Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP (configurable)
- **Input Validation**: Comprehensive JSON schema validation with Joi
- **Security Headers**: Helmet.js for security header management
- **CORS**: Configurable cross-origin resource sharing
- **Content Security Policy**: Strict CSP for `/docs` endpoint
- **Request Logging**: All requests logged with IP tracking

### Performance Optimizations

- **Browser Pooling**: Reuses browser instances (~60% faster response times)
- **Resource Blocking**: Automatic blocking of fonts, data URIs, and unwanted content
- **Stealth Mode**: Bypasses detection while maintaining performance
- **Memory Management**: Automatic cleanup and garbage collection
- **Connection Limits**: Optimized for concurrent request handling

### Browser Optimizations

Default browser launch arguments for performance:
- Disabled GPU rendering, sandbox, and unnecessary features
- Optimized for headless operation
- Memory usage optimization
- Background process throttling disabled

## 🔄 Proxy Support

### Proxy Modes

1. **Static Mode** (`type: "static"`):
   - Always uses the configured proxy
   - Best for consistent proxy requirements
   - Immediate proxy connection

2. **Hybrid Mode** (`type: "hybrid"`) - Default:
   - Attempts direct connection first
   - Falls back to proxy if blocked or failed
   - Intelligent retry logic based on error patterns
   - Optimal for varied target requirements

### Proxy Configuration Priority

1. **Request Parameters**: Proxy settings in the request body
2. **Environment Variables**: `PROXY_HOST`, `PROXY_PORT`, etc.
3. **Mixed**: Request type + environment credentials

### Proxy Error Handling

Automatic retry with proxy for these conditions:
- HTTP status codes: 403, 429, 503
- Error patterns: "blocked", "access denied", "rate limit", "captcha"
- Network errors: timeouts, connection refused, DNS errors

## 💾 Data Persistence

### Saving Parsed Data

Set `"save": true` in your request to automatically save complete parsing results:

```json
{
  "url": "https://example.com",
  "save": true
}
```

**Saved Data Structure:**
- Complete API response including HTML, screenshots, network data
- Request metadata and parameters
- Timestamps and execution metrics
- Saved to `data/` directory with format: `{hostname}_{timestamp}.json`

**File Naming:** `example_com_1756652711572.json`

## 🧪 Testing

Run the comprehensive test suite:

```bash
node test.mjs
```

The test suite includes:
- No proxy testing
- Static proxy testing  
- Hybrid proxy testing
- Environment variable proxy testing
- Results saved to `data/` directory

## 🛠️ Error Handling

### Error Types

- **Validation Errors**: Invalid JSON schema with detailed field errors
- **Timeout Errors**: Navigation or request timeouts
- **Network Errors**: DNS resolution, connection, SSL issues
- **Proxy Errors**: Authentication, connection, or configuration failures
- **Server Errors**: Internal processing errors with execution metrics
- **404 Errors**: Invalid endpoints return "error: not found"

### Error Response Format

All errors follow consistent format with:
- Execution time tracking
- Detailed error categorization
- Proxy usage information
- Timestamp for debugging
- User-friendly error messages

## 📊 Monitoring & Logging

### Log Files

- **`error.log`**: Error-level events only
- **`combined.log`**: All log levels combined
- **Console Output**: Development-friendly format

### Metrics Tracking

- Request execution time
- Memory usage monitoring
- Browser pool status
- Network request statistics
- Proxy usage analytics

### Health Monitoring

- Automatic browser health checks
- Connection monitoring
- Resource cleanup tracking
- Graceful shutdown handling

## 🏗️ Architecture

### Core Components

- **`server.mjs`**: Main Express application with middleware and routes
- **`lib/browse-optimized.mjs`**: Core scraping logic with proxy support
- **`lib/browser-pool.mjs`**: Browser instance management and pooling
- **`lib/validation.mjs`**: Request validation schemas and middleware
- **`lib/proxy-utils.mjs`**: Proxy configuration and utility functions

### Technology Stack

- **Runtime**: Node.js with ES Modules
- **Framework**: Express.js v4.21.2
- **Browser Engine**: Puppeteer v24.17.1 with stealth plugins
- **Validation**: Joi v17.13.3
- **Logging**: Winston v3.17.0
- **Documentation**: Swagger UI Express v5.0.1
- **Security**: Helmet, CORS, Express Rate Limit

## 🚀 Deployment

### Docker

The project includes complete Docker support:

```bash
# Development
docker-compose up

# Production
docker build -t parser-api .
docker run -d -p 3001:3001 --env-file .env parser-api
```

**Docker Features:**
- Multi-platform support (linux/amd64)
- Complete Chrome dependencies included
- Volume mounting for data persistence
- Environment variable support

### Manual Deployment

1. Install Node.js 16+
2. Install system dependencies for Puppeteer
3. Configure environment variables
4. Run `npm install && npm start`

## 📋 Use Cases & Examples

### Content Extraction
Perfect for extracting clean HTML content from any website:
```json
{
  "url": "https://news-site.com/article",
  "network": {
    "block_urls": ["ads", "tracking", "analytics"],
    "wait_until": "domcontentloaded"
  }
}
```

### Website Screenshots
Generate high-quality screenshots for documentation or monitoring:
```json
{
  "url": "https://your-website.com",
  "screenshot": {
    "enabled": true,
    "full_page": true
  },
  "viewport": {
    "width": 1920,
    "height": 1080
  }
}
```

### Network Analysis
Monitor and analyze network requests for performance auditing:
```json
{
  "url": "https://app.example.com",
  "network": {
    "enabled": true,
    "allow_types": ["document", "xhr", "fetch"]
  },
  "save": true
}
```

### Anti-Detection Scraping
Bypass bot detection with stealth mode and proxy rotation:
```json
{
  "url": "https://protected-site.com",
  "proxy": {
    "enabled": true,
    "type": "hybrid"
  },
  "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  "network": {
    "block_urls": ["analytics", "tracking"],
    "wait_until": "networkidle2"
  }
}
```

## 🔧 Advanced Configuration

### Performance Tuning

For high-volume usage:
```bash
# Increase rate limits
RATE_LIMIT_MAX=500

# Optimize browser pool (max 3 recommended)
# Adjust timeout for faster sites
timeout: 15000

# Disable unnecessary features
screenshot: { enabled: false }
network: { enabled: false }
```

### Memory Management

The API automatically manages memory through:
- Browser instance recycling
- Page cleanup after each request
- Proxy browser isolation
- Graceful shutdown procedures

### Security Hardening

```bash
# Production environment
NODE_ENV=production

# Restrict CORS origins
ALLOWED_ORIGINS=https://yourdomain.com

# Lower rate limits for public APIs
RATE_LIMIT_MAX=50

# Enable detailed logging
LOG_LEVEL=debug
```

## 🆕 Version 2.0.0 Highlights

### New Features
- **Advanced Proxy Support**: Static and hybrid proxy modes
- **Data Persistence**: Save complete parsing results with `save: true`
- **Enhanced Validation**: Comprehensive JSON schema validation
- **Network Filtering**: Granular control over resource loading
- **Mobile Simulation**: Complete viewport and user agent customization

### Architecture Improvements
- **JSON API**: Migrated from query parameters to JSON POST requests
- **Browser Pooling**: 60% performance improvement through instance reuse
- **Error Handling**: Detailed error categorization and metrics
- **Security**: Complete security middleware stack
- **Documentation**: Interactive Swagger UI with comprehensive examples

### Package Updates
- Express: 4.17.1 → 4.21.2
- Puppeteer: 24.1.0 → 24.17.1
- Puppeteer Core: 24.1.0 → 24.17.1
- CycleTLS: 1.0.27 → 2.0.4
- Added: CORS, Helmet, Rate Limiting, Joi, Winston, Swagger tools

## 🤝 Contributing

### Development Setup

```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Run tests
node test.mjs
```

### Code Structure

- Follow ES Module syntax
- Use async/await for asynchronous operations
- Maintain Winston logging throughout
- Add Joi validation for new parameters
- Update OpenAPI schema for new endpoints

## 📄 License

ISC

## 🆘 Support & Troubleshooting

### Common Issues

1. **Chrome Dependencies**: Use Docker for consistent environment
2. **Memory Usage**: Monitor browser pool and implement cleanup
3. **Proxy Issues**: Check credentials and network connectivity
4. **Rate Limiting**: Adjust `RATE_LIMIT_MAX` for your use case

### Debug Information

- Check logs in `error.log` and `combined.log`
- Use `/openapi.json` to verify API schema
- Enable `LOG_LEVEL=debug` for detailed tracing
- Test proxy configuration with `test.mjs`

### Performance Tips

- Use `network.enabled: false` for faster content-only extraction
- Set appropriate `timeout` values based on target sites
- Use `viewport` screenshots instead of `full_page` when possible
- Configure `block_urls` to reduce network overhead

---

**Parser API v2.0.0** - Built for reliability, performance, and comprehensive web data extraction.