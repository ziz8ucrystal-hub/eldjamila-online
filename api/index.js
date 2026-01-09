const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// ========== CONFIGURATION ==========
app.use(cors({ origin: '*' }));
app.use(express.json());

console.log('🚀 API El Djamila - Vercel SSL Fix');

// ========== MONGODB CONNECTION (VERCEL COMPATIBLE) ==========
let db = null;
let isConnecting = false;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://eldjamila-cluster:YueVW02QRkSSPyzT@ac-duaqchc-shard-00-00.cmsgoyg.mongodb.net:27017,ac-duaqchc-shard-00-01.cmsgoyg.mongodb.net:27017,ac-duaqchc-shard-00-02.cmsgoyg.mongodb.net:27017/eldjamila_db?ssl=true&replicaSet=atlas-an8c5f-shard-0&authSource=admin&retryWrites=true&w=majority';

const JWT_SECRET = process.env.JWT_SECRET || 'eldjamila-secret-2024';

async function connectDB() {
    if (db) return db;
    if (isConnecting) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return connectDB();
    }
    
    isConnecting = true;
    console.log('🔗 Connecting to MongoDB...');
    
    try {
        const safeURI = MONGODB_URI.replace(/:[^:@]*@/, ':****@');
        console.log('🌐 Using URI:', safeURI);
        
        const client = new MongoClient(MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000,
            maxPoolSize: 5,
            minPoolSize: 1,
            ssl: true,
            tls: true,
            tlsAllowInvalidCertificates: false,
            tlsAllowInvalidHostnames: false,
            retryWrites: true,
            w: 'majority'
        });
        
        await client.connect();
        console.log('✅ MongoDB Connected!');
        
        db = client.db('eldjamila_db');
        
        // Verify connection
        await db.command({ ping: 1 });
        console.log('✅ Database ping successful');
        
        // Create collections if they don't exist
        const collections = ['users', 'offers'];
        for (const collName of collections) {
            try {
                await db.createCollection(collName);
                console.log(`📁 Collection created: ${collName}`);
            } catch (err) {
                // Collection exists
            }
        }
        
        // Create index
        try {
            await db.collection('users').createIndex({ email: 1 }, { unique: true });
            console.log('🔑 Email index created');
        } catch (err) {
            // Index exists
        }
        
        isConnecting = false;
        return db;
        
    } catch (error) {
        isConnecting = false;
        console.error('❌ MongoDB Error:', error.message);
        
        if (error.message.includes('SSL') || error.message.includes('tls')) {
            console.error('🔧 SSL Error! Try this URI in Vercel:');
            console.error('mongodb://eldjamila-cluster:YueVW02QRkSSPyzT@ac-duaqchc-shard-00-00.cmsgoyg.mongodb.net:27017,ac-duaqchc-shard-00-01.cmsgoyg.mongodb.net:27017,ac-duaqchc-shard-00-02.cmsgoyg.mongodb.net:27017/eldjamila_db?ssl=true&replicaSet=atlas-an8c5f-shard-0&authSource=admin&retryWrites=true&w=majority');
        }
        
        throw error;
    }
}

// ========== MIDDLEWARE ==========
async function requireDB(req, res, next) {
    try {
        req.db = await connectDB();
        next();
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Database unavailable: ' + error.message 
        });
    }
}

// ========== ROUTES ==========

// 1. Health Check
app.get('/api/health', async (req, res) => {
    try {
        await connectDB();
        res.json({
            success: true,
            message: '✅ API El Djamila is running',
            database: 'connected',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'production'
        });
    } catch (error) {
        res.json({
            success: false,
            message: '⚠️ API running but database error: ' + error.message,
            database: 'disconnected',
            timestamp: new Date().toISOString()
        });
    }
});

// 2. Test Connection
app.get('/api/test-db', async (req, res) => {
    try {
        const database = await connectDB();
        const collections = await database.listCollections().toArray();
        
        res.json({
            success: true,
            message: 'MongoDB is working!',
            collections: collections.map(c => c.name),
            dbName: database.databaseName
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Database error: ' + error.message
        });
    }
});

// 3. Register User
app.post('/api/auth/register', requireDB, async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        if (!name || !email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'All fields are required' 
            });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ 
                success: false, 
                message: 'Password must be at least 6 characters' 
            });
        }
        
        // Check if user exists
        const existingUser = await req.db.collection('users').findOne({ email });
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email already registered' 
            });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const newUser = {
            name,
            email,
            passwordHash: hashedPassword,
            role: 'user',
            balance: 50,
            points: 50,
            createdAt: new Date(),
            isActive: true
        };
        
        const result = await req.db.collection('users').insertOne(newUser);
        
        // Generate token
        const token = jwt.sign(
            {
                userId: result.insertedId.toString(),
                email: email,
                role: 'user'
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        // Response
        res.json({
            success: true,
            message: 'Registration successful!',
            token,
            user: {
                id: result.insertedId,
                name,
                email,
                role: 'user',
                balance: 50,
                points: 50
            }
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Registration failed: ' + error.message 
        });
    }
});

// 4. Login User
app.post('/api/auth/login', requireDB, async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email and password required' 
            });
        }
        
        // Find user
        const user = await req.db.collection('users').findOne({ email });
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }
        
        // Verify password
        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }
        
        // Generate token
        const token = jwt.sign(
            {
                userId: user._id.toString(),
                email: user.email,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        // Response
        res.json({
            success: true,
            message: 'Login successful!',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                balance: user.balance || 0,
                points: user.points || 0
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Login failed: ' + error.message 
        });
    }
});

// 5. Get Offers
app.get('/api/offers', requireDB, async (req, res) => {
    try {
        const offers = await req.db.collection('offers')
            .find({ isActive: true })
            .sort({ createdAt: -1 })
            .toArray();
        
        // If no offers, create sample offers
        if (offers.length === 0) {
            const sampleOffers = [
                {
                    title: 'Evening Hairstyle',
                    description: 'For special occasions',
                    price: 45,
                    originalPrice: 60,
                    isActive: true,
                    createdAt: new Date()
                },
                {
                    title: 'Haircut & Blow-dry',
                    description: 'Complete service',
                    price: 35,
                    originalPrice: 45,
                    isActive: true,
                    createdAt: new Date()
                }
            ];
            
            await req.db.collection('offers').insertMany(sampleOffers);
            const newOffers = await req.db.collection('offers').find().toArray();
            return res.json({ success: true, offers: newOffers });
        }
        
        res.json({ success: true, offers });
        
    } catch (error) {
        console.error('Offers error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to load offers' 
        });
    }
});

// 6. Create Offer
app.post('/api/offers', requireDB, async (req, res) => {
    try {
        const { title, description, price } = req.body;
        
        if (!title || !price) {
            return res.status(400).json({ 
                success: false, 
                message: 'Title and price required' 
            });
        }
        
        const newOffer = {
            title,
            description: description || '',
            price: Number(price),
            isActive: true,
            createdAt: new Date()
        };
        
        const result = await req.db.collection('offers').insertOne(newOffer);
        
        res.json({
            success: true,
            message: 'Offer created',
            offer: { ...newOffer, _id: result.insertedId }
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create offer' 
        });
    }
});

// 7. Simple Test
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'API is working correctly!',
        timestamp: new Date().toISOString()
    });
});

// 8. Get Users (for testing)
app.get('/api/users', requireDB, async (req, res) => {
    try {
        const users = await req.db.collection('users')
            .find({}, { projection: { passwordHash: 0 } })
            .toArray();
        
        res.json({ success: true, users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== ERROR HANDLING ==========
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found: ' + req.url
    });
});

app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// ========== EXPORT FOR VERCEL ==========
module.exports = app;