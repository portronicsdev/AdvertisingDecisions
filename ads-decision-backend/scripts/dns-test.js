const dns = require('dns');

const hostname = 'db.tiwfzhgmtemfrojupdnl.supabase.co';

console.log(`Testing DNS resolution for: ${hostname}\n`);

// Test with default DNS
console.log('1. Testing with default DNS servers...');
dns.resolve4(hostname, (err, addresses) => {
    if (err) {
        console.error(`   ❌ Failed: ${err.message}`);
    } else {
        console.log(`   ✅ Resolved to: ${addresses.join(', ')}`);
    }
    
    // Test with Google DNS
    console.log('\n2. Testing with Google DNS (8.8.8.8)...');
    dns.setServers(['8.8.8.8', '8.8.4.4']);
    dns.resolve4(hostname, (err2, addresses2) => {
        if (err2) {
            console.error(`   ❌ Failed: ${err2.message}`);
        } else {
            console.log(`   ✅ Resolved to: ${addresses2.join(', ')}`);
        }
        
        // Test with Cloudflare DNS
        console.log('\n3. Testing with Cloudflare DNS (1.1.1.1)...');
        dns.setServers(['1.1.1.1', '1.0.0.1']);
        dns.resolve4(hostname, (err3, addresses3) => {
            if (err3) {
                console.error(`   ❌ Failed: ${err3.message}`);
            } else {
                console.log(`   ✅ Resolved to: ${addresses3.join(', ')}`);
            }
            
            console.log('\n💡 If all DNS tests fail:');
            console.log('   - Check your internet connection');
            console.log('   - Try changing your DNS settings to 8.8.8.8 or 1.1.1.1');
            console.log('   - Check if firewall/proxy is blocking DNS queries');
            console.log('   - Try using a VPN or different network');
        });
    });
});

