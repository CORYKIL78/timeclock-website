/**
 * MongoDB Database Connection
 * Handles persistent storage for quotes
 */

const { MongoClient } = require('mongodb');

let client;
let db;
let quotesCollection;

async function connectDatabase() {
    try {
        const uri = process.env.MONGODB_URI;
        
        if (!uri) {
            console.log('⚠️  No MONGODB_URI found - using in-memory storage (data will be lost on restart)');
            return null;
        }

        client = new MongoClient(uri);
        await client.connect();
        
        db = client.db('discord_bot');
        quotesCollection = db.collection('quotes');
        
        // Create indexes
        await quotesCollection.createIndex({ id: 1 }, { unique: true });
        await quotesCollection.createIndex({ quoteNumber: 1 });
        await quotesCollection.createIndex({ status: 1 });
        
        console.log('✅ Connected to MongoDB');
        return db;
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        console.log('⚠️  Falling back to in-memory storage');
        return null;
    }
}

async function saveQuote(quote) {
    if (!quotesCollection) return;
    try {
        await quotesCollection.updateOne(
            { id: quote.id },
            { $set: quote },
            { upsert: true }
        );
    } catch (error) {
        console.error('Error saving quote:', error);
    }
}

async function getQuote(quoteId) {
    if (!quotesCollection) return null;
    try {
        return await quotesCollection.findOne({ id: quoteId });
    } catch (error) {
        console.error('Error getting quote:', error);
        return null;
    }
}

async function getAllQuotes() {
    if (!quotesCollection) return [];
    try {
        return await quotesCollection.find({}).toArray();
    } catch (error) {
        console.error('Error getting quotes:', error);
        return [];
    }
}

async function getQuoteCounter() {
    if (!quotesCollection) return 1;
    try {
        const result = await quotesCollection.find({}).sort({ quoteNumber: -1 }).limit(1).toArray();
        return result.length > 0 ? result[0].quoteNumber + 1 : 1;
    } catch (error) {
        console.error('Error getting counter:', error);
        return 1;
    }
}

async function closeDatabase() {
    if (client) {
        await client.close();
        console.log('📊 MongoDB connection closed');
    }
}

module.exports = {
    connectDatabase,
    saveQuote,
    getQuote,
    getAllQuotes,
    getQuoteCounter,
    closeDatabase
};
