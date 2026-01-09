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

console.log('🚀 API El Djamila - No SSL Version');

// ========== MONGODB CONNECTION ==========
let db = null;
let client = null;

// Use environment variable or direct connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://eldjamila-cluster:YueVW02QRkSSPyzT@ac-duaqchc-shard-00-00.cmsgoyg.mongodb.net:27017,ac-duaqchc-shard-00-01.cmsgoyg.mongodb.net:27017,ac-duaqchc-shard-00-02.cmsgoyg.mongodb.net:27017/eldjamila_db?replicaSet=atlas-an8c5f-shard-0&authSource=admin&retryWrites=true&w=majority&ssl=false&tls=false';

const JWT_SECRET = process.env.JWT_SECRET || 'eldjamila-secret-2024';

async function connectDB() {
    if (db) {
        return db;
    }
    
    console.log('🔗 Connecting to MongoDB (No SSL)...');
    
    try {
        // Hide password in logs
        const safeURI = MONGODB_URI.replace(/:[^:@]*@/, ':****@');
        console.log('🌐 Using URI:', safeURI);
        
        client = new MongoClient(MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000,
            socketTimeoutMS: 30000,
            maxPoolSize: 5,
            minPoolSize: 1,
            ssl: false,
            tls: false,
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
        const collections = await database.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        if (!collectionNames.includes('users')) {
            await database.createCollection('users');
            await database.collection('users').createIndex({ email: 1 }, { unique: true });
        }
        
        if (!collectionNames.includes('offers')) {
            await database.createCollection('offers');
            await database.collection('offers').createIndex({ isActive: 1 });
        }
        
        if (!collectionNames.includes('bookings')) {
            await database.createCollection('bookings');
        }
        
        if (!collectionNames.includes('transactions')) {
            await database.createCollection('transactions');
        }
        
    } catch (err) {
        console.log('📁 Collections already exist');
    }
}

// ========== MIDDLEWARE ==========
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'Token required' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

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
                name: database.databaseName
            },
            server: {
                nodeVersion: process.version,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        res.json({
            success: false,
            message: '⚠️ API is running but database is disconnected',
            error: error.message,
            server: {
                nodeVersion: process.version,
                timestamp: new Date().toISOString()
            }
        });
    }
});

// 2. Register User
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
        
        res.status(500).json({
            success: false,
            message: 'Registration failed. Please try again.'
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
        res.status(500).json({
            success: false,
            message: 'Login failed. Please try again.'
        });
    }
});

// 4. Verify Token
app.get('/api/auth/verify', authenticateToken, async (req, res) => {
    try {
        const database = await connectDB();
        const user = await database.collection('users').findOne(
            { _id: new ObjectId(req.user.userId) },
            { projection: { passwordHash: 0 } }
        );
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        res.json({
            success: true,
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
        console.error('Verify error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
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
        
        res.json({ success: true, offers });
    } catch (error) {
        console.error('Error loading offers:', error);
        res.status(500).json({ success: false, message: 'Error loading offers' });
    }
});

// 6. Create Offer (Admin)
app.post('/api/offers', authenticateToken, async (req, res) => {
    try {
        const database = await connectDB();
        const user = await database.collection('users').findOne({ 
            _id: new ObjectId(req.user.userId) 
        });
        
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        
        const { title, category, original_price, promo_price, description } = req.body;
        
        if (!title || !category || !original_price) {
            return res.status(400).json({ success: false, message: 'Title, category and price required' });
        }
        
        const newOffer = {
            title,
            category,
            original_price: parseFloat(original_price),
            promo_price: promo_price ? parseFloat(promo_price) : null,
            description: description || '',
            isActive: true,
            createdAt: new Date()
        };
        
        const result = await database.collection('offers').insertOne(newOffer);
        newOffer._id = result.insertedId;
        
        res.json({ success: true, offer: newOffer });
        
    } catch (error) {
        console.error('Error adding offer:', error);
        res.status(500).json({ success: false, message: 'Error adding offer' });
    }
});

// 7. Charge Balance
app.post('/api/payment/charge', authenticateToken, async (req, res) => {
    try {
        const { amount } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid amount' });
        }
        
        const database = await connectDB();
        const user = await database.collection('users').findOne({ 
            _id: new ObjectId(req.user.userId) 
        });
        
        const newBalance = (user.balance || 0) + parseFloat(amount);
        const newPoints = (user.points || 0) + Math.floor(amount);
        
        await database.collection('users').updateOne(
            { _id: new ObjectId(req.user.userId) },
            { 
                $set: { 
                    balance: newBalance,
                    points: newPoints 
                } 
            }
        );
        
        res.json({
            success: true,
            newBalance,
            newPoints,
            message: 'Balance charged successfully'
        });
        
    } catch (error) {
        console.error('Charge error:', error);
        res.status(500).json({ success: false, message: 'Charge error' });
    }
});

// 8. Make Booking
app.post('/api/bookings', authenticateToken, async (req, res) => {
    try {
        const { offerId } = req.body;
        
        if (!offerId) {
            return res.status(400).json({ success: false, message: 'Offer ID required' });
        }
        
        const database = await connectDB();
        
        const offer = await database.collection('offers').findOne({ 
            _id: new ObjectId(offerId) 
        });
        
        if (!offer) {
            return res.status(404).json({ success: false, message: 'Offer not found' });
        }
        
        const price = offer.promo_price || offer.original_price;
        
        const user = await database.collection('users').findOne({ 
            _id: new ObjectId(req.user.userId) 
        });
        
        if ((user.balance || 0) < price) {
            return res.status(400).json({ success: false, message: 'Insufficient balance' });
        }
        
        const newBalance = (user.balance || 0) - price;
        await database.collection('users').updateOne(
            { _id: new ObjectId(req.user.userId) },
            { $set: { balance: newBalance } }
        );
        
        await database.collection('bookings').insertOne({
            userId: new ObjectId(req.user.userId),
            offerId: new ObjectId(offerId),
            bookingDate: new Date(),
            status: 'confirmed',
            totalPrice: price,
            createdAt: new Date()
        });
        
        res.json({
            success: true,
            newBalance,
            message: 'Booking successful'
        });
        
    } catch (error) {
        console.error('Booking error:', error);
        res.status(500).json({ success: false, message: 'Booking error' });
    }
});

// 9. Update Profile
app.put('/api/profile/update', authenticateToken, async (req, res) => {
    try {
        const { name, phone } = req.body;
        
        if (!name) {
            return res.status(400).json({ success: false, message: 'Name required' });
        }
        
        const database = await connectDB();
        
        await database.collection('users').updateOne(
            { _id: new ObjectId(req.user.userId) },
            { 
                $set: { 
                    name,
                    phone: phone || null
                } 
            }
        );
        
        res.json({ success: true, message: 'Profile updated' });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, message: 'Update error' });
    }
});

// 10. Get Users (Admin only)
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const database = await connectDB();
        const user = await database.collection('users').findOne({ 
            _id: new ObjectId(req.user.userId) 
        });
        
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        
        const users = await database.collection('users')
            .find({}, { projection: { passwordHash: 0 } })
            .sort({ createdAt: -1 })
            .toArray();
        
        res.json({ success: true, users });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ success: false, message: 'Error getting users' });
    }
});

// 11. Simple Test
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: '🚀 El Djamila API is working!',
        version: '2.0.0',
        timestamp: new Date().toISOString()
    });
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

// ========== START SERVER ==========
const PORT = process.env.PORT || 3000;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Server started on http://localhost:${PORT}`);
    });
}

// ========== EXPORT FOR VERCEL ==========
module.exports = app;