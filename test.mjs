import fs from 'fs/promises';
import path from 'path';

// Ensure data directory exists
const dataDir = './data';
await fs.mkdir(dataDir, { recursive: true });

// Test configurations
const testConfigs = [
    {
        name: 'No Proxy Test',
        url: 'https://httpbin.org/user-agent',
        payload: {
            url: 'https://httpbin.org/user-agent',
            screenshot: { enabled: false },
            network: { enabled: false },
            proxy: { enabled: false }
        }
    },
    {
        name: 'Static Proxy Test',
        url: 'https://httpbin.org/ip',
        payload: {
            url: 'https://httpbin.org/ip',
            screenshot: { enabled: false },
            network: { enabled: false },
            proxy: {
                enabled: true,
                type: 'static',
                host: 'your.proxy.host',
                port: 8080,
                username: 'your_proxy_username',
                password: 'your_proxy_password'
            }
        }
    },
    {
        name: 'Hybrid Proxy Test (should work without proxy)',
        url: 'https://httpbin.org/headers',
        payload: {
            url: 'https://httpbin.org/headers',
            screenshot: { enabled: false },
            network: { enabled: false },
            proxy: {
                enabled: true,
                type: 'hybrid',
                host: 'your.proxy.host',
                port: 8080,
                username: 'your_proxy_username',
                password: 'your_proxy_password'
            }
        }
    },
    {
        name: 'Environment Variables Proxy Test',
        url: 'https://httpbin.org/ip',
        payload: {
            url: 'https://httpbin.org/ip',
            screenshot: { enabled: false },
            network: { enabled: false },
            proxy: {
                enabled: true,
                type: 'static'
                // Will use environment variables
            }
        }
    }
];

const baseUrl = 'http://localhost:3001';

async function runTest(config) {
    console.log(`\n🧪 Running: ${config.name}`);
    console.log('=' .repeat(50));
    
    const startTime = Date.now();
    
    try {
        const response = await fetch(`${baseUrl}/parse`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config.payload)
        });

        const data = await response.json();
        const executionTime = (Date.now() - startTime) / 1000;
        
        // Save response to file
        const filename = `${config.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.json`;
        const filepath = path.join(dataDir, filename);
        await fs.writeFile(filepath, JSON.stringify(data, null, 2));
        
        console.log(`✅ Status: ${data.status}`);
        console.log(`⏱️  Execution Time: ${executionTime}s`);
        console.log(`🔗 URL: ${config.url}`);
        
        if (data.data) {
            if (data.data.proxy_used) {
                console.log(`🔒 Proxy Used: ${data.data.proxy_used}`);
            }
            if (data.status === 'ok') {
                console.log(`📄 Title: ${data.data.title || 'No title'}`);
                console.log(`📊 HTML Length: ${data.data.html?.length || 0} characters`);
            } else {
                console.log(`❌ Error: ${data.data.message}`);
                console.log(`🔍 Reason: ${data.data.reason}`);
            }
        }
        
        console.log(`💾 Data saved to: ${filename}`);
        
    } catch (error) {
        console.error(`❌ Test failed: ${error.message}`);
    }
}

async function runAllTests() {
    console.log('🚀 Starting Parser API Proxy Tests');
    console.log('===================================');
    
    // Check if server is running
    try {
        const healthCheck = await fetch(`${baseUrl}/`);
        if (!healthCheck.ok) {
            throw new Error('Server not responding');
        }
        console.log('✅ Server is running');
    } catch (error) {
        console.error('❌ Server is not running. Please start the server first with: npm run dev');
        process.exit(1);
    }
    
    // Run each test
    for (const config of testConfigs) {
        await runTest(config);
        // Wait between tests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n🎉 All tests completed!');
    console.log(`📁 Results saved in: ${dataDir}/`);
}

// Run the tests
runAllTests().catch(console.error);