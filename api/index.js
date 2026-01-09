const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();

// ========== CONFIGURATION MIDDLEWARE ==========
app.use(helmet({
    contentSecurityPolicy: false // Désactivé pour Socket.io
}));
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== CONFIGURATION URGENTE ==========
console.log('🚀 API El Djamila - Version Finale Vercel');

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
            return false;
        }
        
        // Log sécurisé
        const safeURI = MONGODB_URI.replace(/:[^:@]*@/, ':****@');
        console.log('🌐 URI utilisé:', safeURI);
        
        // Connexion avec timeout court
        client = new MongoClient(MONGODB_URI, {
            serverSelectionTimeoutMS: 8000,
            connectTimeoutMS: 8000,
            socketTimeoutMS: 8000,
            maxPoolSize: 5,
            minPoolSize: 1
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
        return true;
        
    } catch (error) {
        console.error('❌ ERREUR CONNEXION MONGODB:', error.message);
        console.error('🔧 Détails:', error);
        return false;
    }
}

// ========== Gestionnaire DB sécurisé ==========
async function getDatabase() {
    if (!dbConnected || !db) {
        console.log('🔄 Tentative de connexion à MongoDB...');
        const connected = await connectDB();
        if (!connected) {
            throw new Error('Impossible de se connecter à MongoDB. Vérifiez MONGODB_URI dans Vercel.');
        }
    }
    
    if (!db) {
        throw new Error('Database non disponible');
    }
    
    return db;
}

// Initialisation immédiate
connectDB().then(connected => {
    if (connected) {
        console.log('✅ MongoDB initialisé avec succès');
    } else {
        console.log('⚠️ MongoDB non initialisé - Attente des requêtes');
    }
});

const JWT_SECRET = process.env.JWT_SECRET || 'eldjamila-secret-2024';

// ========== Middleware ==========
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
    try {
        const dbStatus = dbConnected ? 'connecté' : 'non connecté';
        let dbDetails = { connected: dbConnected };
        
        if (dbConnected && db) {
            try {
                await db.command({ ping: 1 });
                dbDetails.ping = 'OK';
            } catch (err) {
                dbDetails.ping = 'FAILED';
            }
        }
        
        res.json({
            success: true,
            message: 'API El Djamila en ligne',
            timestamp: new Date().toISOString(),
            database: dbDetails,
            environment: process.env.NODE_ENV || 'production',
            version: '1.0.0-vercel'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Erreur health check',
            error: error.message 
        });
    }
});

// 2. Test simple MongoDB
app.get('/api/test-mongo', async (req, res) => {
    try {
        const currentDb = await getDatabase();
        const collections = await currentDb.listCollections().toArray();
        
        res.json({
            success: true,
            message: 'MongoDB fonctionne',
            collections: collections.map(c => c.name),
            dbName: currentDb.databaseName,
            connected: true
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'MongoDB erreur: ' + error.message,
            connected: false
        });
    }
});

// 3. Connexion
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email et mot de passe requis' });
        }
        
        const currentDb = await getDatabase();
        const user = await currentDb.collection('users').findOne({ email });
        
        if (!user) {
            // Si l'utilisateur n'existe pas, créer un utilisateur test (pour debug)
            console.log('⚠️ Utilisateur non trouvé, création test');
            
            const hashedPassword = await bcrypt.hash(password, 10);
            const newUser = {
                name: 'Utilisateur Test',
                email: email,
                passwordHash: hashedPassword,
                role: 'user',
                balance: 100,
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
            
            return res.json({
                success: true,
                token,
                user: {
                    id: result.insertedId,
                    name: newUser.name,
                    email: newUser.email,
                    role: newUser.role,
                    balance: newUser.balance,
                    points: newUser.points
                },
                message: 'Utilisateur test créé'
            });
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
            message: 'Erreur serveur: ' + error.message
        });
    }
});

// 4. Inscription
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
            message: 'Erreur: ' + error.message
        });
    }
});

// 5. Obtenir offres
app.get('/api/offers', async (req, res) => {
    try {
        const currentDb = await getDatabase();
        const offers = await currentDb.collection('offers')
            .find({ isActive: true })
            .sort({ createdAt: -1 })
            .toArray();
        
        // Si pas d'offres, créer des offres test
        if (offers.length === 0) {
            const testOffers = [
                {
                    title: 'Offre Spéciale 50%',
                    description: 'Réduction exceptionnelle',
                    price: 25,
                    originalPrice: 50,
                    isActive: true,
                    createdAt: new Date()
                },
                {
                    title: 'Pack Familial',
                    description: 'Pour toute la famille',
                    price: 75,
                    originalPrice: 100,
                    isActive: true,
                    createdAt: new Date()
                }
            ];
            
            await currentDb.collection('offers').insertMany(testOffers);
            const newOffers = await currentDb.collection('offers')
                .find({ isActive: true })
                .toArray();
            
            return res.json({ success: true, offers: newOffers, test: true });
        }
        
        res.json({ success: true, offers });
    } catch (error) {
        console.error('Erreur chargement offres:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur: ' + error.message 
        });
    }
});

// 6. Créer offre
app.post('/api/offers', authenticateToken, async (req, res) => {
    try {
        const { title, description, price, originalPrice } = req.body;
        
        if (!title || !price) {
            return res.status(400).json({ 
                success: false, 
                message: 'Titre et prix requis' 
            });
        }
        
        const currentDb = await getDatabase();
        const newOffer = {
            title,
            description: description || '',
            price: Number(price),
            originalPrice: Number(originalPrice) || Number(price),
            createdBy: req.user.userId,
            isActive: true,
            createdAt: new Date()
        };
        
        const result = await currentDb.collection('offers').insertOne(newOffer);
        
        res.json({
            success: true,
            message: 'Offre créée',
            offer: { ...newOffer, _id: result.insertedId }
        });
        
    } catch (error) {
        console.error('Erreur création offre:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur création' 
        });
    }
});

// 7. Route test simple
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'API El Djamila fonctionne!',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// 8. Route pour voir les utilisateurs (debug)
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const currentDb = await getDatabase();
        const users = await currentDb.collection('users')
            .find({}, { projection: { passwordHash: 0 } })
            .toArray();
        
        res.json({ success: true, users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== Gestion fichiers statiques ==========
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>El Djamila</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
                code { background: #eee; padding: 2px 5px; }
            </style>
        </head>
        <body>
            <h1>🚀 El Djamila API</h1>
            <p>API backend pour l'application El Djamila</p>
            
            <div class="endpoint">
                <h3>🔍 Health Check</h3>
                <p><code>GET /api/health</code> - Vérifier l'état de l'API</p>
                <a href="/api/health" target="_blank">Tester</a>
            </div>
            
            <div class="endpoint">
                <h3>🧪 Test MongoDB</h3>
                <p><code>GET /api/test-mongo</code> - Tester connexion MongoDB</p>
                <a href="/api/test-mongo" target="_blank">Tester</a>
            </div>
            
            <div class="endpoint">
                <h3>📋 Test Simple</h3>
                <p><code>GET /api/test</code> - Test API simple</p>
                <a href="/api/test" target="_blank">Tester</a>
            </div>
            
            <div class="endpoint">
                <h3>📄 Offres</h3>
                <p><code>GET /api/offers</code> - Voir les offres disponibles</p>
                <a href="/api/offers" target="_blank">Voir offres</a>
            </div>
            
            <hr>
            <p><strong>Base de données:</strong> ${dbConnected ? '✅ Connectée' : '❌ Non connectée'}</p>
            <p><strong>MongoDB URI:</strong> ${process.env.MONGODB_URI ? 'Configuré' : 'Non configuré'}</p>
        </body>
        </html>
    `);
});

// ========== Gestion erreurs ==========
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route non trouvée: ' + req.url,
        availableRoutes: [
            '/api/health',
            '/api/test-mongo',
            '/api/test',
            '/api/auth/login (POST)',
            '/api/auth/register (POST)',
            '/api/offers'
        ]
    });
});

app.use((err, req, res, next) => {
    console.error('❌ Erreur serveur:', err.message);
    res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ========== Socket.io pour Vercel ==========
// Note: Socket.io peut avoir des limitations sur Vercel Serverless
const httpServer = require('http').createServer(app);
const io = require('socket.io')(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('Socket connecté:', socket.id);
    
    socket.on('new_offer_added', (offer) => {
        socket.broadcast.emit('new_offer', offer);
    });
    
    socket.on('disconnect', () => {
        console.log('Socket déconnecté:', socket.id);
    });
});

// ========== Export pour Vercel ==========
// IMPORTANT: Vercel a besoin de cette exportation exacte
module.exports = app;

// Note: httpServer n'est PAS démarré ici
// Vercel gère le serveur automatiquement