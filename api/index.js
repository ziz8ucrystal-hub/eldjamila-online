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

console.log('🚀 API El Djamila - No SSL Version');

// ========== MONGODB CONNECTION WITHOUT SSL ==========
let db = null;

// IMPORTANT: Use this NO-SSL URI for Vercel
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://eldjamila-cluster:YueVW02QRkSSPyzT@ac-duaqchc-shard-00-00.cmsgoyg.mongodb.net:27017,ac-duaqchc-shard-00-01.cmsgoyg.mongodb.net:27017,ac-duaqchc-shard-00-02.cmsgoyg.mongodb.net:27017/eldjamila_db?replicaSet=atlas-an8c5f-shard-0&authSource=admin&retryWrites=true&w=majority&ssl=false&tls=false';

const JWT_SECRET = process.env.JWT_SECRET || 'eldjamila-secret-2024';

async function connectDB() {
    if (db) {
        console.log('✅ Using existing MongoDB connection');
        return db;
    }
    
    console.log('🔗 Connecting to MongoDB (No SSL)...');
    
    try {
        // Hide password in logs
        const safeURI = MONGODB_URI.replace(/:[^:@]*@/, ':****@');
        console.log('🌐 Using URI:', safeURI);
        
        // Connection WITHOUT SSL for Vercel compatibility
        const client = new MongoClient(MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000,
            socketTimeoutMS: 30000,
            maxPoolSize: 5,
            minPoolSize: 1,
            ssl: false,      // ⬅️ IMPORTANT: Disable SSL
            tls: false,      // ⬅️ IMPORTANT: Disable TLS
            directConnection: false,
            retryWrites: true,
            w: 'majority'
        });
        
        await client.connect();
        console.log('✅ MongoDB connected successfully!');
        
        db = client.db('eldjamila_db');
        
        // Test connection
        await db.command({ ping: 1 });
        console.log('✅ Database ping successful');
        
        // Initialize collections
        await initCollections(db);
        
        return db;
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        console.error('🔧 Error code:', error.code);
        
        throw error;
    }
}

async function initCollections(database) {
    try {
        // Create users collection if not exists
        const collections = await database.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        if (!collectionNames.includes('users')) {
            await database.createCollection('users');
            console.log('📁 Created users collection');
            
            // Create unique index on email
            await database.collection('users').createIndex({ email: 1 }, { unique: true });
            console.log('🔑 Created unique index on email');
        }
        
        if (!collectionNames.includes('offers')) {
            await database.createCollection('offers');
            console.log('📁 Created offers collection');
        }
        
    } catch (err) {
        console.log('📁 Collections already exist');
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
            message: '✅ El Djamila API is fully operational',
            database: {
                status: 'connected',
                name: database.databaseName,
                ssl: 'disabled (Vercel compatibility)'
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
                error: error.message,
                suggestion: 'Check MONGODB_URI in Vercel Environment Variables'
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
        
        // Get collections
        const collections = await database.listCollections().toArray();
        
        // Get users count
        const usersCount = await database.collection('users').countDocuments();
        
        res.json({
            success: true,
            message: '🎉 MongoDB is working perfectly! (No SSL)',
            database: {
                name: database.databaseName,
                collections: collections.map(c => c.name),
                usersCount: usersCount,
                connection: 'no-ssl'
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Database connection failed',
            error: error.message,
            solution: 'Use this URI in Vercel: mongodb://eldjamila-cluster:YueVW02QRkSSPyzT@ac-duaqchc-shard-00-00.cmsgoyg.mongodb.net:27017,ac-duaqchc-shard-00-01.cmsgoyg.mongodb.net:27017,ac-duaqchc-shard-00-02.cmsgoyg.mongodb.net:27017/eldjamila_db?replicaSet=atlas-an8c5f-shard-0&authSource=admin&retryWrites=true&w=majority&ssl=false&tls=false'
        });
    }
});

// 3. Register User (WILL WORK NOW)
app.post('/api/auth/register', async (req, res) => {
    console.log('📝 Registration request received');
    
    try {
        const { name, email, password } = req.body;
        
        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Name, email and password are required'
            });
        }
        
        const database = await connectDB();
        console.log('✅ Database connected for registration');
        
        // Check if user exists
        const existingUser = await database.collection('users').findOne({ 
            email: email.toLowerCase().trim() 
        });
        
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email is already registered'
            });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user object
        const userData = {
            name: name.trim(),
            email: email.toLowerCase().trim(),
            passwordHash: hashedPassword,
            role: 'user',
            balance: 100,
            points: 50,
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true
        };
        
        // Insert user
        const result = await database.collection('users').insertOne(userData);
        console.log('✅ User inserted with ID:', result.insertedId);
        
        // Generate JWT token
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
        
        // Success response
        res.status(201).json({
            success: true,
            message: '🎉 Registration successful! Welcome to El Djamila',
            token: token,
            user: {
                id: result.insertedId,
                name: userData.name,
                email: userData.email,
                role: userData.role,
                balance: userData.balance,
                points: userData.points,
                createdAt: userData.createdAt
            }
        });
        
    } catch (error) {
        console.error('❌ Registration error:', error.message);
        
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
                id: user._id.toString(),
                email: user.email,
                name: user.name,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        // Success response
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
        console.error('Login error:', error);
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
            .toArray();
        
        // If no offers, create sample ones
        if (offers.length === 0) {
            const sampleOffers = [
                {
                    title: "Women's Haircut",
                    description: "Professional haircut with styling",
                    price: 45,
                    originalPrice: 60,
                    duration: "1 hour",
                    category: "Haircut",
                    isActive: true,
                    createdAt: new Date()
                },
                {
                    title: "Hair Coloring",
                    description: "Full hair coloring service",
                    price: 85,
                    originalPrice: 120,
                    duration: "2 hours",
                    category: "Coloring",
                    isActive: true,
                    createdAt: new Date()
                },
                {
                    title: "Hair Treatment",
                    description: "Deep conditioning treatment",
                    price: 60,
                    originalPrice: 80,
                    duration: "1.5 hours",
                    category: "Treatment",
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

// 6. Create Offer
app.post('/api/offers', async (req, res) => {
    try {
        const { title, description, price } = req.body;
        
        if (!title || !price) {
            return res.status(400).json({
                success: false,
                message: 'Title and price are required'
            });
        }
        
        const database = await connectDB();
        
        const newOffer = {
            title: title.trim(),
            description: description || '',
            price: Number(price),
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        const result = await database.collection('offers').insertOne(newOffer);
        
        res.json({
            success: true,
            message: 'Offer created successfully',
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
        message: '🚀 El Djamila API is working! (No SSL Mode)',
        version: '3.0.0',
        node: process.version,
        timestamp: new Date().toISOString(),
        note: 'Using MongoDB without SSL for Vercel compatibility'
    });
});

// 8. Get Users (for testing)
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
            <title>El Djamila Salon API</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
                .card { background: #f8f9fa; padding: 20px; margin: 15px 0; border-radius: 10px; }
                .success { color: #28a745; font-weight: bold; }
                code { background: #333; color: white; padding: 2px 6px; border-radius: 4px; }
                a { color: #007bff; text-decoration: none; }
            </style>
        </head>
        <body>
            <h1>✨ El Djamila Salon API</h1>
            <p><strong>Status:</strong> <span class="success">● Online (No SSL Mode)</span></p>
            <p><strong>Node.js:</strong> ${process.version}</p>
            <p><strong>MongoDB:</strong> Connected without SSL (Vercel compatible)</p>
            
            <div class="card">
                <h3>🔍 Health Check</h3>
                <p>Check API status: <code><a href="/api/health" target="_blank">/api/health</a></code></p>
            </div>
            
            <div class="card">
                <h3>🧪 Database Test</h3>
                <p>Test MongoDB connection: <code><a href="/api/test-db" target="_blank">/api/test-db</a></code></p>
            </div>
            
            <div class="card">
                <h3>👤 Register User</h3>
                <p><code>POST /api/auth/register</code></p>
                <p><strong>Body:</strong> { "name": "Test User", "email": "test@test.com", "password": "123456" }</p>
            </div>
            
            <div class="card">
                <h3>🔐 Login User</h3>
                <p><code>POST /api/auth/login</code></p>
                <p><strong>Body:</strong> { "email": "test@test.com", "password": "123456" }</p>
            </div>
            
            <div class="card">
                <h3>📋 Get Offers</h3>
                <p><code>GET /api/offers</code></p>
                <a href="/api/offers" target="_blank">View Offers</a>
            </div>
            
            <hr>
            <p><strong>Note:</strong> This API uses MongoDB without SSL for Vercel compatibility.</p>
        </body>
        </html>
    `);
});

// ========== ERROR HANDLING ==========
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.url}`
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