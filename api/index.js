const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// ========== CONFIGURATION =========
app.use(helmet({
    contentSecurityPolicy: false
}));
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

console.log('✨ API El Djamila Salon - Design Élégant');

// ========== COULEURS & STYLE (CSS Variables) ==========
const designConfig = {
    colors: {
        primary: '#E75480', // Rose salon
        secondary: '#FFB6C1', // Rose clair
        accent: '#FFD700', // Or
        success: '#4CAF50', // Vert élégant
        warning: '#FF9800', // Orange doux
        error: '#F44336', // Rouge doux
        dark: '#333333',
        light: '#FFF0F5',
        white: '#FFFFFF',
        gray: '#888888'
    },
    shadows: {
        light: '0 4px 12px rgba(231, 84, 128, 0.1)',
        medium: '0 8px 24px rgba(231, 84, 128, 0.15)',
        heavy: '0 12px 32px rgba(231, 84, 128, 0.2)',
        gold: '0 6px 20px rgba(255, 215, 0, 0.3)'
    },
    borderRadius: {
        small: '8px',
        medium: '12px',
        large: '16px',
        xlarge: '20px'
    }
};

// ========== CONNEXION MONGODB ==========
let db = null;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://eldjamila-cluster:YueVW02QRkSSPyzT@ac-duaqchc-shard-00-00.cmsgoyg.mongodb.net/eldjamila_db?retryWrites=true&w=majority&appName=Cluster0';
const JWT_SECRET = process.env.JWT_SECRET || 'eldjamila-secret-elegant-2024';

async function connectDB() {
    if (db) return db;
    
    try {
        const client = new MongoClient(MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 10000,
            socketTimeoutMS: 30000,
            maxPoolSize: 10,
        });
        
        await client.connect();
        db = client.db('eldjamila_db');
        
        await db.command({ ping: 1 });
        console.log('✅ Connecté à MongoDB Atlas');
        
        await initEmptyDatabase(db);
        
        return db;
        
    } catch (error) {
        console.error('❌ Erreur MongoDB:', error.message);
        return null;
    }
}

async function initEmptyDatabase(database) {
    const collections = await database.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);
    
    const requiredCollections = ['users', 'offres', 'reservations', 'transactions', 'concours', 'categories'];
    
    for (const collectionName of requiredCollections) {
        if (!collectionNames.includes(collectionName)) {
            await database.createCollection(collectionName);
            console.log(`📁 Collection créée: ${collectionName}`);
            
            // Indexes uniquement
            if (collectionName === 'users') {
                await database.collection('users').createIndex({ email: 1 }, { unique: true });
            }
            if (collectionName === 'offres') {
                await database.collection('offres').createIndex({ isActive: 1 });
                await database.collection('offres').createIndex({ category: 1 });
            }
        }
    }
    
    // PAS de données par défaut - l'admin ajoute tout
    console.log('💎 Base de données vide prête - Admin ajoutera tout');
}

// ========== MIDDLEWARE ==========
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Token d\'accès requis',
            design: {
                color: designConfig.colors.warning,
                icon: '🔐'
            }
        });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                message: 'Token invalide ou expiré',
                design: {
                    color: designConfig.colors.error,
                    icon: '⛔'
                }
            });
        }
        req.user = user;
        next();
    });
};

const isAdmin = async (req, res, next) => {
    try {
        const database = await connectDB();
        if (!database) {
            return res.status(500).json({
                success: false,
                message: 'Base de données indisponible',
                design: { icon: '💾' }
            });
        }
        
        const user = await database.collection('users').findOne({
            _id: new ObjectId(req.user.userId)
        });
        
        if (!user || user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Accès réservé aux administrateurs',
                design: {
                    color: designConfig.colors.error,
                    icon: '👑'
                }
            });
        }
        
        next();
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erreur de vérification des permissions',
            error: error.message
        });
    }
};

// ========== FORMATAGE RÉPONSES ==========
const formatResponse = (success, message, data = null, options = {}) => {
    const response = {
        success,
        message,
        timestamp: new Date().toISOString(),
        design: {
            color: success ? designConfig.colors.success : designConfig.colors.error,
            icon: success ? '✅' : '❌',
            ...options.design
        }
    };
    
    if (data !== null) {
        response.data = data;
    }
    
    return response;
};

// ========== ROUTES API ==========

// 1. Health Check
app.get('/api/health', async (req, res) => {
    try {
        const database = await connectDB();
        
        if (database) {
            const usersCount = await database.collection('users').countDocuments();
            const offresCount = await database.collection('offres').countDocuments();
            const concoursCount = await database.collection('concours').countDocuments();
            
            res.json(formatResponse(true, 'API El Djamila opérationnelle', {
                database: {
                    status: 'connecté',
                    cluster: 'Cluster0',
                    collections: {
                        utilisateurs: usersCount,
                        offres: offresCount,
                        concours: concoursCount
                    }
                },
                server: {
                    node: process.version,
                    uptime: process.uptime()
                },
                note: 'Base vide - Admin ajoute tout via l\'interface'
            }, {
                design: { icon: '💖', color: designConfig.colors.primary }
            }));
        } else {
            res.status(500).json(formatResponse(false, 'Base de données non connectée'));
        }
        
    } catch (error) {
        res.status(500).json(formatResponse(false, 'Erreur de vérification', null, {
            design: { icon: '⚠️' }
        }));
    }
});

// 2. Inscription Utilisateur
app.post('/api/auth/register', async (req, res) => {
    console.log('📝 Nouvelle inscription reçue');
    
    try {
        const { name, email, password } = req.body;
        
        // Validation
        if (!name || !email || !password) {
            return res.status(400).json(formatResponse(false, 'Nom, email et mot de passe requis', null, {
                design: { icon: '📝' }
            }));
        }
        
        if (password.length < 6) {
            return res.status(400).json(formatResponse(false, 'Mot de passe 6 caractères minimum', null, {
                design: { icon: '🔒' }
            }));
        }
        
        const database = await connectDB();
        
        if (!database) {
            return res.status(500).json(formatResponse(false, 'Base de données indisponible'));
        }
        
        // Vérifier si l'utilisateur existe
        const existingUser = await database.collection('users').findOne({
            email: email.toLowerCase().trim()
        });
        
        if (existingUser) {
            return res.status(400).json(formatResponse(false, 'Cet email est déjà utilisé', null, {
                design: { icon: '📧' }
            }));
        }
        
        // Hasher le mot de passe
        const passwordHash = await bcrypt.hash(password, 10);
        
        // Créer l'utilisateur
        const newUser = {
            name: name.trim(),
            email: email.toLowerCase().trim(),
            passwordHash,
            role: 'user',
            balance: 0, // Solde à 0 par défaut
            points: 0,  // Points à 0 par défaut
            avatar: null,
            phone: null,
            address: null,
            preferences: {
                notifications: true,
                newsletter: true,
                theme: 'light'
            },
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastLogin: null
        };
        
        const result = await database.collection('users').insertOne(newUser);
        
        // Créer le token JWT
        const token = jwt.sign(
            {
                userId: result.insertedId.toString(),
                email: newUser.email,
                role: newUser.role,
                name: newUser.name
            },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        // Réponse de succès
        res.status(201).json(formatResponse(true, '🎉 Inscription réussie ! Bienvenue chez El Djamila', {
            token,
            user: {
                id: result.insertedId,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                balance: newUser.balance,
                points: newUser.points,
                preferences: newUser.preferences,
                memberSince: newUser.createdAt
            }
        }, {
            design: {
                icon: '✨',
                color: designConfig.colors.primary,
                animation: 'bounce'
            }
        }));
        
    } catch (error) {
        console.error('Erreur inscription:', error);
        
        res.status(500).json(formatResponse(false, 'Erreur lors de l\'inscription', null, {
            design: { icon: '😔' }
        }));
    }
});

// 3. Connexion Utilisateur
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json(formatResponse(false, 'Email et mot de passe requis'));
        }
        
        const database = await connectDB();
        
        if (!database) {
            return res.status(500).json(formatResponse(false, 'Base de données indisponible'));
        }
        
        // Trouver l'utilisateur
        const user = await database.collection('users').findOne({
            email: email.toLowerCase().trim(),
            isActive: true
        });
        
        if (!user) {
            return res.status(401).json(formatResponse(false, 'Email ou mot de passe incorrect', null, {
                design: { icon: '🔍' }
            }));
        }
        
        // Vérifier le mot de passe
        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) {
            return res.status(401).json(formatResponse(false, 'Email ou mot de passe incorrect', null, {
                design: { icon: '🔒' }
            }));
        }
        
        // Mettre à jour la dernière connexion
        await database.collection('users').updateOne(
            { _id: user._id },
            { $set: { lastLogin: new Date() } }
        );
        
        // Créer le token
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
        
        res.json(formatResponse(true, '✅ Connexion réussie !', {
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                balance: user.balance || 0,
                points: user.points || 0,
                avatar: user.avatar,
                phone: user.phone,
                preferences: user.preferences || {},
                memberSince: user.createdAt,
                lastLogin: new Date()
            }
        }, {
            design: {
                icon: '👋',
                color: designConfig.colors.success
            }
        }));
        
    } catch (error) {
        console.error('Erreur connexion:', error);
        res.status(500).json(formatResponse(false, 'Erreur lors de la connexion'));
    }
});

// 4. Vérifier Token
app.get('/api/auth/verify', authenticateToken, async (req, res) => {
    try {
        const database = await connectDB();
        
        if (!database) {
            return res.status(500).json(formatResponse(false, 'Base de données indisponible'));
        }
        
        const user = await database.collection('users').findOne(
            { _id: new ObjectId(req.user.userId) },
            { projection: { passwordHash: 0 } }
        );
        
        if (!user) {
            return res.status(404).json(formatResponse(false, 'Utilisateur non trouvé'));
        }
        
        res.json(formatResponse(true, 'Session valide', {
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                balance: user.balance || 0,
                points: user.points || 0,
                avatar: user.avatar,
                phone: user.phone,
                preferences: user.preferences || {},
                memberSince: user.createdAt,
                isActive: user.isActive
            }
        }, {
            design: { icon: '👤', color: designConfig.colors.primary }
        }));
        
    } catch (error) {
        console.error('Erreur vérification:', error);
        res.status(500).json(formatResponse(false, 'Erreur de vérification'));
    }
});

// 5. Obtenir les Offres (vide au début)
app.get('/api/offers', async (req, res) => {
    try {
        const database = await connectDB();
        
        if (!database) {
            return res.status(500).json(formatResponse(false, 'Base de données indisponible'));
        }
        
        const offres = await database.collection('offres')
            .find({ isActive: true })
            .sort({ createdAt: -1 })
            .toArray();
        
        // Retourner la liste (vide au début)
        res.json(formatResponse(true, 'Offres disponibles', {
            offres: offres,
            count: offres.length,
            message: offres.length === 0 
                ? 'Aucune offre disponible - L\'admin ajoutera les premières offres' 
                : `${offres.length} offre(s) disponible(s)`
        }, {
            design: {
                icon: offres.length === 0 ? '📭' : '📋',
                color: offres.length === 0 ? designConfig.colors.gray : designConfig.colors.primary
            }
        }));
        
    } catch (error) {
        console.error('Erreur chargement offres:', error);
        res.status(500).json(formatResponse(false, 'Erreur chargement offres'));
    }
});

// 6. Créer une Offre (Admin seulement)
app.post('/api/offers', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { 
            title, 
            description, 
            price, 
            originalPrice, 
            category, 
            duration, 
            imageUrl,
            badge,
            promotion,
            isFeatured 
        } = req.body;
        
        if (!title || !price || !category) {
            return res.status(400).json(formatResponse(false, 'Titre, prix et catégorie requis'));
        }
        
        const database = await connectDB();
        
        if (!database) {
            return res.status(500).json(formatResponse(false, 'Base de données indisponible'));
        }
        
        const newOffer = {
            title: title.trim(),
            description: description || '',
            price: parseFloat(price),
            originalPrice: originalPrice ? parseFloat(originalPrice) : parseFloat(price),
            category: category.trim(),
            duration: duration || '1 heure',
            imageUrl: imageUrl || '/images/default-service.jpg',
            badge: badge || null,
            promotion: promotion || null,
            isFeatured: isFeatured || false,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: req.user.userId
        };
        
        // Calculer le pourcentage de promotion si originalPrice > price
        if (newOffer.originalPrice > newOffer.price) {
            const discount = ((newOffer.originalPrice - newOffer.price) / newOffer.originalPrice) * 100;
            newOffer.discountPercent = Math.round(discount);
        }
        
        const result = await database.collection('offres').insertOne(newOffer);
        newOffer._id = result.insertedId;
        
        res.status(201).json(formatResponse(true, '✨ Offre créée avec succès', {
            offer: newOffer
        }, {
            design: {
                icon: '🎨',
                color: designConfig.colors.success,
                animation: 'fadeIn'
            }
        }));
        
    } catch (error) {
        console.error('Erreur création offre:', error);
        res.status(500).json(formatResponse(false, 'Erreur création offre'));
    }
});

// 7. Obtenir les Concours (vide au début)
app.get('/api/contests', async (req, res) => {
    try {
        const database = await connectDB();
        
        if (!database) {
            return res.status(500).json(formatResponse(false, 'Base de données indisponible'));
        }
        
        const concours = await database.collection('concours')
            .find({ isActive: true })
            .sort({ endDate: 1 })
            .toArray();
        
        res.json(formatResponse(true, 'Concours actifs', {
            concours: concours,
            count: concours.length,
            message: concours.length === 0 
                ? 'Aucun concours actif - L\'admin créera les premiers concours' 
                : `${concours.length} concours actif(s)`
        }, {
            design: {
                icon: concours.length === 0 ? '🏆' : '🎯',
                color: designConfig.colors.accent
            }
        }));
        
    } catch (error) {
        console.error('Erreur chargement concours:', error);
        res.status(500).json(formatResponse(false, 'Erreur chargement concours'));
    }
});

// 8. Statut en Direct
app.get('/api/live', async (req, res) => {
    try {
        const database = await connectDB();
        
        let stats = {};
        if (database) {
            const usersCount = await database.collection('users').countDocuments();
            const offresCount = await database.collection('offres').countDocuments({ isActive: true });
            const reservationsCount = await database.collection('reservations').countDocuments({ 
                status: 'confirmed' 
            });
            
            stats = {
                users: usersCount,
                offres: offresCount,
                reservations: reservationsCount
            };
        }
        
        const liveStatus = {
            salon: {
                name: 'El Djamila Salon',
                status: 'Ouvert',
                hours: '09:00 - 22:00',
                days: 'Lundi - Dimanche',
                address: 'Paris, France',
                phone: '+33 1 23 45 67 89'
            },
            server: {
                time: new Date().toLocaleTimeString('fr-FR'),
                date: new Date().toLocaleDateString('fr-FR', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                }),
                uptime: process.uptime()
            },
            statistics: stats,
            design: {
                theme: 'elegant',
                colors: designConfig.colors,
                version: '2.0.0'
            }
        };
        
        res.json(formatResponse(true, '🌺 Salon El Djamila - Statut en direct', liveStatus, {
            design: {
                icon: '💐',
                color: designConfig.colors.primary,
                gradient: 'linear-gradient(135deg, #E75480, #FFB6C1)'
            }
        }));
        
    } catch (error) {
        console.error('Erreur statut live:', error);
        res.status(500).json(formatResponse(false, 'Erreur statut live'));
    }
});

// 9. Mettre à jour le Profil
app.put('/api/profile', authenticateToken, async (req, res) => {
    try {
        const { name, phone, address, preferences } = req.body;
        
        const database = await connectDB();
        
        if (!database) {
            return res.status(500).json(formatResponse(false, 'Base de données indisponible'));
        }
        
        const updateData = {
            updatedAt: new Date()
        };
        
        if (name) updateData.name = name.trim();
        if (phone) updateData.phone = phone;
        if (address) updateData.address = address;
        if (preferences) updateData.preferences = preferences;
        
        await database.collection('users').updateOne(
            { _id: new ObjectId(req.user.userId) },
            { $set: updateData }
        );
        
        res.json(formatResponse(true, '📝 Profil mis à jour avec succès', {
            updated: updateData
        }, {
            design: { icon: '✏️', color: designConfig.colors.success }
        }));
        
    } catch (error) {
        console.error('Erreur mise à jour profil:', error);
        res.status(500).json(formatResponse(false, 'Erreur mise à jour profil'));
    }
});

// 10. Recharger le Solde
app.post('/api/payment/charge', authenticateToken, async (req, res) => {
    try {
        const { amount, method } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json(formatResponse(false, 'Montant invalide'));
        }
        
        const database = await connectDB();
        
        if (!database) {
            return res.status(500).json(formatResponse(false, 'Base de données indisponible'));
        }
        
        const user = await database.collection('users').findOne({
            _id: new ObjectId(req.user.userId)
        });
        
        const newBalance = (user.balance || 0) + parseFloat(amount);
        const pointsEarned = Math.floor(amount / 10); // 1 point pour 10€
        const newPoints = (user.points || 0) + pointsEarned;
        
        await database.collection('users').updateOne(
            { _id: new ObjectId(req.user.userId) },
            { 
                $set: { 
                    balance: newBalance,
                    points: newPoints
                } 
            }
        );
        
        // Enregistrer la transaction
        const transaction = {
            userId: new ObjectId(req.user.userId),
            type: 'deposit',
            amount: parseFloat(amount),
            method: method || 'card',
            status: 'completed',
            balanceBefore: user.balance || 0,
            balanceAfter: newBalance,
            pointsEarned: pointsEarned,
            createdAt: new Date()
        };
        
        await database.collection('transactions').insertOne(transaction);
        
        res.json(formatResponse(true, '💳 Rechargement réussi !', {
            newBalance,
            newPoints,
            pointsEarned,
            transaction: {
                id: transaction._id,
                amount: transaction.amount,
                method: transaction.method,
                date: transaction.createdAt
            }
        }, {
            design: {
                icon: '💰',
                color: designConfig.colors.accent,
                animation: 'bounce'
            }
        }));
        
    } catch (error) {
        console.error('Erreur rechargement:', error);
        res.status(500).json(formatResponse(false, 'Erreur rechargement'));
    }
});

// 11. Faire une Réservation
app.post('/api/bookings', authenticateToken, async (req, res) => {
    try {
        const { offerId, date, time, notes } = req.body;
        
        if (!offerId) {
            return res.status(400).json(formatResponse(false, 'ID offre requis'));
        }
        
        const database = await connectDB();
        
        if (!database) {
            return res.status(500).json(formatResponse(false, 'Base de données indisponible'));
        }
        
        const offer = await database.collection('offres').findOne({
            _id: new ObjectId(offerId),
            isActive: true
        });
        
        if (!offer) {
            return res.status(404).json(formatResponse(false, 'Offre non trouvée'));
        }
        
        const user = await database.collection('users').findOne({
            _id: new ObjectId(req.user.userId)
        });
        
        const price = offer.promotion || offer.price;
        
        // Vérifier le solde
        if ((user.balance || 0) < price) {
            return res.status(400).json(formatResponse(false, 'Solde insuffisant', {
                required: price,
                current: user.balance || 0,
                missing: price - (user.balance || 0)
            }, {
                design: { icon: '💸', color: designConfig.colors.warning }
            }));
        }
        
        // Déduire le prix
        const newBalance = (user.balance || 0) - price;
        await database.collection('users').updateOne(
            { _id: new ObjectId(req.user.userId) },
            { $set: { balance: newBalance } }
        );
        
        // Créer la réservation
        const booking = {
            userId: new ObjectId(req.user.userId),
            offerId: new ObjectId(offerId),
            offerTitle: offer.title,
            offerPrice: price,
            bookingDate: date ? new Date(date) : new Date(),
            bookingTime: time || '14:00',
            notes: notes || '',
            status: 'confirmed',
            totalPrice: price,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        const result = await database.collection('reservations').insertOne(booking);
        booking._id = result.insertedId;
        
        // Enregistrer la transaction
        await database.collection('transactions').insertOne({
            userId: new ObjectId(req.user.userId),
            type: 'payment',
            amount: price,
            description: `Réservation: ${offer.title}`,
            status: 'completed',
            bookingId: booking._id,
            createdAt: new Date()
        });
        
        res.json(formatResponse(true, '✅ Réservation confirmée !', {
            booking: {
                id: booking._id,
                offer: offer.title,
                price: booking.totalPrice,
                date: booking.bookingDate,
                time: booking.bookingTime,
                status: booking.status
            },
            newBalance,
            receipt: {
                number: `RES-${Date.now()}`,
                date: new Date()
            }
        }, {
            design: {
                icon: '📅',
                color: designConfig.colors.success,
                animation: 'confetti'
            }
        }));
        
    } catch (error) {
        console.error('Erreur réservation:', error);
        res.status(500).json(formatResponse(false, 'Erreur réservation'));
    }
});

// 12. Récupérer les Catégories
app.get('/api/categories', async (req, res) => {
    try {
        const database = await connectDB();
        
        if (!database) {
            return res.status(500).json(formatResponse(false, 'Base de données indisponible'));
        }
        
        // Pour commencer, quelques catégories par défaut
        const defaultCategories = [
            { id: 'coiffure', name: 'Coiffure', icon: '✂️', color: designConfig.colors.primary },
            { id: 'coloration', name: 'Coloration', icon: '🎨', color: '#9C27B0' },
            { id: 'soins', name: 'Soins', icon: '💆', color: '#4CAF50' },
            { id: 'esthetique', name: 'Esthétique', icon: '💅', color: '#FF9800' },
            { id: 'special', name: 'Spécial', icon: '⭐', color: designConfig.colors.accent }
        ];
        
        res.json(formatResponse(true, 'Catégories disponibles', {
            categories: defaultCategories
        }, {
            design: { icon: '📁', color: designConfig.colors.primary }
        }));
        
    } catch (error) {
        console.error('Erreur catégories:', error);
        res.status(500).json(formatResponse(false, 'Erreur catégories'));
    }
});

// 13. Route Racine avec Design
app.get('/', (req, res) => {
    const welcomePage = {
        success: true,
        message: '🌸 Bienvenue sur l\'API El Djamila Salon',
        version: '2.0.0',
        description: 'API élégante pour la gestion du salon de coiffure',
        design: {
            theme: 'elegant-rose',
            colors: designConfig.colors,
            typography: 'Montserrat & Inter',
            shadows: designConfig.shadows,
            borderRadius: designConfig.borderRadius
        },
        endpoints: {
            health: { method: 'GET', path: '/api/health', description: 'Vérifier l\'état de l\'API' },
            register: { method: 'POST', path: '/api/auth/register', description: 'Inscription utilisateur' },
            login: { method: 'POST', path: '/api/auth/login', description: 'Connexion utilisateur' },
            offers: { method: 'GET', path: '/api/offers', description: 'Liste des offres' },
            contests: { method: 'GET', path: '/api/contests', description: 'Concours actifs' },
            live: { method: 'GET', path: '/api/live', description: 'Statut en direct' },
            profile: { method: 'PUT', path: '/api/profile', description: 'Mettre à jour le profil' },
            charge: { method: 'POST', path: '/api/payment/charge', description: 'Recharger le solde' },
            bookings: { method: 'POST', path: '/api/bookings', description: 'Faire une réservation' },
            categories: { method: 'GET', path: '/api/categories', description: 'Catégories disponibles' }
        },
        note: '💎 Base de données vide au départ - L\'admin ajoute tout via l\'interface',
        timestamp: new Date().toISOString()
    };
    
    res.json(welcomePage);
});

// ========== GESTION ERREURS ==========
app.use((req, res) => {
    res.status(404).json(formatResponse(false, `Route non trouvée: ${req.method} ${req.url}`, null, {
        design: { icon: '🔍', color: designConfig.colors.warning }
    }));
});

app.use((err, req, res, next) => {
    console.error('❌ Erreur serveur:', err);
    res.status(500).json(formatResponse(false, 'Erreur interne du serveur', null, {
        design: { icon: '💥', color: designConfig.colors.error }
    }));
});

// ========== DÉMARRAGE SERVEUR ==========
const PORT = process.env.PORT || 3000;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`✨ Serveur démarré sur le port ${PORT}`);
        console.log(`🎨 Design: Élégant & Moderne`);
        console.log(`💾 Base de données: Vide - Admin ajoute tout`);
        console.log(`🌺 Couleurs: ${JSON.stringify(designConfig.colors)}`);
    });
}

module.exports = app;