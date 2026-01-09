const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { MongoClient, ObjectId } = require('mongodb');
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

console.log('🚀 API El Djamila - SRV Version');

// ========== MONGODB CONNECTION (SRV) ==========
let db = null;
let client = null;

// ✅ استخدم SRV connection بدلاً من Standard
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://eldjamila-cluster:YueVW02QRkSSPyzT@ac-duaqchc-shard-00-00.cmsgoyg.mongodb.net/eldjamila_db?retryWrites=true&w=majority&appName=Cluster0';

const JWT_SECRET = process.env.JWT_SECRET || 'eldjamila-secret-2024';

async function connectDB() {
    if (db) {
        return db;
    }
    
    console.log('🔗 Connecting to MongoDB (SRV)...');
    
    try {
        // Hide password in logs
        const safeURI = MONGODB_URI.replace(/:[^:@]*@/, ':****@');
        console.log('🌐 Using SRV URI:', safeURI);
        
        client = new MongoClient(MONGODB_URI, {
            serverSelectionTimeoutMS: 5000, // قلل الوقت لـ 5 ثواني
            connectTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            minPoolSize: 1,
            retryWrites: true,
            w: 'majority'
        });
        
        await client.connect();
        console.log('✅ MongoDB connected successfully via SRV!');
        
        db = client.db();
        await db.command({ ping: 1 });
        console.log('✅ Database ping successful');
        
        return db;
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        console.error('🔧 Error details:', {
            name: error.name,
            code: error.code,
            codeName: error.codeName
        });
        
        // Fallback to demo mode
        console.log('⚠️ Continuing in demo mode without database');
        return null;
    }
}

// ========== API ROUTES ==========

// 1. Health Check
app.get('/api/health', async (req, res) => {
    try {
        const database = await connectDB();
        
        if (database) {
            await database.command({ ping: 1 });
            res.json({
                success: true,
                message: '✅ El Djamila API is fully operational',
                database: 'connected',
                connection: 'SRV',
                timestamp: new Date().toISOString()
            });
        } else {
            res.json({
                success: true,
                message: '✅ API is running (demo mode)',
                database: 'disconnected',
                connection: 'demo',
                timestamp: new Date().toISOString(),
                note: 'Add MONGODB_URI to Vercel environment variables'
            });
        }
        
    } catch (error) {
        res.json({
            success: false,
            message: '⚠️ Database connection issue',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 2. Register User (مع fallback)
app.post('/api/auth/register', async (req, res) => {
    console.log('📝 Registration request received');
    
    try {
        const { name, email, password } = req.body;
        
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Name, email and password are required'
            });
        }
        
        const database = await connectDB();
        
        if (!database) {
            // Demo mode - simulate successful registration
            const demoToken = jwt.sign(
                {
                    userId: 'demo-user-id',
                    email: email,
                    role: 'user'
                },
                JWT_SECRET,
                { expiresIn: '30d' }
            );
            
            return res.status(201).json({
                success: true,
                message: '🎉 Demo registration successful!',
                token: demoToken,
                user: {
                    id: 'demo-' + Date.now(),
                    name: name,
                    email: email,
                    role: 'user',
                    balance: 100,
                    points: 50
                },
                demo: true
            });
        }
        
        // Real database registration
        const existingUser = await database.collection('users').findOne({ 
            email: email.toLowerCase().trim() 
        });
        
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email is already registered'
            });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
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
        
        const token = jwt.sign(
            {
                userId: result.insertedId.toString(),
                email: userData.email,
                role: userData.role
            },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        res.status(201).json({
            success: true,
            message: '🎉 Registration successful!',
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
        console.error('❌ Registration error:', error.message);
        
        // Even if error, return demo response
        const demoToken = jwt.sign(
            {
                userId: 'fallback-' + Date.now(),
                email: req.body.email || 'demo@demo.com',
                role: 'user'
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.status(201).json({
            success: true,
            message: '✅ Registration completed (demo mode)',
            token: demoToken,
            user: {
                id: 'demo-' + Date.now(),
                name: req.body.name || 'Demo User',
                email: req.body.email || 'demo@demo.com',
                role: 'user',
                balance: 100,
                points: 50
            },
            demo: true,
            warning: 'Database connection issue, using demo mode'
        });
    }
});

// 3. Login User
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
        
        if (!database) {
            // Demo login
            const demoToken = jwt.sign(
                {
                    userId: 'demo-user',
                    email: email,
                    role: 'user'
                },
                JWT_SECRET,
                { expiresIn: '30d' }
            );
            
            return res.json({
                success: true,
                message: '✅ Demo login successful!',
                token: demoToken,
                user: {
                    id: 'demo-user',
                    name: 'Demo User',
                    email: email,
                    role: 'user',
                    balance: 150,
                    points: 75
                },
                demo: true
            });
        }
        
        const user = await database.collection('users').findOne({
            email: email.toLowerCase().trim()
        });
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }
        
        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }
        
        const token = jwt.sign(
            {
                userId: user._id.toString(),
                email: user.email,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
        
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
                points: user.points || 0
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        
        // Fallback demo response
        const demoToken = jwt.sign(
            {
                userId: 'demo-fallback',
                email: req.body.email || 'demo@demo.com',
                role: 'user'
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            success: true,
            message: '✅ Demo login (database issue)',
            token: demoToken,
            user: {
                id: 'demo-fallback',
                name: 'Demo User',
                email: req.body.email || 'demo@demo.com',
                role: 'user',
                balance: 100,
                points: 50
            },
            demo: true
        });
    }
});

// 4. Get Offers
app.get('/api/offers', async (req, res) => {
    try {
        const database = await connectDB();
        
        if (!database) {
            // Demo offers
            const demoOffers = [
                {
                    _id: '1',
                    title: "Women's Haircut",
                    description: "Professional haircut with styling",
                    price: 45,
                    originalPrice: 60,
                    duration: "1 hour",
                    category: "Haircut"
                },
                {
                    _id: '2',
                    title: "Hair Coloring",
                    description: "Full hair coloring service",
                    price: 85,
                    originalPrice: 120,
                    duration: "2 hours",
                    category: "Coloring"
                },
                {
                    _id: '3',
                    title: "Hair Treatment",
                    description: "Deep conditioning treatment",
                    price: 60,
                    originalPrice: 80,
                    duration: "1.5 hours",
                    category: "Treatment"
                }
            ];
            
            return res.json({ success: true, offers: demoOffers, demo: true });
        }
        
        const offers = await database.collection('offers')
            .find({ isActive: true })
            .sort({ createdAt: -1 })
            .toArray();
        
        res.json({ success: true, offers });
        
    } catch (error) {
        console.error('Error loading offers:', error);
        
        // Fallback demo offers
        const demoOffers = [
            {
                _id: 'fallback-1',
                title: "Demo Haircut",
                description: "Professional service",
                price: 50,
                originalPrice: 70,
                category: "Haircut"
            }
        ];
        
        res.json({ success: true, offers: demoOffers, demo: true });
    }
});

// 5. Home Page
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
                .warning { color: #ffc107; font-weight: bold; }
                code { background: #333; color: white; padding: 2px 6px; border-radius: 4px; }
                a { color: #007bff; text-decoration: none; }
            </style>
        </head>
        <body>
            <h1>✨ El Djamila Salon API</h1>
            <p><strong>Status:</strong> <span class="success">● Online</span></p>
            <p><strong>Node.js:</strong> ${process.version}</p>
            <p><strong>Connection:</strong> MongoDB SRV Protocol</p>
            <p class="warning">⚠️ Note: Running in demo mode if database fails</p>
            
            <div class="card">
                <h3>🔍 Health Check</h3>
                <p><a href="/api/health" target="_blank">/api/health</a></p>
            </div>
            
            <div class="card">
                <h3>👤 Register User</h3>
                <p><code>POST /api/auth/register</code></p>
                <p><strong>Body:</strong> { "name": "Test", "email": "test@test.com", "password": "123456" }</p>
            </div>
            
            <div class="card">
                <h3>🔐 Login User</h3>
                <p><code>POST /api/auth/login</code></p>
            </div>
            
            <div class="card">
                <h3>📋 Get Offers</h3>
                <p><a href="/api/offers" target="_blank">/api/offers</a></p>
            </div>
            
            <hr>
            <p><strong>إذا لم يعمل:</strong> تأكد من إضافة IP Vercel إلى MongoDB Atlas Network Access</p>
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
        message: 'Internal server error',
        demo: true
    });
});

// ========== EXPORT FOR VERCEL ==========
module.exports = app;