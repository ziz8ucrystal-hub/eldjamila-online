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

// ========== Connexion MongoDB ==========
let db;
let client;

const MONGODB_URI = process.env.MONGODB_URI;

async function connectDB() {
    try {
        if (!MONGODB_URI) {
            throw new Error('MONGODB_URI non configuré');
        }
        
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        db = client.db('eldjamila_db');
        console.log('✅ MongoDB connecté avec succès');
        
        // Créer les index uniquement
        await db.collection('users').createIndex({ email: 1 }, { unique: true });
        await db.collection('offers').createIndex({ isActive: 1 });
        await db.collection('offers').createIndex({ category: 1 });
        
        // Pas de données d'exemple - vous ajouterez via l'admin
        console.log('✅ Base de données prête');
        
    } catch (error) {
        console.error('❌ Erreur connexion MongoDB:', error.message);
    }
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

// 1. Vérifier session
app.get('/api/auth/verify', authenticateToken, async (req, res) => {
    try {
        const user = await db.collection('users').findOne(
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

// 2. Connexion
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email et mot de passe requis' });
        }
        
        const user = await db.collection('users').findOne({ email });
        
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

// 3. Inscription
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Tous les champs sont requis' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Mot de passe 6 caractères minimum' });
        }
        
        const existingUser = await db.collection('users').findOne({ email });
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
        
        const result = await db.collection('users').insertOne(newUser);
        
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

// 4. Obtenir offres
app.get('/api/offers', async (req, res) => {
    try {
        const offers = await db.collection('offers')
            .find({ isActive: true })
            .sort({ createdAt: -1 })
            .toArray();
        
        res.json({ success: true, offers });
    } catch (error) {
        console.error('Erreur chargement offres:', error);
        res.status(500).json({ success: false, message: 'Erreur de chargement' });
    }
});

// 5. Ajouter offre (admin)
app.post('/api/offers', authenticateToken, async (req, res) => {
    try {
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.userId) });
        
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Non autorisé' });
        }
        
        const { title, category, original_price, promo_price, description, image_url, badge } = req.body;
        
        if (!title || !category || !original_price) {
            return res.status(400).json({ success: false, message: 'Titre, catégorie et prix requis' });
        }
        
        const newOffer = {
            title,
            category,
            original_price: parseFloat(original_price),
            promo_price: promo_price ? parseFloat(promo_price) : null,
            description: description || '',
            image_url: image_url || '',
            badge: badge || null,
            isActive: true,
            createdBy: req.user.userId,
            createdAt: new Date()
        };
        
        const result = await db.collection('offers').insertOne(newOffer);
        newOffer._id = result.insertedId;
        
        io.emit('new_offer', newOffer);
        
        res.json({ success: true, offer: newOffer });
        
    } catch (error) {
        console.error('Erreur ajout offre:', error);
        res.status(500).json({ success: false, message: 'Erreur ajout offre' });
    }
});

// 6. Modifier offre
app.put('/api/offers/:id', authenticateToken, async (req, res) => {
    try {
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.userId) });
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Non autorisé' });
        }
        
        const { id } = req.params;
        const updateData = req.body;
        
        const result = await db.collection('offers').updateOne(
            { _id: new ObjectId(id) },
            { $set: { ...updateData, updatedAt: new Date() } }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'Offre non trouvée' });
        }
        
        res.json({ success: true, message: 'Offre mise à jour' });
    } catch (error) {
        console.error('Erreur modification offre:', error);
        res.status(500).json({ success: false, message: 'Erreur modification offre' });
    }
});

// 7. Supprimer offre
app.delete('/api/offers/:id', authenticateToken, async (req, res) => {
    try {
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.userId) });
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Non autorisé' });
        }
        
        const { id } = req.params;
        
        const result = await db.collection('offers').deleteOne({ _id: new ObjectId(id) });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'Offre non trouvée' });
        }
        
        res.json({ success: true, message: 'Offre supprimée' });
    } catch (error) {
        console.error('Erreur suppression offre:', error);
        res.status(500).json({ success: false, message: 'Erreur suppression offre' });
    }
});

// 8. Recharger solde
app.post('/api/payment/charge', authenticateToken, async (req, res) => {
    try {
        const { amount } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: 'Montant invalide' });
        }
        
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.userId) });
        const newBalance = (user.balance || 0) + parseFloat(amount);
        const newPoints = (user.points || 0) + Math.floor(amount);
        
        await db.collection('users').updateOne(
            { _id: new ObjectId(req.user.userId) },
            { 
                $set: { 
                    balance: newBalance,
                    points: newPoints 
                } 
            }
        );
        
        await db.collection('transactions').insertOne({
            userId: new ObjectId(req.user.userId),
            type: 'deposit',
            amount: parseFloat(amount),
            status: 'completed',
            createdAt: new Date()
        });
        
        res.json({
            success: true,
            newBalance,
            newPoints,
            message: 'Solde rechargé avec succès'
        });
        
    } catch (error) {
        console.error('Erreur recharge:', error);
        res.status(500).json({ success: false, message: 'Erreur recharge' });
    }
});

// 9. Réservation
app.post('/api/bookings', authenticateToken, async (req, res) => {
    try {
        const { offerId } = req.body;
        
        if (!offerId) {
            return res.status(400).json({ success: false, message: 'ID offre requis' });
        }
        
        const offer = await db.collection('offers').findOne({ _id: new ObjectId(offerId) });
        
        if (!offer) {
            return res.status(404).json({ success: false, message: 'Offre non trouvée' });
        }
        
        const price = offer.promo_price || offer.original_price;
        
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.userId) });
        
        if ((user.balance || 0) < price) {
            return res.status(400).json({ success: false, message: 'Solde insuffisant' });
        }
        
        const newBalance = (user.balance || 0) - price;
        await db.collection('users').updateOne(
            { _id: new ObjectId(req.user.userId) },
            { $set: { balance: newBalance } }
        );
        
        await db.collection('bookings').insertOne({
            userId: new ObjectId(req.user.userId),
            offerId: new ObjectId(offerId),
            bookingDate: new Date(),
            status: 'confirmed',
            totalPrice: price,
            createdAt: new Date()
        });
        
        await db.collection('transactions').insertOne({
            userId: new ObjectId(req.user.userId),
            type: 'payment',
            amount: price,
            status: 'completed',
            createdAt: new Date()
        });
        
        res.json({
            success: true,
            newBalance,
            message: 'Réservation réussie'
        });
        
    } catch (error) {
        console.error('Erreur réservation:', error);
        res.status(500).json({ success: false, message: 'Erreur réservation' });
    }
});

// 10. Mettre à jour profil
app.put('/api/profile/update', authenticateToken, async (req, res) => {
    try {
        const { name, phone } = req.body;
        
        if (!name) {
            return res.status(400).json({ success: false, message: 'Nom requis' });
        }
        
        await db.collection('users').updateOne(
            { _id: new ObjectId(req.user.userId) },
            { 
                $set: { 
                    name,
                    phone: phone || null
                } 
            }
        );
        
        res.json({ success: true, message: 'Profil mis à jour' });
    } catch (error) {
        console.error('Erreur mise à jour profil:', error);
        res.status(500).json({ success: false, message: 'Erreur mise à jour' });
    }
});

// 11. Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'API El Djamila en ligne',
        timestamp: new Date().toISOString()
    });
});

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

// ========== Démarrer serveur ==========
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});

process.on('SIGINT', async () => {
    if (client) {
        await client.close();
        console.log('MongoDB déconnecté');
    }
    process.exit(0);
});