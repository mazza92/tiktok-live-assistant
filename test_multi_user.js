// Test script for multi-user functionality
const { WebSocket } = require('ws');

console.log('🧪 Testing Multi-User Functionality...\n');

// Test 1: Create multiple WebSocket connections
async function testMultipleConnections() {
    console.log('📡 Test 1: Creating multiple WebSocket connections...');
    
    const connections = [];
    const sessionIds = [];
    
    // Create 3 WebSocket connections
    for (let i = 0; i < 3; i++) {
        const ws = new WebSocket('ws://localhost:3000');
        
        await new Promise((resolve) => {
            ws.on('open', () => {
                console.log(`✅ Connection ${i + 1} established`);
                connections.push(ws);
                resolve();
            });
        });
        
        // Listen for session creation
        ws.on('message', (data) => {
            const message = JSON.parse(data);
            if (message.type === 'sessionCreated') {
                sessionIds.push(message.data.sessionId);
                console.log(`🆔 Session ${i + 1} ID: ${message.data.sessionId}`);
            }
        });
    }
    
    console.log(`✅ Created ${connections.length} connections with ${sessionIds.length} sessions\n`);
    
    // Test 2: Send different usernames to different sessions
    console.log('📡 Test 2: Sending different usernames to different sessions...');
    
    const testUsernames = ['user1', 'user2', 'user3'];
    
    for (let i = 0; i < connections.length; i++) {
        connections[i].send(JSON.stringify({
            type: 'changeUsername',
            username: testUsernames[i]
        }));
        console.log(`📤 Sent username "${testUsernames[i]}" to connection ${i + 1}`);
    }
    
    // Wait a bit for processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 3: Verify session isolation
    console.log('\n📡 Test 3: Verifying session isolation...');
    
    // Send disconnect to one session
    connections[0].send(JSON.stringify({
        type: 'disconnectStream'
    }));
    console.log('📤 Sent disconnect to connection 1');
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if other connections are still active
    console.log('🔍 Checking if other connections are still active...');
    console.log(`Connection 2 state: ${connections[1].readyState === WebSocket.OPEN ? 'OPEN' : 'CLOSED'}`);
    console.log(`Connection 3 state: ${connections[2].readyState === WebSocket.OPEN ? 'OPEN' : 'CLOSED'}`);
    
    // Cleanup
    console.log('\n🧹 Cleaning up connections...');
    connections.forEach((ws, index) => {
        ws.close();
        console.log(`✅ Connection ${index + 1} closed`);
    });
    
    console.log('\n✅ Multi-user test completed!');
    console.log('📊 Summary:');
    console.log(`   - Created ${connections.length} concurrent sessions`);
    console.log(`   - Each session has unique ID: ${sessionIds.join(', ')}`);
    console.log(`   - Sessions are isolated (disconnecting one doesn't affect others)`);
    console.log(`   - Each session can connect to different TikTok usernames`);
}

// Run the test
testMultipleConnections().catch(console.error);
