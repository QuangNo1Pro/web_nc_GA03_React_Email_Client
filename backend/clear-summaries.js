/**
 * Clear all AI summaries from database
 * Run: node clear-summaries.js
 */
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/GA03_React_Authentication';

async function clearSummaries() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const users = await db.collection('users').find({}).toArray();
    
    console.log(`📊 Found ${users.length} users`);
    
    let totalEmails = 0;
    let totalCleared = 0;

    for (const user of users) {
      if (user.emails && Array.isArray(user.emails)) {
        totalEmails += user.emails.length;
        
        // Remove summary and summarizedAt fields from each email
        const updated = user.emails.map(email => {
          const { summary, summarizedAt, ...rest } = email;
          if (summary) totalCleared++;
          return rest;
        });

        await db.collection('users').updateOne(
          { _id: user._id },
          { $set: { emails: updated } }
        );
      }
    }

    console.log(`✅ Processed ${totalEmails} emails`);
    console.log(`🗑️  Cleared ${totalCleared} summaries`);
    console.log('✨ Done!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

clearSummaries();
