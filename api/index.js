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

// ========== CONFIGURATION URGENTE ==========
console.log('🚀 API El Djamila - Version Finale');

// ========== Connexion MongoDB ==========
let db = null;
let client = null;
let dbConnected = false;

// URI FINAL - TESTÉ ET CORRECT
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://eldjamila-cluster:YueVW02QRkSSPyzT@cluster0.cmsgoyg.mongodb.net/eldjamila_db';

async function connectDB() {
    try {
        console.log('🔗 Initialisation connexion MongoDB...');
        
        // Vérification URI
        if (!MONGODB_URI) {
            console.error('🚨 ERREUR: MONGODB_URI est vide!');
            console.error('💡 Solution: Ajoutez MONGODB_URI dans Vercel Environment Variables');
            return;
        }
        
        // Log sécurisé
        const safeURI = MONGODB_URI.replace(/:[^:@]*@/, ':****@');
        console.log('🌐 URI utilisé:', safeURI);
        
        // Connexion avec timeout court
        client = new MongoClient(MONGODB_URI, {
            serverSelectionTimeoutMS: 8000,
            connectTimeoutMS: 8000,
            socketTimeoutMS: 8000
        });
        
        await client.connect();
        console.log('✅ Client MongoDB connecté');
        
        // Essayez plusieurs bases de données
        const dbNames = ['eldjamila_db', 'test', 'admin'];
        let connectedDb = null;
        
        for (const dbName of dbNames) {
            try {
                const testDb = client.db(dbName);
                await testDb.command({ ping: 1 });
                db = testDb;
                connectedDb = dbName;
                console.log(`✅ Base de données trouvée: ${dbName}`);
                break;
            } catch (err) {
                console.log(`⚠️ Base ${dbName} non accessible: ${err.message}`);
            }
        }
        
        if (!db) {
            // Créer la base par défaut
            db = client.db('eldjamila_db');
            console.log('✅ Nouvelle base créée: eldjamila_db');
        }
        
        dbConnected = true;
        
        // Créer les collections si elles n'existent pas
        const collections = ['users', 'offers', 'bookings', 'transactions'];
        for (const collName of collections) {
            try {
                await db.createCollection(collName);
                console.log(`📄 Collection créée: ${collName}`);
            } catch (err) {
                // Collection existe déjà
            }
        }
        
        // Créer les index
        try {
            await db.collection('users').createIndex({ email: 1 }, { unique: true });
            console.log('🔑 Index email créé');
        } catch (err) {
            console.log('ℹ️ Index email existe déjà');
        }
        
        console.log('🎉 MongoDB prêt à utiliser!');
        
    } catch (error) {
        console.error('❌ ERREUR CONNEXION MONGODB:', error.message);
        console.error('🔧 Causes possibles:');
        console.error('   1. Mot de passe incorrect dans Vercel');
        console.error('   2. Network Access bloqué (besoin 0.0.0.0/0)');
        console.error('   3. Cluster0 non accessible');
    }
}

// ========== Gestionnaire DB sécurisé ==========
async function getDatabase() {
    if (!dbConnected) {
        console.log('🔄 Tentative reconnexion...');
        await connectDB();
    }
    
    if (!db) {
        throw new Error('Database non disponible');
    }
    
    return db;
}

// Initialisation immédiate
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

// 1. Health check complet
app.get('/api/health', async (req, res) => {
    const dbStatus = dbConnected ? 'connecté' : 'non connecté';
    
    res.json({
        success: true,
        message: 'API El Djamila en ligne',
        timestamp: new Date().toISOString(),
        database: dbStatus,
        environment: process.env.NODE_ENV || 'production',
        version: '1.0.0'
    });
});

// 2. Connexion - PROTÉGÉ
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email et mot de passe requis' });
        }
        
        const currentDb = await getDatabase();
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
        console.error('Erreur connexion:', error.message);
        res.status(500).json({ 
            success: false, 
            message: error.message.includes('Database non disponible') 
                ? 'Base de données non disponible. Vérifiez MONGODB_URI dans Vercel.'
                : 'Erreur serveur'
        });
    }
});

// 3. Inscription - PROTÉGÉ
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Tous les champs sont requis' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Mot de passe 6 caractères minimum' });
        }
        
        const currentDb = await getDatabase();
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
        console.error('Erreur inscription:', error.message);
        res.status(500).json({ 
            success: false, 
            message: error.message.includes('Database non disponible') 
                ? 'Base de données non disponible. Vérifiez MONGODB_URI dans Vercel.'
                : 'Erreur lors de l\'inscription'
        });
    }
});

// 4. Obtenir offres
app.get('/api/offers', async (req, res) => {
    try {
        const currentDb = await getDatabase();
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

// Routes restantes (similaires - protégées avec getDatabase())

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

// ========== Gestion fichiers statiques ==========
app.use(express.static('public'));

app.get('*', (req, res) => {
    res.sendFile('index.html', { root: 'public' });
});

// ========== Export pour Vercel ==========
module.exports = app;

// ========== Pour développement local ==========
if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, () => {
        console.log(`🚀 Serveur local: http://localhost:${PORT}`);
        console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
    });
}