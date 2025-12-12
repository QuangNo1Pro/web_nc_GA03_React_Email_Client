/**
 * Test script to verify IMAP connection with Gmail
 * 
 * To test IMAP login with Gmail:
 * 1. Enable 2-factor authentication in your Google account
 * 2. Generate an App Password:
 *    - Go to: https://myaccount.google.com/apppasswords
 *    - Select "Mail" and your device
 *    - Copy the generated 16-character password
 * 3. Run this script: node test-imap-gmail.js
 */

const Imap = require('imap-simple');

// CONFIGURATION - Replace with your Gmail credentials
const config = {
  imap: {
    user: 'your-email@gmail.com',  // ← Replace with your Gmail address
    password: 'your-app-password',  // ← Replace with your App Password (16 characters, no spaces)
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
    authTimeout: 10000,
    connTimeout: 10000,
  }
};

async function testImapConnection() {
  console.log('🔄 Testing IMAP connection to Gmail...\n');
  console.log('Configuration:');
  console.log('  Email:', config.imap.user);
  console.log('  Host:', config.imap.host);
  console.log('  Port:', config.imap.port);
  console.log('  TLS:', config.imap.tls);
  console.log('\n⏳ Connecting...\n');

  try {
    // Test connection
    const connection = await Imap.connect(config);
    console.log('✅ Successfully connected to Gmail IMAP!\n');

    // Get mailboxes
    console.log('📬 Fetching mailboxes...');
    const boxes = await connection.getBoxes();
    console.log('✅ Found mailboxes:');
    
    const flattenBoxes = (boxesObj, prefix = '', depth = 0) => {
      for (const [name, box] of Object.entries(boxesObj)) {
        const indent = '  '.repeat(depth);
        const hasChildren = box.children && Object.keys(box.children).length > 0;
        const icon = hasChildren ? '📁' : '📄';
        console.log(`${indent}${icon} ${name}`);
        
        if (hasChildren) {
          flattenBoxes(box.children, `${prefix}${name}${box.delimiter}`, depth + 1);
        }
      }
    };
    
    flattenBoxes(boxes);

    // Open INBOX and count messages
    console.log('\n📨 Opening INBOX...');
    await connection.openBox('INBOX');
    const searchResults = await connection.search(['ALL'], {});
    console.log(`✅ Found ${searchResults.length} messages in INBOX\n`);

    // Close connection
    await connection.end();
    console.log('✅ Connection closed successfully\n');
    
    console.log('🎉 IMAP test completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Update the Login.tsx form with your email');
    console.log('   2. Use your App Password (not your regular password)');
    console.log('   3. The backend will automatically detect Gmail settings');
    
  } catch (error) {
    console.error('\n❌ IMAP connection failed!');
    console.error('Error:', error.message);
    console.error('\n🔍 Common issues:');
    console.error('   1. Make sure you\'re using an App Password, not your regular password');
    console.error('   2. Enable 2-factor authentication first');
    console.error('   3. Generate App Password at: https://myaccount.google.com/apppasswords');
    console.error('   4. Check if "Less secure app access" is enabled (legacy accounts)');
    console.error('\nFull error:', error);
  }
}

// Run the test
testImapConnection();
