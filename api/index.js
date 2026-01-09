const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// ========== CONFIGURATION ==========
app.use(cors());
app.use(express.json());

console.log('🚀 API El Djamila - Simple Version');

const JWT_SECRET = 'eldjamila-secret-2024';

// Stockage en mémoire (sans MongoDB)
const memoryDB = {
  users: [],
  offers: [],
  contests: []
};

// ========== ROUTES ==========

// 1. Health Check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '✅ API El Djamila en ligne',
    database: 'memory',
    timestamp: new Date().toISOString()
  });
});

// 2. Offers (retourne vide - admin ajoutera)
app.get('/api/offers', (req, res) => {
  res.json({
    success: true,
    offers: memoryDB.offers,
    count: memoryDB.offers.length,
    message: memoryDB.offers.length === 0 
      ? 'Aucune offre - Admin ajoutera les offres' 
      : `${memoryDB.offers.length} offre(s) disponible(s)`
  });
});

// 3. Contests (retourne vide - admin ajoutera)
app.get('/api/contests', (req, res) => {
  res.json({
    success: true,
    contests: memoryDB.contests,
    count: memoryDB.contests.length,
    message: memoryDB.contests.length === 0 
      ? 'Aucun concours - Admin créera les concours' 
      : `${memoryDB.contests.length} concours actif(s)`
  });
});

// 4. Live Status
app.get('/api/live', (req, res) => {
  res.json({
    success: true,
    status: 'online',
    salon: {
      name: 'El Djamila Salon',
      status: 'Ouvert',
      hours: '09:00 - 22:00',
      days: 'Lundi - Dimanche',
      phone: '+33 1 23 45 67 89'
    },
    statistics: {
      users: memoryDB.users.length,
      offers: memoryDB.offers.length,
      contests: memoryDB.contests.length
    },
    serverTime: new Date().toISOString(),
    note: 'Base de données en mémoire - Admin ajoute tout'
  });
});

// 5. Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Nom, email et mot de passe requis'
      });
    }
    
    // Vérifier si l'utilisateur existe
    const existingUser = memoryDB.users.find(u => u.email === email.toLowerCase());
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email déjà utilisé'
      });
    }
    
    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Créer l'utilisateur
    const newUser = {
      id: Date.now().toString(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role: 'user',
      balance: 0,
      points: 0,
      createdAt: new Date()
    };
    
    memoryDB.users.push(newUser);
    
    // Créer token
    const token = jwt.sign(
      {
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.status(201).json({
      success: true,
      message: '🎉 Inscription réussie!',
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        balance: newUser.balance,
        points: newUser.points
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur inscription'
    });
  }
});

// 6. Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis'
      });
    }
    
    // Trouver l'utilisateur
    const user = memoryDB.users.find(u => u.email === email.toLowerCase());
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }
    
    // Vérifier mot de passe
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }
    
    // Créer token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.json({
      success: true,
      message: '✅ Connexion réussie!',
      token,
      user: {
        id: user.id,
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
      message: 'Erreur connexion'
    });
  }
});

// 7. Route racine
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '✨ API El Djamila Salon',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      register: 'POST /api/auth/register',
      login: 'POST /api/auth/login',
      offers: 'GET /api/offers',
      contests: 'GET /api/contests',
      live: 'GET /api/live'
    },
    note: 'Version simple sans MongoDB - Admin ajoute tout'
  });
});

// ========== ERROR HANDLING ==========
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route non trouvée: ${req.method} ${req.url}`
  });
});

module.exports = app;