const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/eldjamila', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// User Schema
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' },
    balance: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    phone: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

// Offer Schema
const offerSchema = new mongoose.Schema({
    title: { type: String, required: true },
    type: { type: String, required: true },
    description: { type: String },
    original_price: { type: Number, required: true },
    promo_price: { type: Number },
    image_url: { type: String },
    badge: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

// Live Session Schema
const liveSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    duration: { type: Number, default: 0 }, // in minutes
    status: { type: String, default: 'ended' }, // active, ended
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    viewers: { type: Number, default: 0 }
});

// Booking Schema
const bookingSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
    amount: { type: Number },
    status: { type: String, default: 'pending' },
    bookedAt: { type: Date, default: Date.now }
});

// Models
const User = mongoose.model('User', userSchema);
const Offer = mongoose.model('Offer', offerSchema);
const Live = mongoose.model('Live', liveSchema);
const Booking = mongoose.model('Booking', bookingSchema);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'eldjamila-secret-key';

// Auth Middleware
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Token manquant' 
            });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId);
        
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Utilisateur non trouvé' 
            });
        }
        
        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        res.status(401).json({ 
            success: false, 
            message: 'Token invalide' 
        });
    }
};

// ========== AUTH ROUTES ==========

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email déjà utilisé'
            });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const user = new User({
            name,
            email,
            password: hashedPassword,
            balance: 50, // Bonus d'inscription
            points: 50
        });
        
        await user.save();
        
        // Generate token
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
        
        res.json({
            success: true,
            message: 'Inscription réussie',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                balance: user.balance,
                points: user.points
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Email ou mot de passe incorrect'
            });
        }
        
        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({
                success: false,
                message: 'Email ou mot de passe incorrect'
            });
        }
        
        // Generate token
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
        
        res.json({
            success: true,
            message: 'Connexion réussie',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                balance: user.balance,
                points: user.points
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });
    }
});

// Verify Token
app.get('/api/auth/verify', authMiddleware, async (req, res) => {
    try {
        res.json({
            success: true,
            user: {
                id: req.user._id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role,
                balance: req.user.balance,
                points: req.user.points
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erreur de vérification'
        });
    }
});

// ========== OFFERS ROUTES ==========

// Get all offers
app.get('/api/offers', async (req, res) => {
    try {
        const offers = await Offer.find().sort({ createdAt: -1 });
        
        res.json({
            success: true,
            offers: offers.map(offer => ({
                id: offer._id,
                title: offer.title,
                type: offer.type,
                description: offer.description,
                original_price: offer.original_price,
                promo_price: offer.promo_price,
                image_url: offer.image_url || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
                badge: offer.badge,
                createdAt: offer.createdAt
            }))
        });
    } catch (error) {
        console.error('Get offers error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement des offres'
        });
    }
});

// Create offer (Admin only)
app.post('/api/offers/create', authMiddleware, async (req, res) => {
    try {
        // Check if admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Accès non autorisé'
            });
        }
        
        const { title, type, description, original_price, promo_price, image_url, badge } = req.body;
        
        const offer = new Offer({
            title,
            type,
            description,
            original_price,
            promo_price: promo_price || null,
            image_url: image_url || null,
            badge: badge || null,
            createdBy: req.user._id
        });
        
        await offer.save();
        
        res.json({
            success: true,
            message: 'Offre créée avec succès',
            offer: {
                id: offer._id,
                title: offer.title,
                type: offer.type,
                description: offer.description,
                original_price: offer.original_price,
                promo_price: offer.promo_price,
                image_url: offer.image_url,
                badge: offer.badge
            }
        });
    } catch (error) {
        console.error('Create offer error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de l\'offre'
        });
    }
});

// Book offer
app.post('/api/offers/book', authMiddleware, async (req, res) => {
    try {
        const { offerId } = req.body;
        
        // Get offer
        const offer = await Offer.findById(offerId);
        if (!offer) {
            return res.status(404).json({
                success: false,
                message: 'Offre non trouvée'
            });
        }
        
        // Calculate price
        const price = offer.promo_price || offer.original_price;
        
        // Check user balance
        if (req.user.balance < price) {
            return res.status(400).json({
                success: false,
                message: 'Solde insuffisant'
            });
        }
        
        // Update user balance
        req.user.balance -= price;
        req.user.points += Math.floor(price); // 1 point per 1€
        await req.user.save();
        
        // Create booking
        const booking = new Booking({
            userId: req.user._id,
            offerId: offer._id,
            amount: price
        });
        
        await booking.save();
        
        res.json({
            success: true,
            message: 'Réservation effectuée',
            userBalance: req.user.balance,
            userPoints: req.user.points,
            user: {
                id: req.user._id,
                name: req.user.name,
                email: req.user.email,
                balance: req.user.balance,
                points: req.user.points
            }
        });
    } catch (error) {
        console.error('Book offer error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la réservation'
        });
    }
});

// ========== USER ROUTES ==========

// Update user profile
app.put('/api/user/update', authMiddleware, async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        
        // Check if email is taken by another user
        if (email !== req.user.email) {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Email déjà utilisé par un autre compte'
                });
            }
        }
        
        // Update user
        req.user.name = name || req.user.name;
        req.user.email = email || req.user.email;
        req.user.phone = phone || req.user.phone;
        
        await req.user.save();
        
        res.json({
            success: true,
            message: 'Profil mis à jour',
            user: {
                id: req.user._id,
                name: req.user.name,
                email: req.user.email,
                phone: req.user.phone,
                role: req.user.role,
                balance: req.user.balance,
                points: req.user.points
            }
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour du profil'
        });
    }
});

// Charge balance (Admin only)
app.post('/api/user/charge', authMiddleware, async (req, res) => {
    try {
        // Check if admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Accès non autorisé'
            });
        }
        
        const { amount } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Montant invalide'
            });
        }
        
        // Update user balance
        req.user.balance += parseFloat(amount);
        req.user.points += Math.floor(amount);
        
        await req.user.save();
        
        res.json({
            success: true,
            message: 'Rechargement effectué',
            balance: req.user.balance,
            points: req.user.points,
            user: {
                id: req.user._id,
                name: req.user.name,
                balance: req.user.balance,
                points: req.user.points
            }
        });
    } catch (error) {
        console.error('Charge error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du rechargement'
        });
    }
});

// Search users (Admin only)
app.get('/api/users/search', authMiddleware, async (req, res) => {
    try {
        // Check if admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Accès non autorisé'
            });
        }
        
        const { q } = req.query;
        
        if (!q || q.trim() === '') {
            return res.json({
                success: true,
                users: [],
                message: 'Veuillez entrer un terme de recherche'
            });
        }
        
        const users = await User.find({
            $or: [
                { name: { $regex: q, $options: 'i' } },
                { email: { $regex: q, $options: 'i' } }
            ]
        }).select('-password').limit(10);
        
        res.json({
            success: true,
            users: users.map(user => ({
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                balance: user.balance,
                points: user.points,
                createdAt: user.createdAt
            }))
        });
    } catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la recherche'
        });
    }
});

// ========== LIVE ROUTES ==========

// Get live sessions
app.get('/api/live/sessions', async (req, res) => {
    try {
        const sessions = await Live.find()
            .sort({ startTime: -1 })
            .limit(10)
            .populate('createdBy', 'name');
        
        res.json({
            success: true,
            sessions: sessions.map(session => ({
                id: session._id,
                title: session.title,
                description: session.description,
                startTime: session.startTime,
                duration: session.duration,
                status: session.status,
                viewers: session.viewers,
                createdBy: session.createdBy?.name || 'Admin'
            }))
        });
    } catch (error) {
        console.error('Get live sessions error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement des séances'
        });
    }
});

// Get live statistics
app.get('/api/live/stats', authMiddleware, async (req, res) => {
    try {
        const totalSessions = await Live.countDocuments();
        const activeSessions = await Live.countDocuments({ status: 'active' });
        
        // Calculate total duration
        const sessions = await Live.find({});
        const totalDuration = sessions.reduce((sum, session) => sum + (session.duration || 0), 0);
        
        res.json({
            success: true,
            stats: {
                totalSessions,
                activeSessions,
                totalDuration: Math.round(totalDuration / 60), // convert to hours
                avgDuration: totalSessions > 0 ? Math.round((totalDuration / totalSessions) / 60) : 0
            }
        });
    } catch (error) {
        console.error('Get live stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement des statistiques'
        });
    }
});

// Create live session (Admin only)
app.post('/api/live/create', authMiddleware, async (req, res) => {
    try {
        // Check if admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Accès non autorisé'
            });
        }
        
        const { title, description } = req.body;
        
        const liveSession = new Live({
            title,
            description,
            createdBy: req.user._id,
            status: 'active'
        });
        
        await liveSession.save();
        
        res.json({
            success: true,
            message: 'Séance en direct démarrée',
            session: {
                id: liveSession._id,
                title: liveSession.title,
                description: liveSession.description,
                startTime: liveSession.startTime
            }
        });
    } catch (error) {
        console.error('Create live session error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du démarrage de la séance'
        });
    }
});

// ========== ADMIN STATS ==========

// Get admin statistics
app.get('/api/admin/stats', authMiddleware, async (req, res) => {
    try {
        // Check if admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Accès non autorisé'
            });
        }
        
        const totalOffers = await Offer.countDocuments();
        const totalUsers = await User.countDocuments();
        
        // Calculate total revenue from bookings
        const bookings = await Booking.find({});
        const totalRevenue = bookings.reduce((sum, booking) => sum + (booking.amount || 0), 0);
        
        res.json({
            success: true,
            stats: {
                totalOffers,
                totalUsers,
                totalRevenue
            }
        });
    } catch (error) {
        console.error('Get admin stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement des statistiques'
        });
    }
});

// ========== INITIAL DATA ==========

// Create admin user if not exists
async function createAdminUser() {
    try {
        const adminExists = await User.findOne({ email: 'admin@eldjamila.com' });
        
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            
            const adminUser = new User({
                name: 'El Djamila Admin',
                email: 'admin@eldjamila.com',
                password: hashedPassword,
                role: 'admin',
                balance: 10000,
                points: 10000
            });
            
            await adminUser.save();
            console.log('✅ Admin user created');
        }
        
        // Create sample offers if none exist
        const offerCount = await Offer.countDocuments();
        if (offerCount === 0) {
            const sampleOffers = [
                {
                    title: 'Coiffure de Mariée Élégante',
                    type: 'Coiffure Spéciale',
                    description: 'Coiffure sophistiquée pour votre jour spécial avec essai préalable inclus.',
                    original_price: 220,
                    promo_price: 180,
                    badge: 'TOP'
                },
                {
                    title: 'Balayage Premium',
                    type: 'Couleur',
                    description: 'Technique de coloration professionnelle avec produits haute qualité.',
                    original_price: 160,
                    promo_price: 135,
                    badge: 'PROMO'
                },
                {
                    title: 'Traitement Revitalisant',
                    type: 'Soin',
                    description: 'Soin profond pour cheveux abîmés avec produits professionnels.',
                    original_price: 95,
                    promo_price: 80,
                    badge: 'NOUVEAU'
                }
            ];
            
            await Offer.insertMany(sampleOffers);
            console.log('✅ Sample offers created');
        }
    } catch (error) {
        console.error('Error creating initial data:', error);
    }
}

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    createAdminUser();
});

module.exports = app;