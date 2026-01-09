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
    contentSecurityPolicy: false
}));
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== CONFIGURATION MONGO POUR VERCEL ==========
console.log('🚀 API El Djamila - Version Vercel SSL Fix');

// ========== Connexion MongoDB (FIX SSL) ==========
let db = null;
let client = null;
let dbConnected = false;

// URI avec paramètres SSL pour Vercel
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://eldjamila-cluster:YueVW02QRkSSPyzT@cluster0.cmsgoyg.mongodb.net/eldjamila_db?retryWrites=true&w=majority&tls=true';

async function connectDB() {
    try {
        console.log('🔗 Initialisation connexion MongoDB...');
        
        if (!MONGODB_URI) {
            console.error('🚨 ERREUR: MONGODB_URI vide');
            return false;
        }
        
        // Log sécurisé
        const safeURI = MONGODB_URI.replace(/:[^:@]*@/, ':****@');
        console.log('🌐 URI utilisé:', safeURI);
        
        // CONFIGURATION SPÉCIALE POUR VERCEL
        client = new MongoClient(MONGODB_URI, {
            serverSelectionTimeoutMS: 15000,  // Augmenté à 15s
            connectTimeoutMS: 15000,
            socketTimeoutMS: 45000,
            tls: true,  // FORCER TLS
            tlsAllowInvalidCertificates: false,
            tlsAllowInvalidHostnames: false,
            retryWrites: true,
            w: 'majority',
            maxPoolSize: 10,
            minPoolSize: 1,
            // Désactiver le monitoring qui cause des problèmes SSL
            monitorCommands: false,
            // Utiliser un driver plus récent
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('🔄 Connexion en cours...');
        await client.connect();
        console.log('✅ Client MongoDB connecté');
        
        // Tester avec plusieurs noms de base
        const dbNames = ['eldjamila_db', 'test'];
        for (const dbName of dbNames) {
            try {
                const testDb = client.db(dbName);
                await testDb.command({ ping: 1 });
                db = testDb;
                console.log(`✅ Base de données "${dbName}" accessible`);
                break;
            } catch (err) {
                console.log(`⚠️ Base "${dbName}" non accessible: ${err.message}`);
            }
        }
        
        if (!db) {
            // Créer la base
            db = client.db('eldjamila_db');
            console.log('✅ Nouvelle base créée: eldjamila_db');
        }
        
        dbConnected = true;
        
        // Créer collections si nécessaire
        const collections = ['users', 'offers'];
        for (const collName of collections) {
            try {
                await db.createCollection(collName);
                console.log(`📄 Collection "${collName}" créée`);
            } catch (err) {
                // Existe déjà
            }
        }
        
        // Index pour users
        try {
            await db.collection('users').createIndex({ email: 1 }, { unique: true });
            console.log('🔑 Index email créé');
        } catch (err) {
            // Existe déjà
        }
        
        console.log('🎉 MongoDB prêt!');
        return true;
        
    } catch (error) {
        console.error('❌ ERREUR MONGODB:', error.message);
        
        // Suggestions de solutions
        if (error.message.includes('SSL') || error.message.includes('tls')) {
            console.error('🔧 SOLUTION: Vérifiez que MONGODB_URI contient "tls=true" dans Vercel');
            console.error('🔧 SOLUTION 2: Ajoutez "ssl=true" à la fin de l\'URI');
        }
        
        if (error.message.includes('timed out')) {
            console.error('🔧 SOLUTION: Augmentez timeout dans Vercel Network Access');
        }
        
        return false;
    }
}

// ========== Gestionnaire DB ==========
async function getDatabase() {
    if (!dbConnected || !db) {
        console.log('🔄 Reconnexion MongoDB...');
        const connected = await connectDB();
        if (!connected) {
            throw new Error('MongoDB non disponible. Vérifiez MONGODB_URI dans Vercel.');
        }
    }
    return db;
}

// Initialisation
connectDB().then(connected => {
    if (connected) {
        console.log('✅ MongoDB initialisé');
    } else {
        console.log('⚠️ MongoDB échoué - Mode sans DB');
    }
});

const JWT_SECRET = process.env.JWT_SECRET || 'eldjamila-secret-2024';

// ========== Routes API ==========

// 1. Health check
app.get('/api/health', async (req, res) => {
    try {
        const dbStatus = dbConnected ? 'connecté' : 'non connecté';
        
        res.json({
            success: true,
            message: 'API El Djamila',
            database: dbStatus,
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'production'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// 2. Test MongoDB direct
app.get('/api/test-mongo', async (req, res) => {
    try {
        const currentDb = await getDatabase();
        const collections = await currentDb.listCollections().toArray();
        
        res.json({
            success: true,
            message: 'MongoDB OK',
            collections: collections.map(c => c.name),
            dbName: currentDb.databaseName
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'MongoDB erreur: ' + error.message
        });
    }
});

// 3. Inscription (SIMPLE)
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        if (!name || !email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Tous les champs requis' 
            });
        }
        
        const currentDb = await getDatabase();
        
        // Vérifier si email existe
        const existingUser = await currentDb.collection('users').findOne({ email });
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email déjà utilisé' 
            });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Créer utilisateur
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
        
        // Générer token
        const token = jwt.sign(
            {
                userId: result.insertedId.toString(),
                email: email,
                role: 'user'
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        // Réponse
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
        console.error('❌ Erreur inscription:', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur: ' + error.message 
        });
    }
});

// 4. Connexion
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email et mot de passe requis' 
            });
        }
        
        const currentDb = await getDatabase();
        const user = await currentDb.collection('users').findOne({ email });
        
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Identifiants incorrects' 
            });
        }
        
        // Vérifier mot de passe
        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) {
            return res.status(401).json({ 
                success: false, 
                message: 'Identifiants incorrects' 
            });
        }
        
        // Générer token
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
        console.error('❌ Erreur connexion:', error);
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
                    title: 'Coiffure Soirée',
                    description: 'Pour vos occasions spéciales',
                    price: 45,
                    originalPrice: 60,
                    isActive: true,
                    createdAt: new Date()
                },
                {
                    title: 'Coupe & Brushing',
                    description: 'Service complet',
                    price: 35,
                    originalPrice: 45,
                    isActive: true,
                    createdAt: new Date()
                }
            ];
            
            await currentDb.collection('offers').insertMany(testOffers);
            const newOffers = await currentDb.collection('offers').find().toArray();
            return res.json({ success: true, offers: newOffers });
        }
        
        res.json({ success: true, offers });
        
    } catch (error) {
        console.error('❌ Erreur offres:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur chargement' 
        });
    }
});

// 6. Créer offre
app.post('/api/offers', async (req, res) => {
    try {
        const { title, description, price } = req.body;
        
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
        timestamp: new Date().toISOString()
    });
});

// ========== Static files ==========
app.use(express.static(path.join(__dirname, '../public')));

// Page d'accueil
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>El Djamila</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; }
            </style>
        </head>
        <body>
            <h1>El Djamila API</h1>
            <div class="endpoint">
                <h3>🔍 Health Check</h3>
                <a href="/api/health" target="_blank">/api/health</a>
            </div>
            <div class="endpoint">
                <h3>🧪 Test MongoDB</h3>
                <a href="/api/test-mongo" target="_blank">/api/test-mongo</a>
            </div>
            <div class="endpoint">
                <h3>📋 Test API</h3>
                <a href="/api/test" target="_blank">/api/test</a>
            </div>
        </body>
        </html>
    `);
});

// ========== Gestion erreurs ==========
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route non trouvée'
    });
});

app.use((err, req, res, next) => {
    console.error('❌ Erreur:', err.message);
    res.status(500).json({
        success: false,
        message: 'Erreur serveur'
    });
});

// ========== Export Vercel ==========
module.exports = app;