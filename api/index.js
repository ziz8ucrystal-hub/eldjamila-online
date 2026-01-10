const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// ========== IN-MEMORY DATABASE ==========
let users = [];
let offers = [];
let bookings = [];
let liveSessions = [];

// Initialize sample data
function initializeSampleData() {
    // Sample users
    users = [
        {
            id: '1',
            name: 'El Djamila Admin',
            email: 'admin@eldjamila.com',
            password: '$2a$10$X1xX5J5X5X5X5X5X5X5X5e', // admin123
            role: 'admin',
            balance: 10000,
            points: 10000,
            phone: ''
        },
        {
            id: '2',
            name: 'Test User',
            email: 'test@user.com',
            password: '$2a$10$X1xX5J5X5X5X5X5X5X5X5f', // 123456
            role: 'user',
            balance: 500,
            points: 500,
            phone: ''
        }
    ];

    // Sample offers
    offers = [
        {
            id: '1',
            title: 'Coiffure de Mariée Élégante',
            type: 'Coiffure de mariage',
            description: 'Coiffure sophistiquée pour votre jour spécial avec essai préalable inclus.',
            original_price: 220,
            promo_price: 180,
            badge: 'TOP',
            image_url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80'
        },
        {
            id: '2',
            title: 'Balayage Premium',
            type: 'Couleur',
            description: 'Technique de coloration professionnelle avec produits haute qualité.',
            original_price: 160,
            promo_price: 135,
            badge: 'PROMO',
            image_url: 'https://images.unsplash.com/photo-1596703923338-48f1c07e4f2e?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80'
        }
    ];
}

// Initialize data
initializeSampleData();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'eldjamila-secret-key-2024';

// ========== AUTH ROUTES ==========

// Health Check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'El Djamila API is running',
        timestamp: new Date().toISOString(),
        database: 'in-memory',
        usersCount: users.length,
        offersCount: offers.length
    });
});

// Register User
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Tous les champs sont requis'
            });
        }
        
        // Check if user exists
        const existingUser = users.find(u => u.email === email.toLowerCase());
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email déjà utilisé'
            });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user with bonus
        const newUser = {
            id: Date.now().toString(),
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            role: 'user',
            balance: 50, // Bonus d'inscription
            points: 50,
            phone: ''
        };
        
        users.push(newUser);
        
        // Generate token
        const token = jwt.sign(
            { userId: newUser.id, email: newUser.email, role: newUser.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            success: true,
            message: 'Inscription réussie',
            token,
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                balance: newUser.balance,
                points: newUser.points,
                phone: newUser.phone
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'inscription'
        });
    }
});

// Login User
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email et mot de passe requis'
            });
        }
        
        // Find user
        const user = users.find(u => u.email === email.toLowerCase());
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
        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            success: true,
            message: 'Connexion réussie',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                balance: user.balance,
                points: user.points,
                phone: user.phone
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la connexion'
        });
    }
});

// Verify Token (Middleware)
const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false, 
                message: 'Token manquant ou invalide' 
            });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const user = users.find(u => u.id === decoded.userId);
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Utilisateur non trouvé' 
            });
        }
        
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ 
            success: false, 
            message: 'Token invalide ou expiré' 
        });
    }
};

app.get('/api/auth/verify', authMiddleware, (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role,
            balance: req.user.balance,
            points: req.user.points,
            phone: req.user.phone
        }
    });
});

// ========== OFFERS ROUTES ==========

// Get all offers
app.get('/api/offers', (req, res) => {
    res.json({
        success: true,
        offers: offers.map(offer => ({
            id: offer.id,
            title: offer.title,
            type: offer.type,
            description: offer.description,
            original_price: offer.original_price,
            promo_price: offer.promo_price,
            image_url: offer.image_url,
            badge: offer.badge
        }))
    });
});

// Create offer (Admin only)
const adminMiddleware = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Accès réservé aux administrateurs'
        });
    }
    next();
};

app.post('/api/offers/create', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const { title, type, description, original_price, promo_price, image_url, badge } = req.body;
        
        if (!title || !type || !original_price) {
            return res.status(400).json({
                success: false,
                message: 'Titre, type et prix sont requis'
            });
        }
        
        const newOffer = {
            id: Date.now().toString(),
            title,
            type,
            description,
            original_price: parseFloat(original_price),
            promo_price: promo_price ? parseFloat(promo_price) : null,
            image_url: image_url || null,
            badge: badge || null
        };
        
        offers.push(newOffer);
        
        res.json({
            success: true,
            message: 'Offre créée avec succès',
            offer: newOffer
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
app.post('/api/offers/book', authMiddleware, (req, res) => {
    try {
        const { offerId } = req.body;
        
        if (!offerId) {
            return res.status(400).json({
                success: false,
                message: 'ID de l\'offre requis'
            });
        }
        
        // Get offer
        const offer = offers.find(o => o.id === offerId);
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
        
        // Update user balance and points
        const updatedUser = {
            ...req.user,
            balance: req.user.balance - price,
            points: req.user.points + Math.floor(price)
        };
        
        // Update user in array
        const userIndex = users.findIndex(u => u.id === req.user.id);
        if (userIndex !== -1) {
            users[userIndex] = updatedUser;
            req.user = updatedUser;
        }
        
        // Create booking
        const booking = {
            id: Date.now().toString(),
            userId: req.user.id,
            offerId: offer.id,
            amount: price,
            status: 'confirmed',
            bookedAt: new Date().toISOString()
        };
        
        bookings.push(booking);
        
        res.json({
            success: true,
            message: 'Réservation effectuée avec succès',
            userBalance: req.user.balance,
            userPoints: req.user.points,
            user: {
                id: req.user.id,
                name: req.user.name,
                email: req.user.email,
                balance: req.user.balance,
                points: req.user.points
            },
            booking: {
                id: booking.id,
                amount: booking.amount,
                status: booking.status,
                bookedAt: booking.bookedAt
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

// Get user profile
app.get('/api/user/profile', authMiddleware, (req, res) => {
    try {
        const bookingsCount = bookings.filter(b => b.userId === req.user.id).length;
        
        res.json({
            success: true,
            user: {
                id: req.user.id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role,
                balance: req.user.balance,
                points: req.user.points,
                phone: req.user.phone,
                bookingsCount: bookingsCount
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement du profil'
        });
    }
});

// Update user profile
app.put('/api/user/update', authMiddleware, (req, res) => {
    try {
        const { name, email, phone } = req.body;
        
        // Create updated user
        const updatedUser = { ...req.user };
        
        // Check if email is taken by another user
        if (email && email !== req.user.email) {
            const existingUser = users.find(u => 
                u.email === email.toLowerCase() && u.id !== req.user.id
            );
            
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Email déjà utilisé par un autre compte'
                });
            }
            
            updatedUser.email = email.toLowerCase();
        }
        
        if (name) updatedUser.name = name;
        if (phone) updatedUser.phone = phone;
        
        // Update user in array
        const userIndex = users.findIndex(u => u.id === req.user.id);
        if (userIndex !== -1) {
            users[userIndex] = updatedUser;
            req.user = updatedUser;
        }
        
        res.json({
            success: true,
            message: 'Profil mis à jour avec succès',
            user: updatedUser
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
app.post('/api/user/charge', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const { amount } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Montant invalide'
            });
        }
        
        // Update user
        const updatedUser = {
            ...req.user,
            balance: req.user.balance + parseFloat(amount),
            points: req.user.points + Math.floor(amount)
        };
        
        // Update user in array
        const userIndex = users.findIndex(u => u.id === req.user.id);
        if (userIndex !== -1) {
            users[userIndex] = updatedUser;
            req.user = updatedUser;
        }
        
        res.json({
            success: true,
            message: 'Rechargement effectué avec succès',
            balance: req.user.balance,
            points: req.user.points,
            user: {
                id: req.user.id,
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

// ========== LIVE ROUTES ==========

// Get live sessions
app.get('/api/live/sessions', (req, res) => {
    res.json({
        success: true,
        sessions: liveSessions.map(session => ({
            id: session.id,
            title: session.title,
            description: session.description,
            startTime: session.startTime,
            status: session.status,
            viewers: session.viewers,
            createdBy: session.createdBy
        }))
    });
});

// Get live statistics
app.get('/api/live/stats', authMiddleware, (req, res) => {
    try {
        const totalSessions = liveSessions.length;
        const activeSessions = liveSessions.filter(s => s.status === 'active').length;
        const totalDuration = liveSessions.reduce((sum, session) => sum + (session.duration || 0), 0);
        
        res.json({
            success: true,
            stats: {
                totalSessions,
                activeSessions,
                totalDuration: Math.round(totalDuration / 60),
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
app.post('/api/live/create', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const { title, description } = req.body;
        
        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Titre de la séance requis'
            });
        }
        
        const newSession = {
            id: Date.now().toString(),
            title,
            description,
            startTime: new Date().toISOString(),
            status: 'active',
            viewers: 0,
            duration: 0,
            createdBy: req.user.name
        };
        
        liveSessions.push(newSession);
        
        res.json({
            success: true,
            message: 'Séance en direct démarrée avec succès',
            session: newSession
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

app.get('/api/admin/stats', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const totalOffers = offers.length;
        const totalUsers = users.length;
        const totalRevenue = bookings.reduce((sum, booking) => sum + (booking.amount || 0), 0);
        
        res.json({
            success: true,
            stats: {
                totalOffers,
                totalUsers,
                totalRevenue: Math.round(totalRevenue * 100) / 100
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

// ========== ERROR HANDLING ==========
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route non trouvée'
    });
});

app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur'
    });
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
    console.log('📝 Test accounts:');
    console.log('   👑 Admin: admin@eldjamila.com / admin123');
    console.log('   👤 User: test@user.com / 123456');
});

// For Vercel
module.exports = app;