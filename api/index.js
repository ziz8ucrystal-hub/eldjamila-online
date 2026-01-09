const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// ========== DEBUG IMPORTANT ==========
console.log('🚀 Démarrage API El Djamila...');
console.log('🔧 MONGODB_URI présent?', !!process.env.MONGODB_URI);

// ========== Connexion MongoDB ==========
let db = null;
let client = null;
let dbConnected = false;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://eldjamila-cluster:YueVW02QRkSSPyzT@cluster0.cmsgoyg.mongodb.net/eldjamila_db';

async function connectDB() {
    try {
        console.log('🔗 Tentative connexion MongoDB...');
        
        if (!MONGODB_URI) {
            console.error('❌ MONGODB_URI est vide!');
            console.error('❌ Vérifiez Environment Variables dans Vercel');
            return;
        }
        
        // Masquer le mot de passe dans les logs
        const safeURI = MONGODB_URI.replace(/:[^:@]*@/, ':****@');
        console.log('🔗 URI utilisé:', safeURI);
        
        client = new MongoClient(MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000
        });
        
        await client.connect();
        db = client.db('eldjamila_db');
        dbConnected = true;
        
        console.log('✅ MongoDB connecté avec succès!');
        console.log('📊 Base de données:', 'eldjamila_db');
        
        // Créer les index
        try {
            await db.collection('users').createIndex({ email: 1 }, { unique: true });
            await db.collection('offers').createIndex({ isActive: 1 });
            console.log('✅ Indexes créés');
        } catch (indexError) {
            console.log('⚠️ Index peut-être déjà existant');
        }
        
    } catch (error) {
        console.error('❌ ERREUR connexion MongoDB:', error.message);
        console.error('💡 Vérifiez:');
        console.error('   1. Mot de passe dans Vercel Environment Variables');
        console.error('   2. Network Access 0.0.0.0/0 dans MongoDB Atlas');
        console.error('   3. Database "eldjamila_db" existe dans Cluster0');
    }
}

// ========== Fonction helper pour vérifier db ==========
async function ensureDB() {
    if (!dbConnected) {
        console.log('🔄 Réessai connexion MongoDB...');
        await connectDB();
    }
    return db;
}

connectDB();

const JWT_SECRET = process.env.JWT_SECRET || 'eldjamila-secret-2024';

// ========== Middleware ==========
app.use(helmet());
app.use(cors());
app.use(express.json());

// Middleware vérification token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'Token requis' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Token invalide' });
        }
        req.user = user;
        next();
    });
};

// ========== Routes API ==========

// 1. Health check amélioré
app.get('/api/health', async (req, res) => {
    const dbStatus = dbConnected ? 'connected' : 'disconnected';
    
    res.json({
        success: true,
        message: 'API El Djamila en ligne',
        timestamp: new Date().toISOString(),
        database: dbStatus,
        environment: process.env.NODE_ENV || 'production'
    });
});

// 2. Vérifier session
app.get('/api/auth/verify', authenticateToken, async (req, res) => {
    try {
        const currentDb = await ensureDB();
        if (!currentDb) {
            return res.status(503).json({ 
                success: false, 
                message: 'Base de données non disponible' 
            });
        }
        
        const user = await currentDb.collection('users').findOne(
            { _id: new ObjectId(req.user.userId) },
            { projection: { passwordHash: 0 } }
        );
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
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
        console.error('Erreur vérification:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// 3. Connexion
app.post('/api/auth/login', async (req, res) => {
    try {
        const currentDb = await ensureDB();
        if (!currentDb) {
            return res.status(503).json({ 
                success: false, 
                message: 'Base de données non disponible. Vérifiez MONGODB_URI dans Vercel.' 
            });
        }
        
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email et mot de passe requis' });
        }
        
        const user = await currentDb.collection('users').findOne({ email });
        
        if (!user) {
            return res.status(401).json({ success: false, message: 'Identifiants incorrects' });
        }
        
        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) {
            return res.status(401).json({ success: false, message: 'Identifiants incorrects' });
        }
        
        const token = jwt.sign(
            {
                userId: user._id.toString(),
                email: user.email,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            success: true,
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
        console.error('Erreur connexion:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// 4. Inscription
app.post('/api/auth/register', async (req, res) => {
    try {
        const currentDb = await ensureDB();
        if (!currentDb) {
            return res.status(503).json({ 
                success: false, 
                message: 'Base de données non disponible. Vérifiez MONGODB_URI dans Vercel.' 
            });
        }
        
        const { name, email, password } = req.body;
        
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Tous les champs sont requis' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Mot de passe 6 caractères minimum' });
        }
        
        const existingUser = await currentDb.collection('users').findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email déjà utilisé' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
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
        
        const result = await currentDb.collection('users').insertOne(newUser);
        
        const token = jwt.sign(
            {
                userId: result.insertedId.toString(),
                email: email,
                role: 'user'
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            success: true,
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
        console.error('Erreur inscription:', error);
        res.status(500).json({ success: false, message: 'Erreur lors de l\'inscription' });
    }
});

// 5. Obtenir offres
app.get('/api/offers', async (req, res) => {
    try {
        const currentDb = await ensureDB();
        if (!currentDb) {
            return res.status(503).json({ 
                success: false, 
                message: 'Base de données non disponible' 
            });
        }
        
        const offers = await currentDb.collection('offers')
            .find({ isActive: true })
            .sort({ createdAt: -1 })
            .toArray();
        
        res.json({ success: true, offers });
    } catch (error) {
        console.error('Erreur chargement offres:', error);
        res.status(500).json({ success: false, message: 'Erreur de chargement' });
    }
});

// Routes supplémentaires (offres, payments, bookings, etc.)...
// [ابقى باقي الكود كما هو، فقط استبدل كل db.collection بـ currentDb.collection]

// ========== Socket.io ==========
io.on('connection', (socket) => {
    console.log('Nouvelle connexion:', socket.id);
    
    socket.on('new_offer_added', (offer) => {
        socket.broadcast.emit('new_offer', offer);
    });
    
    socket.on('disconnect', () => {
        console.log('Déconnexion:', socket.id);
    });
});

// ========== Servir fichiers statiques ==========
app.use(express.static('public'));

// ========== Route par défaut ==========
app.get('*', (req, res) => {
    res.sendFile('index.html', { root: 'public' });
});

// ========== Export pour Vercel ==========
module.exports = app;

// ========== Pour développement local seulement ==========
if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, () => {
        console.log(`🚀 Serveur local démarré sur http://localhost:${PORT}`);
    });
}