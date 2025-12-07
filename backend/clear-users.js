require('dotenv').config();
const mongoose = require('mongoose');

async function clearUsers() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/GA03_React_Authentication';
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected');

    const db = mongoose.connection.db;
    const result = await db.collection('users').deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} users`);
    
    await mongoose.connection.close();
    console.log('✅ Done');
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

clearUsers();
