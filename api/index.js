const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { MongoClient, ServerApiVersion } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// ========== MIDDLEWARE ==========
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

console.log('🚀 API El Djamila - Node.js 20.x Version');

// ========== MONGODB CONNECTION FOR NODE 20 ==========
let db = null;
let client = null;

// IMPORTANT: Use this exact URI for Vercel
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://eldjamila-cluster:YueVW02QRkSSPyzT@cluster0.cmsgoyg.mongodb.net/eldjamila_db?retryWrites=true&w=majority';

const JWT_SECRET = process.env.JWT_SECRET || 'eldjamila-secret-2024';

async function connectDB() {
    if (db) {
        console.log('✅ Using existing MongoDB connection');
        return db;
    }
    
    console.log('🔗 Establishing MongoDB connection...');
    
    try {
        // Log sanitized URI
        const safeURI = MONGODB_URI.replace(/:[^:@]*@/, ':****@');
        console.log('🌐 MongoDB URI:', safeURI);
        
        // MongoDB 6.x connection for Node.js 20
        client = new MongoClient(MONGODB_URI, {
            serverApi: {
                version: ServerApiVersion.v1,
                strict: true,
                deprecationErrors: true,
            },
            serverSelectionTimeoutMS: 15000,
            connectTimeoutMS: 15000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            minPoolSize: 1,
            // SSL configuration for Vercel
            tls: true,
            tlsAllowInvalidCertificates: false,
            tlsAllowInvalidHostnames: false,
        });
        
        await client.connect();
        console.log('✅ MongoDB connected successfully');
        
        // Test the connection
        db = client.db('eldjamila_db');
        await db.command({ ping: 1 });
        console.log('✅ Database ping successful');
        
        // Create collections if they don't exist
        await initializeCollections(db);
        
        return db;
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        
        // Provide helpful error messages
        if (error.message.includes('SSL') || error.message.includes('tls')) {
            console.error('🔧 SSL Issue Detected! Try:');
            console.error('1. Add IP 0.0.0.0/0 to MongoDB Atlas Network Access');
            console.error('2. Use direct connection string:');
            console.error('mongodb://eldjamila-cluster:YueVW02QRkSSPyzT@ac-duaqchc-shard-00-00.cmsgoyg.mongodb.net:27017,ac-duaqchc-shard-00-01.cmsgoyg.mongodb.net:27017,ac-duaqchc-shard-00-02.cmsgoyg.mongodb.net:27017/eldjamila_db?ssl=true&replicaSet=atlas-an8c5f-shard-0&authSource=admin&retryWrites=true&w=majority');
        }
        
        if (error.message.includes('auth failed')) {
            console.error('🔧 Authentication Failed! Check:');
            console.error('1. Password in MONGODB_URI is correct');
            console.error('2. User "eldjamila-cluster" exists in MongoDB Atlas');
        }
        
        throw error;
    }
}

async function initializeCollections(database) {
    const collections = ['users', 'offers', 'bookings'];
    
    for (const collName of collections) {
        try {
            await database.createCollection(collName);
            console.log(`📁 Collection created: ${collName}`);
        } catch (err) {
            // Collection already exists
        }
    }
    
    // Create indexes
    try {
        await database.collection('users').createIndex({ email: 1 }, { unique: true });
        console.log('🔑 Unique index created on users.email');
    } catch (err) {
        // Index already exists
    }
}

// ========== API ROUTES ==========

// 1. Health Check
app.get('/api/health', async (req, res) => {
    try {
        const database = await connectDB();
        await database.command({ ping: 1 });
        
        res.json({
            success: true,
            message: '✅ API El Djamila is running',
            database: 'connected',
            timestamp: new Date().toISOString(),
            nodeVersion: process.version,
            environment: process.env.NODE_ENV || 'production'
        });
    } catch (error) {
        res.json({
            success: false,
            message: '⚠️ API running but MongoDB error: ' + error.message,
            database: 'disconnected',
            timestamp: new Date().toISOString(),
            nodeVersion: process.version
        });
    }
});

// 2. Database Test
app.get('/api/test-db', async (req, res) => {
    try {
        const database = await connectDB();
        const collections = await database.listCollections().toArray();
        
        res.json({
            success: true,
            message: '✅ MongoDB is working perfectly!',
            database: database.databaseName,
            collections: collections.map(c => c.name),
            serverInfo: await database.command({ serverStatus: 1 })
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '❌ Database error: ' + error.message,
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// 3. Register User
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, and password are required'
            });
        }
        
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }
        
        const database = await connectDB();
        
        // Check if user exists
        const existingUser = await database.collection('users').findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email is already registered'
            });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user document
        const userDocument = {
            name: name.trim(),
            email: email.toLowerCase().trim(),
            passwordHash: hashedPassword,
            role: 'user',
            balance: 100, // Starting balance
            points: 50,   // Starting points
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true,
            lastLogin: null
        };
        
        // Insert user
        const result = await database.collection('users').insertOne(userDocument);
        
        // Generate JWT token
        const token = jwt.sign(
            {
                userId: result.insertedId.toString(),
                email: userDocument.email,
                role: userDocument.role,
                name: userDocument.name
            },
            JWT_SECRET,
            { expiresIn: '30d' } // 30 days expiration
        );
        
        // Successful response
        res.status(201).json({
            success: true,
            message: '🎉 Registration successful! Welcome to El Djamila',
            token: token,
            user: {
                id: result.insertedId,
                name: userDocument.name,
                email: userDocument.email,
                role: userDocument.role,
                balance: userDocument.balance,
                points: userDocument.points,
                createdAt: userDocument.createdAt
            }
        });
        
    } catch (error) {
        console.error('❌ Registration error:', error);
        
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
                message: 'Email and password are required'
            });
        }
        
        const database = await connectDB();
        
        // Find user
        const user = await database.collection('users').findOne({
            email: email.toLowerCase().trim()
        });
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }
        
        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.passwordHash);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }
        
        // Update last login
        await database.collection('users').updateOne(
            { _id: user._id },
            { $set: { lastLogin: new Date() } }
        );
        
        // Generate token
        const token = jwt.sign(
            {
                userId: user._id.toString(),
                email: user.email,
                role: user.role,
                name: user.name
            },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        // Response
        res.json({
            success: true,
            message: '✅ Login successful!',
            token: token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                balance: user.balance || 0,
                points: user.points || 0,
                lastLogin: new Date()
            }
        });
        
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed. Please try again.'
        });
    }
});

// 5. Get Offers
app.get('/api/offers', async (req, res) => {
    try {
        const database = await connectDB();
        const offers = await database.collection('offers')
            .find({ isActive: true })
            .sort({ createdAt: -1 })
            .limit(50)
            .toArray();
        
        res.json({
            success: true,
            count: offers.length,
            offers: offers
        });
        
    } catch (error) {
        console.error('❌ Offers error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load offers'
        });
    }
});

// 6. Create Sample Offer
app.post('/api/offers/sample', async (req, res) => {
    try {
        const database = await connectDB();
        
        const sampleOffer = {
            title: 'Premium Hair Styling',
            description: 'Professional hair styling for special occasions',
            price: 75,
            originalPrice: 100,
            duration: '2 hours',
            category: 'Styling',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        const result = await database.collection('offers').insertOne(sampleOffer);
        
        res.json({
            success: true,
            message: 'Sample offer created',
            offer: { ...sampleOffer, _id: result.insertedId }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to create sample offer'
        });
    }
});

// 7. Simple Test Route
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: '🚀 El Djamila API is fully operational!',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'production'
    });
});

// 8. Get Users (Admin only - for testing)
app.get('/api/users', async (req, res) => {
    try {
        const database = await connectDB();
        const users = await database.collection('users')
            .find({}, { projection: { passwordHash: 0 } })
            .sort({ createdAt: -1 })
            .toArray();
        
        res.json({
            success: true,
            count: users.length,
            users: users
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to load users'
        });
    }
});

// 9. Home Page
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>El Djamila API</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                .card { background: #f8f9fa; padding: 20px; margin: 15px 0; border-radius: 10px; }
                .success { color: #28a745; }
                .error { color: #dc3545; }
                code { background: #e9ecef; padding: 2px 6px; border-radius: 4px; }
            </style>
        </head>
        <body>
            <h1>✨ El Djamila Salon API</h1>
            <p>Welcome to the backend API for El Djamila Salon de Coiffure</p>
            
            <div class="card">
                <h3>🔍 Health Check</h3>
                <p>Check API status: <code><a href="/api/health">/api/health</a></code></p>
            </div>
            
            <div class="card">
                <h3>🧪 Test Database</h3>
                <p>Test MongoDB connection: <code><a href="/api/test-db">/api/test-db</a></code></p>
            </div>
            
            <div class="card">
                <h3>📋 API Test</h3>
                <p>Simple API test: <code><a href="/api/test">/api/test</a></code></p>
            </div>
            
            <div class="card">
                <h3>👤 User Registration</h3>
                <p><strong>POST</strong> <code>/api/auth/register</code></p>
                <p>Body: { "name": "...", "email": "...", "password": "..." }</p>
            </div>
            
            <div class="card">
                <h3>🔐 User Login</h3>
                <p><strong>POST</strong> <code>/api/auth/login</code></p>
                <p>Body: { "email": "...", "password": "..." }</p>
            </div>
            
            <hr>
            <p><strong>Status:</strong> <span class="success">●</span> API Running</p>
            <p><strong>Node.js:</strong> ${process.version}</p>
            <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'production'}</p>
        </body>
        </html>
    `);
});

// ========== ERROR HANDLERS ==========
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.url}`,
        availableRoutes: [
            'GET  /',
            'GET  /api/health',
            'GET  /api/test-db',
            'GET  /api/test',
            'POST /api/auth/register',
            'POST /api/auth/login',
            'GET  /api/offers',
            'POST /api/offers/sample'
        ]
    });
});

app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error occurred',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 3000;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
        console.log(`🌐 Environment: ${process.env.NODE_ENV || 'production'}`);
        console.log(`⚡ Node.js: ${process.version}`);
    });
}

module.exports = app;