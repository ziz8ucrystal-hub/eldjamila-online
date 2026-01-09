const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// ========== CONFIGURATION ==========
app.use(cors());
app.use(express.json());

console.log('🚀 API El Djamila - Production Ready');

const JWT_SECRET = process.env.JWT_SECRET || 'eldjamila-secret-2024';

// Stockage en mémoire (TEMPORAIRE - sera remplacé par MongoDB)
const memoryDB = {
  users: [
    // Admin par défaut
    {
      id: "admin_001",
      name: "Admin El Djamila",
      email: "admin@eldjamila.com",
      passwordHash: "$2a$10$N9qo8uLOickgx2ZMRZoMy.Mrq5pHJ6.Z0p6J6YqK0cV9eB7Q2JQ5W", // password: admin123
      role: "admin",
      balance: 1000,
      points: 500,
      createdAt: new Date()
    }
  ],
  offers: [],
  contests: []
};

// Pré-hasher le mot de passe admin
(async () => {
  const adminHash = await bcrypt.hash('admin123', 10);
  memoryDB.users[0].passwordHash = adminHash;
  console.log('✅ Admin user ready: admin@eldjamila.com / admin123');
})();

// ========== MIDDLEWARE ==========
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token manquant' 
      });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = memoryDB.users.find(u => u.id === decoded.userId);
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }
    
    req.user = user;
    next();
    
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: 'Token invalide' 
    });
  }
};

// ========== ROUTES ==========

// 1. Health Check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '✅ API El Djamila en ligne',
    database: 'memory (temporaire)',
    usersCount: memoryDB.users.length,
    timestamp: new Date().toISOString()
  });
});

// 2. Offers
app.get('/api/offers', (req, res) => {
  res.json({
    success: true,
    offers: memoryDB.offers,
    count: memoryDB.offers.length
  });
});

// 3. Add Offer (Admin only)
app.post('/api/offers', authenticate, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Accès admin requis'
    });
  }
  
  const { title, description, price } = req.body;
  
  if (!title || !price) {
    return res.status(400).json({
      success: false,
      message: 'Titre et prix requis'
    });
  }
  
  const newOffer = {
    id: Date.now().toString(),
    title,
    description: description || '',
    price: Number(price),
    createdAt: new Date()
  };
  
  memoryDB.offers.push(newOffer);
  
  res.json({
    success: true,
    message: 'Offre ajoutée',
    offer: newOffer
  });
});

// 4. Register - FIXED: Admin/User distinction
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role = 'user' } = req.body; // 'admin' ou 'user'
    
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
    
    // Déterminer balance selon le rôle
    const balance = role === 'admin' ? 1000 : 0;
    const points = role === 'admin' ? 500 : 0;
    
    // Créer l'utilisateur
    const newUser = {
      id: Date.now().toString(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role: role === 'admin' ? 'admin' : 'user', // ⬅️ FIX: Garde le rôle
      balance,
      points,
      createdAt: new Date()
    };
    
    memoryDB.users.push(newUser);
    console.log(`✅ New user registered: ${email} as ${newUser.role}`);
    
    // Créer token
    const token = jwt.sign(
      {
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
        name: newUser.name
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.status(201).json({
      success: true,
      message: `🎉 Inscription réussie! (${newUser.role})`,
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

// 5. Login - FIXED: Vérification correcte
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
        role: user.role,
        name: user.name
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.json({
      success: true,
      message: `✅ Connexion réussie! (${user.role})`,
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

// 6. Verify Token (pour frontend)
app.get('/api/auth/verify', authenticate, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      balance: req.user.balance,
      points: req.user.points
    }
  });
});

// 7. Get Users (Admin only)
app.get('/api/users', authenticate, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Accès admin requis'
    });
  }
  
  const users = memoryDB.users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    balance: u.balance,
    points: u.points,
    createdAt: u.createdAt
  }));
  
  res.json({
    success: true,
    users,
    count: users.length
  });
});

// 8. Home
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '✨ API El Djamila Salon',
    version: '1.1.0',
    endpoints: {
      health: 'GET /api/health',
      register: 'POST /api/auth/register',
      login: 'POST /api/auth/login',
      verify: 'GET /api/auth/verify',
      offers: 'GET /api/offers',
      addOffer: 'POST /api/offers (admin)',
      users: 'GET /api/users (admin)'
    },
    note: 'Version temporaire - MongoDB sera ajouté plus tard'
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