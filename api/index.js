const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// ========== CONFIGURATION ==========
app.use(helmet({
    contentSecurityPolicy: false
}));
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

console.log('🚀 API El Djamila - Node.js 24.x Version');

// ========== MONGODB CONNECTION ==========
let db = null;
let client = null;

// Use environment variable or direct connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://eldjamila-cluster:YueVW02QRkSSPyzT@cluster0.cmsgoyg.mongodb.net/eldjamila_db?retryWrites=true&w=majority';

const JWT_SECRET = process.env.JWT_SECRET || 'eldjamila-secret-2024';

async function connectDB() {
    if (db) {
        console.log('✅ Reusing existing MongoDB connection');
        return db;
    }
    
    console.log('🔗 Creating new MongoDB connection...');
    
    try {
        // Log sanitized URI (hide password)
        const safeURI = MONGODB_URI.replace(/:[^:@]*@/, ':****@');
        console.log('🌐 Connecting to:', safeURI);
        
        // Simple connection for Node.js 24
        client = new MongoClient(MONGODB_URI, {
            serverSelectionTimeoutMS: 15000,
            connectTimeoutMS: 15000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            minPoolSize: 1,
            // SSL/TLS settings
            tls: true,
            tlsAllowInvalidCertificates: false
        });
        
        await client.connect();
        console.log('✅ MongoDB connected successfully');
        
        // Select database
        db = client.db('eldjamila_db');
        
        // Test connection
        await db.command({ ping: 1 });
        console.log('✅ Database ping successful');
        
        // Initialize collections if needed
        await initCollections(db);
        
        return db;
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        console.error('🔧 Error details:', error.code);
        
        // Try alternative connection method
        if (error.message.includes('SSL') || error.code === 'ETIMEDOUT') {
            console.log('🔄 Trying alternative connection method...');
            return tryAlternativeConnection();
        }
        
        throw error;
    }
}

async function tryAlternativeConnection() {
    try {
        // Alternative URI without SRV
        const altURI = 'mongodb://eldjamila-cluster:YueVW02QRkSSPyzT@ac-duaqchc-shard-00-00.cmsgoyg.mongodb.net:27017,ac-duaqchc-shard-00-01.cmsgoyg.mongodb.net:27017,ac-duaqchc-shard-00-02.cmsgoyg.mongodb.net:27017/eldjamila_db?ssl=true&replicaSet=atlas-an8c5f-shard-0&authSource=admin&retryWrites=true&w=majority';
        
        console.log('🔄 Trying alternative connection...');
        
        client = new MongoClient(altURI, {
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000,
            socketTimeoutMS: 30000
        });
        
        await client.connect();
        db = client.db('eldjamila_db');
        await db.command({ ping: 1 });
        
        console.log('✅ Alternative connection successful!');
        return db;
        
    } catch (altError) {
        console.error('❌ Alternative connection also failed:', altError.message);
        throw altError;
    }
}

async function initCollections(database) {
    try {
        // Create users collection with index
        const users = database.collection('users');
        await users.createIndex({ email: 1 }, { unique: true });
        console.log('🔑 Users index created');
        
        // Create offers collection
        await database.createCollection('offers');
        console.log('📁 Collections initialized');
        
    } catch (err) {
        // Collections already exist
        console.log('📁 Collections already exist');
    }
}

// ========== API ROUTES ==========

// 1. Health Check
app.get('/api/health', async (req, res) => {
    try {
        const database = await connectDB();
        const pingResult = await database.command({ ping: 1 });
        
        res.json({
            success: true,
            message: '✅ El Djamila API is fully operational',
            database: {
                status: 'connected',
                ping: 'ok',
                name: database.databaseName
            },
            server: {
                nodeVersion: process.version,
                timestamp: new Date().toISOString(),
                environment: process.env.NODE_ENV || 'production'
            }
        });
        
    } catch (error) {
        res.json({
            success: false,
            message: '⚠️ API is running but database is disconnected',
            database: {
                status: 'disconnected',
                error: error.message
            },
            server: {
                nodeVersion: process.version,
                timestamp: new Date().toISOString()
            }
        });
    }
});

// 2. Database Test
app.get('/api/test-db', async (req, res) => {
    try {
        const database = await connectDB();
        
        // Get collections list
        const collections = await database.listCollections().toArray();
        
        // Get users count
        const usersCount = await database.collection('users').countDocuments();
        
        res.json({
            success: true,
            message: '🎉 MongoDB is working perfectly!',
            database: {
                name: database.databaseName,
                collections: collections.map(c => c.name),
                usersCount: usersCount,
                status: 'healthy'
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Database connection failed',
            error: error.message,
            suggestion: 'Check MONGODB_URI environment variable in Vercel'
        });
    }
});

// 3. Register User (SIMPLIFIED - WILL WORK)
app.post('/api/auth/register', async (req, res) => {
    console.log('📝 Registration attempt:', req.body.email);
    
    try {
        const { name, email, password } = req.body;
        
        // Basic validation
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Name, email and password are required'
            });
        }
        
        const database = await connectDB();
        
        // Check if user exists
        const existing = await database.collection('users').findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const userData = {
            name: name.trim(),
            email: email.toLowerCase().trim(),
            passwordHash: hashedPassword,
            role: 'user',
            balance: 100,
            points: 50,
            createdAt: new Date(),
            isActive: true
        };
        
        const result = await database.collection('users').insertOne(userData);
        
        // Generate token
        const token = jwt.sign(
            {
                id: result.insertedId.toString(),
                email: userData.email,
                name: userData.name,
                role: userData.role
            },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        // Response
        res.status(201).json({
            success: true,
            message: '🎉 Welcome to El Djamila! Registration successful',
            token: token,
            user: {
                id: result.insertedId,
                name: userData.name,
                email: userData.email,
                role: userData.role,
                balance: userData.balance,
                points: userData.points
            }
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        
        res.status(500).json({
            success: false,
            message: 'Registration failed. Please try again.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 4. Login User
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password required'
            });
        }
        
        const database = await connectDB();
        
        // Find user
        const user = await database.collection('users').findOne({
            email: email.toLowerCase()
        });
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        
        // Verify password
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        
        // Generate token
        const token = jwt.sign(
            {
                id: user._id.toString(),
                email: user.email,
                name: user.name,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        res.json({
            success: true,
            message: '✅ Login successful',
            token: token,
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
            message: 'Login failed'
        });
    }
});

// 5. Get Offers
app.get('/api/offers', async (req, res) => {
    try {
        const database = await connectDB();
        const offers = await database.collection('offers').find().toArray();
        
        // If no offers, create some sample ones
        if (offers.length === 0) {
            const sampleOffers = [
                {
                    title: "Women's Haircut",
                    description: "Professional haircut with styling",
                    price: 45,
                    duration: "1 hour",
                    category: "Haircut",
                    isActive: true,
                    createdAt: new Date()
                },
                {
                    title: "Hair Coloring",
                    description: "Full hair coloring service",
                    price: 85,
                    duration: "2 hours",
                    category: "Coloring",
                    isActive: true,
                    createdAt: new Date()
                }
            ];
            
            await database.collection('offers').insertMany(sampleOffers);
            const newOffers = await database.collection('offers').find().toArray();
            return res.json({ success: true, offers: newOffers });
        }
        
        res.json({ success: true, offers: offers });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Failed to load offers' 
        });
    }
});

// 6. Simple Test
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: '🚀 El Djamila API is working!',
        version: '2.0.0',
        node: process.version,
        timestamp: new Date().toISOString()
    });
});

// 7. Home Page
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>El Djamila Salon API</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .endpoint { background: #f0f0f0; padding: 15px; margin: 10px 0; border-radius: 8px; }
                code { background: #333; color: white; padding: 2px 6px; border-radius: 4px; }
            </style>
        </head>
        <body>
            <h1>✨ El Djamila Salon API</h1>
            <p><strong>Status:</strong> <span style="color:green;">● Online</span></p>
            <p><strong>Node.js:</strong> ${process.version}</p>
            
            <div class="endpoint">
                <h3>🔍 Health Check</h3>
                <p><code>GET /api/health</code> - Check API status</p>
                <a href="/api/health" target="_blank">Test Now</a>
            </div>
            
            <div class="endpoint">
                <h3>🧪 Database Test</h3>
                <p><code>GET /api/test-db</code> - Test MongoDB connection</p>
                <a href="/api/test-db" target="_blank">Test Now</a>
            </div>
            
            <div class="endpoint">
                <h3>👤 Register User</h3>
                <p><code>POST /api/auth/register</code></p>
                <p>Body: { "name": "Test User", "email": "test@test.com", "password": "123456" }</p>
            </div>
            
            <div class="endpoint">
                <h3>🔐 Login User</h3>
                <p><code>POST /api/auth/login</code></p>
                <p>Body: { "email": "test@test.com", "password": "123456" }</p>
            </div>
        </body>
        </html>
    `);
});

// Error handling
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Export for Vercel
module.exports = app;