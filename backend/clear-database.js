/**
 * Script to clear emails and mailboxes collections from MongoDB
 * Run with: node clear-database.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function clearDatabase() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found in .env file');
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Get database
    const db = mongoose.connection.db;

    // Clear emails collection
    console.log('\n🗑️  Clearing emails collection...');
    const emailsResult = await db.collection('emails').deleteMany({});
    console.log(`✅ Deleted ${emailsResult.deletedCount} emails`);

    // Clear mailboxes collection
    console.log('\n🗑️  Clearing mailboxes collection...');
    const mailboxesResult = await db.collection('mailboxes').deleteMany({});
    console.log(`✅ Deleted ${mailboxesResult.deletedCount} mailboxes`);

    // Reset lastHistoryId in users collection
    console.log('\n🔄 Resetting lastHistoryId in users collection...');
    const usersResult = await db.collection('users').updateMany(
      {},
      { $unset: { lastHistoryId: "" } }
    );
    console.log(`✅ Reset lastHistoryId for ${usersResult.modifiedCount} users`);

    console.log('\n✅ Database cleared successfully!');
    console.log('\n📌 Next steps:');
    console.log('   1. Restart your backend server');
    console.log('   2. Login to your application');
    console.log('   3. The system will automatically fetch all emails from Gmail');

  } catch (error) {
    console.error('❌ Error clearing database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

clearDatabase();
