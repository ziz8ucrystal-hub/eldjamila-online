// ========== Variables globales ==========
let userBalance = 0;
let userPoints = 0;
let currentLanguage = 'fr';
let currentUser = null;
let isAdmin = false;
let SOCKET = null;
const API_BASE_URL = window.location.origin;

// ========== Configuration API Vercel ==========
console.log('🚀 Application El Djamila - Version Vercel Optimisée');
console.log('🌐 URL Base:', API_BASE_URL);

// ========== Test initial de l'API ==========
async function testAPI() {
    try {
        console.log('🔍 Test connexion API Vercel...');
        const response = await fetch(`${API_BASE_URL}/api/health`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ API Vercel OK:', data.message);
            return true;
        } else {
            console.warn('⚠️ API réponse:', response.status);
            return false;
        }
    } catch (error) {
        console.error('❌ API hors ligne:', error.message);
        return false;
    }
}

// ========== Fonction API améliorée pour Vercel ==========
async function apiCall(endpoint, method = 'GET', data = null, requiresAuth = true) {
    console.log(`📤 API Call [VERCEL]: ${method} /api/${endpoint}`);
    
    // Correction: Utiliser le bon nom de token
    const token = localStorage.getItem('token') || localStorage.getItem('eldjamila_token');
    const fullUrl = `${API_BASE_URL}/api/${endpoint}`;
    
    const headers = {
        'Content-Type': 'application/json',
    };
    
    if (requiresAuth && token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log('🔐 Token envoyé');
    }
    
    const options = {
        method,
        headers,
    };
    
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(data);
    }
    
    try {
        console.log('🔗 URL complète:', fullUrl);
        const response = await fetch(fullUrl, options);
        console.log(`📥 Réponse: ${response.status} ${response.statusText}`);
        
        // Gestion spéciale 401
        if (response.status === 401) {
            console.warn('Session expirée');
            localStorage.removeItem('token');
            localStorage.removeItem('eldjamila_token');
            localStorage.removeItem('user');
            localStorage.removeItem('eldjamila_user');
            showLoginPage();
            throw new Error('Session expirée');
        }
        
        if (!response.ok) {
            let errorMessage = 'Erreur serveur';
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorData.error || `Erreur ${response.status}`;
            } catch (e) {
                errorMessage = `Erreur ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        
        // Pour réponses sans contenu
        if (response.status === 204) {
            return { success: true };
        }
        
        const responseData = await response.json();
        return responseData;
        
    } catch (error) {
        console.error('❌ API Error:', error.message);
        
        // Messages d'erreur clairs
        let userMessage = error.message;
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            userMessage = 'Serveur indisponible. Vérifiez votre connexion.';
        }
        
        showError(userMessage);
        throw error;
    }
}

// ========== Fonctions d'affichage ==========
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        if (errorDiv.parentElement) {
            errorDiv.remove();
        }
    }, 5000);
}

function showNotification(message, type = 'success') {
    const notifDiv = document.createElement('div');
    notifDiv.className = 'notification';
    notifDiv.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;
    document.body.appendChild(notifDiv);
    
    setTimeout(() => {
        if (notifDiv.parentElement) {
            notifDiv.remove();
        }
    }, 3000);
}

// ========== Socket.io ==========
function initSocket() {
    if (SOCKET) {
        SOCKET.disconnect();
        SOCKET = null;
    }
    
    const token = localStorage.getItem('token') || localStorage.getItem('eldjamila_token');
    if (!token) {
        console.log('⚠️ Pas de token pour Socket.io');
        return;
    }
    
    try {
        SOCKET = io(API_BASE_URL, {
            auth: { token },
            transports: ['websocket', 'polling']
        });
        
        SOCKET.on('connect', () => {
            console.log('✅ Socket.io connecté');
        });
        
        SOCKET.on('new_offer', (offer) => {
            console.log('📦 Nouvelle offre reçue:', offer);
            showNotification('Nouvelle offre disponible!');
        });
        
        SOCKET.on('balance_updated', (data) => {
            if (currentUser && data.userId === currentUser.id) {
                userBalance = data.balance;
                userPoints = data.points;
                updateBalanceDisplay();
                showNotification('Solde mis à jour');
            }
        });
        
        SOCKET.on('connect_error', (error) => {
            console.error('❌ Socket.io erreur:', error.message);
        });
        
        SOCKET.on('disconnect', () => {
            console.log('🔌 Socket.io déconnecté');
        });
        
    } catch (error) {
        console.error('❌ Erreur Socket.io:', error);
    }
}

// ========== Vérification d'authentification ==========
async function checkAuth() {
    const token = localStorage.getItem('token') || localStorage.getItem('eldjamila_token');
    const userStr = localStorage.getItem('user') || localStorage.getItem('eldjamila_user');
    
    if (!token || !userStr) {
        console.log('🔐 Pas de session trouvée');
        return false;
    }
    
    try {
        console.log('🔍 Vérification session...');
        
        // Test simple avec la route health
        const health = await fetch(`${API_BASE_URL}/api/health`);
        if (!health.ok) {
            throw new Error('API non disponible');
        }
        
        currentUser = JSON.parse(userStr);
        isAdmin = currentUser.role === 'admin';
        userBalance = currentUser.balance || 0;
        userPoints = currentUser.points || 0;
        
        updateUserInfo();
        initSocket();
        switchToMainApp();
        loadInitialData();
        
        console.log('✅ Session restaurée');
        return true;
        
    } catch (error) {
        console.error('❌ Session invalide:', error.message);
        localStorage.removeItem('token');
        localStorage.removeItem('eldjamila_token');
        localStorage.removeItem('user');
        localStorage.removeItem('eldjamila_user');
        return false;
    }
}

// ========== Connexion utilisateur (CORRIGÉ) ==========
async function loginUser(email, password, isAdminLogin = false) {
    try {
        console.log('🔐 Connexion en cours...');
        
        const result = await apiCall('auth/login', 'POST', {
            email,
            password
        }, false);
        
        console.log('✅ Réponse login:', result);
        
        if (result.success && result.token) {
            // CORRECTION: Utiliser les mêmes noms de clés partout
            localStorage.setItem('token', result.token);
            localStorage.setItem('user', JSON.stringify(result.user));
            
            currentUser = result.user;
            isAdmin = result.user.role === 'admin';
            userBalance = result.user.balance || 0;
            userPoints = result.user.points || 0;
            
            updateUserInfo();
            initSocket();
            switchToMainApp();
            loadInitialData();
            
            showNotification('Connexion réussie!');
            return true;
        } else {
            showError(result.message || 'Échec de connexion');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Erreur login:', error);
        showError('Identifiants incorrects');
        return false;
    }
}

// ========== Inscription utilisateur (CORRIGÉ) ==========
async function registerUser(name, email, password) {
    try {
        console.log('📝 Inscription en cours...');
        
        const result = await apiCall('auth/register', 'POST', {
            name,
            email,
            password
        }, false);
        
        console.log('✅ Réponse register:', result);
        
        if (result.success && result.token) {
            // CORRECTION: Utiliser les mêmes noms de clés partout
            localStorage.setItem('token', result.token);
            localStorage.setItem('user', JSON.stringify(result.user));
            
            currentUser = result.user;
            isAdmin = false;
            userBalance = result.user.balance || 50;
            userPoints = result.user.points || 50;
            
            updateUserInfo();
            initSocket();
            switchToMainApp();
            loadInitialData();
            
            showNotification('Inscription réussie!');
            return true;
        } else {
            showError(result.message || 'Échec inscription');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Erreur register:', error);
        showError('Erreur inscription');
        return false;
    }
}

// ========== Déconnexion ==========
function logoutUser() {
    console.log('👋 Déconnexion...');
    
    localStorage.removeItem('token');
    localStorage.removeItem('eldjamila_token');
    localStorage.removeItem('user');
    localStorage.removeItem('eldjamila_user');
    
    currentUser = null;
    isAdmin = false;
    userBalance = 0;
    userPoints = 0;
    
    if (SOCKET) {
        SOCKET.disconnect();
        SOCKET = null;
    }
    
    showLoginPage();
    showNotification('Déconnexion réussie');
}

// ========== Chargement des données ==========
async function loadInitialData() {
    try {
        console.log('📦 Chargement données initiales...');
        
        // Charger les offres
        const offers = await getOffers();
        console.log('✅ Offres chargées:', offers.length);
        
        if (homeOffersContainer && offers.length > 0) {
            displayHomeOffers(offers.slice(0, 4));
        }
        
        if (offersContainer) {
            displayAllOffers(offers);
        }
        
        // Charger sessions live
        try {
            const liveSessions = await getLiveSessions();
            if (liveContainer) {
                displayLiveSessions(liveSessions);
            }
        } catch (e) {
            console.log('⚠️ Pas de sessions live');
        }
        
        // Charger concours
        try {
            const contests = await getContests();
            if (contestsContainer) {
                displayContests(contests);
            }
        } catch (e) {
            console.log('⚠️ Pas de concours');
        }
        
        // Stats admin
        if (isAdmin) {
            loadAdminStats();
        }
        
    } catch (error) {
        console.error('❌ Erreur chargement:', error);
    }
}

// ========== Gestion des offres ==========
async function getOffers() {
    try {
        const result = await apiCall('offers');
        return result.offers || result.data || [];
    } catch (error) {
        console.log('⚠️ Aucune offre trouvée');
        return [];
    }
}

async function addOffer(offerData) {
    try {
        const result = await apiCall('offers', 'POST', offerData);
        
        if (result.success && SOCKET) {
            SOCKET.emit('new_offer_added', result.offer || result.data);
        }
        
        return result.offer || result.data;
    } catch (error) {
        throw error;
    }
}

// ========== Affichage UI ==========
function updateBalanceDisplay() {
    const balanceAmount = document.getElementById('balanceAmount');
    const userBalanceEl = document.getElementById('userBalance');
    const userPointsEl = document.getElementById('userPoints');
    const profileBalance = document.getElementById('profileBalance');
    const profilePoints = document.getElementById('profilePoints');
    
    if (balanceAmount) balanceAmount.textContent = `€${userBalance.toFixed(2)}`;
    if (userBalanceEl) userBalanceEl.textContent = userBalance.toFixed(2);
    if (userPointsEl) userPointsEl.textContent = userPoints;
    if (profileBalance) profileBalance.textContent = `€${userBalance}`;
    if (profilePoints) profilePoints.textContent = userPoints;
}

function updateUserInfo() {
    if (!currentUser) return;
    
    const userAvatar = document.getElementById('userAvatar');
    const profileAvatar = document.getElementById('profileAvatar');
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profileNameInput = document.getElementById('profileNameInput');
    const profileEmailInput = document.getElementById('profileEmailInput');
    const adminBadgeContainer = document.getElementById('adminBadgeContainer');
    const adminOnlyElements = document.querySelectorAll('.admin-only');
    const fabBtn = document.getElementById('fabBtn');
    
    if (userAvatar) userAvatar.textContent = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U';
    if (profileAvatar) profileAvatar.textContent = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U';
    if (profileName) profileName.textContent = currentUser.name || 'Utilisateur';
    if (profileEmail) profileEmail.textContent = currentUser.email || 'email@exemple.com';
    if (profileNameInput) profileNameInput.value = currentUser.name || '';
    if (profileEmailInput) profileEmailInput.value = currentUser.email || '';
    
    if (isAdmin) {
        if (adminBadgeContainer) {
            adminBadgeContainer.innerHTML = '<span class="admin-badge">ADMINISTRATEUR</span>';
        }
        if (adminOnlyElements) {
            adminOnlyElements.forEach(el => {
                el.style.display = 'flex';
            });
        }
        if (fabBtn) fabBtn.style.display = 'flex';
    } else {
        if (adminBadgeContainer) {
            adminBadgeContainer.innerHTML = '';
        }
        if (adminOnlyElements) {
            adminOnlyElements.forEach(el => {
                el.style.display = 'none';
            });
        }
        if (fabBtn) fabBtn.style.display = 'none';
    }
    
    updateBalanceDisplay();
}

function switchToMainApp() {
    const loginPage = document.getElementById('loginPage');
    const registerPage = document.getElementById('registerPage');
    const mainHeader = document.getElementById('mainHeader');
    const bottomNav = document.getElementById('bottomNav');
    
    if (loginPage) loginPage.classList.remove('active');
    if (registerPage) registerPage.classList.remove('active');
    
    if (mainHeader) mainHeader.style.display = 'flex';
    if (bottomNav) bottomNav.style.display = 'flex';
    
    updateUserInfo();
    switchPage('home');
}

function showLoginPage() {
    const mainHeader = document.getElementById('mainHeader');
    const bottomNav = document.getElementById('bottomNav');
    const loginPage = document.getElementById('loginPage');
    const registerPage = document.getElementById('registerPage');
    const adminOnlyElements = document.querySelectorAll('.admin-only');
    const fabBtn = document.getElementById('fabBtn');
    
    if (mainHeader) mainHeader.style.display = 'none';
    if (bottomNav) bottomNav.style.display = 'none';
    
    if (adminOnlyElements) {
        adminOnlyElements.forEach(el => {
            el.style.display = 'none';
        });
    }
    if (fabBtn) fabBtn.style.display = 'none';
    
    if (loginPage) loginPage.classList.add('active');
    if (registerPage) registerPage.classList.remove('active');
    
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const adminLogin = document.getElementById('adminLogin');
    
    if (loginEmail) loginEmail.value = '';
    if (loginPassword) loginPassword.value = '';
    if (adminLogin) adminLogin.checked = false;
}

// ========== Navigation ==========
window.switchPage = function(pageId) {
    const pages = document.querySelectorAll('.page');
    const navItems = document.querySelectorAll('.nav-item');
    const userDropdown = document.getElementById('userDropdown');
    
    pages.forEach(page => {
        page.classList.remove('active');
    });
    
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-page') === pageId) {
            item.classList.add('active');
        }
    });
    
    const targetPage = document.getElementById(pageId + 'Page');
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    if (userDropdown) {
        userDropdown.classList.remove('active');
    }
};

// ========== Initialisation au chargement ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎬 DOM chargé - Initialisation...');
    
    // Test API immédiat
    testAPI();
    
    // Éléments DOM
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const goToRegister = document.getElementById('goToRegister');
    const goToLogin = document.getElementById('goToLogin');
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutSidebarBtn = document.getElementById('logoutSidebarBtn');
    const saveOfferBtn = document.getElementById('saveOfferBtn');
    const cancelOfferBtn = document.getElementById('cancelOfferBtn');
    const goLiveBtn = document.getElementById('goLiveBtn');
    const cancelLiveBtn = document.getElementById('cancelLiveBtn');
    const saveContestBtn = document.getElementById('saveContestBtn');
    const cancelContestBtn = document.getElementById('cancelContestBtn');
    const chargeBtn = document.getElementById('chargeBtn');
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    const userAvatar = document.getElementById('userAvatar');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsMenu = document.getElementById('settingsMenu');
    const fabBtn = document.getElementById('fabBtn');
    const navItems = document.querySelectorAll('.nav-item');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const langBtns = document.querySelectorAll('.lang-btn');
    const manageUsersBtn = document.getElementById('manageUsersBtn');
    const viewStatsBtn = document.getElementById('viewStatsBtn');
    
    // Initialisation des événements
    if (goToRegister) {
        goToRegister.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('loginPage').classList.remove('active');
            document.getElementById('registerPage').classList.add('active');
        });
    }
    
    if (goToLogin) {
        goToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('registerPage').classList.remove('active');
            document.getElementById('loginPage').classList.add('active');
        });
    }
    
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const email = document.getElementById('loginEmail')?.value.trim();
            const password = document.getElementById('loginPassword')?.value.trim();
            
            if (!email || !password) {
                showError('Veuillez remplir tous les champs');
                return;
            }
            
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connexion...';
            
            const success = await loginUser(email, password);
            
            if (!success) {
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<i class="fas fa-sign-in-alt btn-icon"></i> Se connecter';
            }
        });
    }
    
    if (registerBtn) {
        registerBtn.addEventListener('click', async () => {
            const name = document.getElementById('registerName')?.value.trim();
            const email = document.getElementById('registerEmail')?.value.trim();
            const password = document.getElementById('registerPassword')?.value.trim();
            const confirmPassword = document.getElementById('registerConfirmPassword')?.value.trim();
            
            if (!name || !email || !password || !confirmPassword) {
                showError('Veuillez remplir tous les champs');
                return;
            }
            
            if (password !== confirmPassword) {
                showError('Les mots de passe ne correspondent pas');
                return;
            }
            
            if (password.length < 6) {
                showError('Le mot de passe doit contenir au moins 6 caractères');
                return;
            }
            
            registerBtn.disabled = true;
            registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Inscription...';
            
            const success = await registerUser(name, email, password);
            
            if (!success) {
                registerBtn.disabled = false;
                registerBtn.innerHTML = '<i class="fas fa-user-plus btn-icon"></i> S\'inscrire';
            }
        });
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logoutUser();
        });
    }
    
    if (logoutSidebarBtn) {
        logoutSidebarBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logoutUser();
        });
    }
    
    if (userAvatar) {
        userAvatar.addEventListener('click', () => {
            const userDropdown = document.getElementById('userDropdown');
            if (userDropdown) {
                userDropdown.classList.toggle('active');
            }
        });
    }
    
    if (settingsBtn && settingsMenu) {
        settingsBtn.addEventListener('click', () => {
            settingsMenu.classList.toggle('active');
        });
        
        document.addEventListener('click', (e) => {
            if (!settingsBtn.contains(e.target) && !settingsMenu.contains(e.target)) {
                settingsMenu.classList.remove('active');
            }
        });
    }
    
    if (fabBtn) {
        fabBtn.addEventListener('click', () => {
            const modal = document.getElementById('addOfferModal');
            if (modal) modal.classList.add('active');
        });
    }
    
    if (navItems) {
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const pageId = item.getAttribute('data-page');
                switchPage(pageId);
            });
        });
    }
    
    if (tabBtns) {
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.getAttribute('data-tab');
                
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const liveContainer = document.getElementById('liveContainer');
                const contestsContainer = document.getElementById('contestsContainer');
                
                if (tabId === 'live') {
                    if (liveContainer) liveContainer.classList.remove('hidden');
                    if (contestsContainer) contestsContainer.classList.add('hidden');
                } else {
                    if (liveContainer) liveContainer.classList.add('hidden');
                    if (contestsContainer) contestsContainer.classList.remove('hidden');
                }
            });
        });
    }
    
    if (langBtns) {
        langBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const lang = btn.getAttribute('data-lang');
                
                langBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                currentLanguage = lang;
                showNotification(`Langue changée: ${lang === 'fr' ? 'Français' : lang === 'en' ? 'Anglais' : 'Arabe'}`);
                
                if (settingsMenu) settingsMenu.classList.remove('active');
            });
        });
    }
    
    if (manageUsersBtn) {
        manageUsersBtn.addEventListener('click', () => {
            showNotification('Gestion utilisateurs à venir!');
        });
    }
    
    if (viewStatsBtn) {
        viewStatsBtn.addEventListener('click', () => {
            showNotification('Statistiques à venir!');
        });
    }
    
    // Modals
    if (saveOfferBtn) {
        saveOfferBtn.addEventListener('click', async () => {
            const name = document.getElementById('offerName')?.value.trim();
            const type = document.getElementById('offerType')?.value;
            const originalPrice = document.getElementById('originalPrice')?.value;
            
            if (!name || !type || !originalPrice) {
                showError('Veuillez remplir les champs obligatoires');
                return;
            }
            
            try {
                const offerData = {
                    title: name,
                    type,
                    original_price: parseFloat(originalPrice),
                    description: document.getElementById('offerDescription')?.value.trim() || '',
                    badge: document.getElementById('promoBadge')?.value || null
                };
                
                const promoPrice = document.getElementById('offerPrice')?.value.trim();
                if (promoPrice) {
                    offerData.promo_price = parseFloat(promoPrice);
                }
                
                const image = document.getElementById('offerImage')?.value.trim();
                if (image) {
                    offerData.image_url = image;
                }
                
                await addOffer(offerData);
                
                const modal = document.getElementById('addOfferModal');
                if (modal) modal.classList.remove('active');
                
                showNotification('Offre ajoutée!');
                
            } catch (error) {
                showError('Erreur ajout offre');
            }
        });
    }
    
    if (cancelOfferBtn) {
        cancelOfferBtn.addEventListener('click', () => {
            const modal = document.getElementById('addOfferModal');
            if (modal) modal.classList.remove('active');
        });
    }
    
    if (cancelLiveBtn) {
        cancelLiveBtn.addEventListener('click', () => {
            const modal = document.getElementById('startLiveModal');
            if (modal) modal.classList.remove('active');
        });
    }
    
    if (cancelContestBtn) {
        cancelContestBtn.addEventListener('click', () => {
            const modal = document.getElementById('createContestModal');
            if (modal) modal.classList.remove('active');
        });
    }
    
    if (chargeBtn) {
        chargeBtn.addEventListener('click', async () => {
            const chargeAmount = document.getElementById('chargeAmount');
            const amount = parseFloat(chargeAmount?.value);
            
            if (!amount || amount <= 0) {
                showError('Montant invalide');
                return;
            }
            
            try {
                const result = await apiCall('payment/charge', 'POST', { amount });
                
                if (result.success) {
                    userBalance = result.newBalance || userBalance + amount;
                    updateBalanceDisplay();
                    showNotification(`Rechargé €${amount}`);
                    if (chargeAmount) chargeAmount.value = '';
                }
            } catch (error) {
                showError('Erreur rechargement');
            }
        });
    }
    
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async () => {
            const profileNameInput = document.getElementById('profileNameInput');
            const profilePhone = document.getElementById('profilePhone');
            
            const newName = profileNameInput?.value.trim();
            const phone = profilePhone?.value.trim();
            
            if (!newName) {
                showError('Nom requis');
                return;
            }
            
            try {
                const result = await apiCall('profile/update', 'PUT', {
                    name: newName,
                    phone: phone || ''
                });
                
                if (result.success) {
                    currentUser.name = newName;
                    currentUser.phone = phone;
                    localStorage.setItem('user', JSON.stringify(currentUser));
                    updateUserInfo();
                    showNotification('Profil mis à jour');
                }
            } catch (error) {
                showError('Erreur mise à jour profil');
            }
        });
    }
    
    // Fermer modals en cliquant dehors
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    // Vérifier l'authentification au chargement
    checkAuth();
    
    console.log('✅ Application initialisée avec succès');
});

// ========== Fonctions auxiliaires globales ==========
window.bookOffer = async function(offerId) {
    try {
        const result = await apiCall('bookings', 'POST', { offerId });
        
        if (result.success) {
            userBalance = result.newBalance || userBalance;
            updateBalanceDisplay();
            showNotification('Réservation réussie!');
        }
    } catch (error) {
        showError('Erreur réservation');
    }
};

window.joinLiveSession = function(sessionId) {
    showNotification('Connexion session live...');
};

window.joinContest = function(contestId) {
    showNotification('Participation concours...');
};

window.editOffer = function(offerId) {
    showNotification('Modification à venir!');
};

window.deleteOfferFromUI = async function(offerId) {
    if (!confirm('Supprimer cette offre?')) return;
    
    try {
        await apiCall(`offers/${offerId}`, 'DELETE');
        const offerCard = document.querySelector(`[data-id="${offerId}"]`);
        if (offerCard) {
            offerCard.remove();
        }
        showNotification('Offre supprimée');
    } catch (error) {
        showError('Erreur suppression');
    }
};

// ========== Variables globales pour les conteneurs ==========
let homeOffersContainer = null;
let offersContainer = null;
let liveContainer = null;
let contestsContainer = null;

// Initialiser les conteneurs après chargement DOM
setTimeout(() => {
    homeOffersContainer = document.getElementById('homeOffersContainer');
    offersContainer = document.getElementById('offersContainer');
    liveContainer = document.getElementById('liveContainer');
    contestsContainer = document.getElementById('contestsContainer');
    
    console.log('📦 Conteneurs init:', {
        homeOffersContainer: !!homeOffersContainer,
        offersContainer: !!offersContainer,
        liveContainer: !!liveContainer,
        contestsContainer: !!contestsContainer
    });
}, 100);

// ========== Fonctions d'affichage ==========
function displayHomeOffers(offers) {
    if (!homeOffersContainer || offers.length === 0) return;
    
    homeOffersContainer.innerHTML = '';
    offers.forEach(offer => {
        const offerCard = createOfferCard(offer);
        homeOffersContainer.appendChild(offerCard);
    });
}

function displayAllOffers(offers) {
    if (!offersContainer) return;
    
    if (offers.length === 0) {
        offersContainer.innerHTML = `
            <div class="card empty-state">
                <i class="fas fa-gift"></i>
                <h3>Aucune offre disponible</h3>
                <p>Les offres apparaîtront ici</p>
            </div>
        `;
        return;
    }
    
    offersContainer.innerHTML = '';
    offers.forEach(offer => {
        const offerCard = createOfferCard(offer);
        offersContainer.appendChild(offerCard);
    });
}

function createOfferCard(offer) {
    const card = document.createElement('div');
    card.className = 'card hair-service-card';
    card.dataset.id = offer._id || offer.id;
    
    const badge = offer.badge ? `<div class="promotion-badge">${offer.badge}</div>` : '';
    
    const priceHtml = offer.promo_price ? `
        <div class="price-info">
            <div class="original-price">€${offer.original_price}</div>
            <div class="current-price">€${offer.promo_price}</div>
        </div>
        <div class="discount-percent">-${Math.round((1 - offer.promo_price / offer.original_price) * 100)}%</div>
    ` : `
        <div class="price-info">
            <div class="current-price">€${offer.original_price}</div>
        </div>
    `;
    
    card.innerHTML = `
        ${badge}
        <div class="card-image">
            <img src="${offer.image_url || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80'}" alt="${offer.title}">
        </div>
        <div class="card-content">
            <span class="service-type">${offer.type || 'Service'}</span>
            <h3 class="service-name">${offer.title}</h3>
            <p style="font-size: 12px; color: var(--gray); margin-bottom: 10px;">
                ${offer.description || 'Service professionnel'}
            </p>
            <div class="price-section">
                ${priceHtml}
                <button class="book-now-btn" onclick="bookOffer('${offer._id || offer.id}')">Réserver</button>
            </div>
            ${isAdmin ? `
                <div style="margin-top: 10px; display: flex; gap: 5px;">
                    <button class="btn btn-secondary" onclick="editOffer('${offer._id || offer.id}')" style="padding: 5px 10px; font-size: 12px;">Modifier</button>
                    <button class="btn btn-danger" onclick="deleteOfferFromUI('${offer._id || offer.id}')" style="padding: 5px 10px; font-size: 12px;">Supprimer</button>
                </div>
            ` : ''}
        </div>
    `;
    
    return card;
}

function displayLiveSessions(sessions) {
    if (!liveContainer) return;
    
    if (!sessions || sessions.length === 0) {
        liveContainer.innerHTML = `
            <div class="card empty-state">
                <i class="fas fa-video"></i>
                <h3>Aucune session live</h3>
                <p>Les sessions apparaîtront ici</p>
            </div>
        `;
        return;
    }
    
    liveContainer.innerHTML = '';
    sessions.forEach(session => {
        const card = document.createElement('div');
        card.className = 'card hair-service-card';
        card.innerHTML = `
            <div class="card-header">
                <div class="live-indicator">
                    <span class="live-dot"></span>
                    <span>EN DIRECT</span>
                </div>
                <h3 class="card-title">${session.title}</h3>
                <p class="card-subtitle">${session.description || ''}</p>
            </div>
            <div class="card-content">
                <button class="btn btn-primary btn-full" onclick="joinLiveSession('${session.id}')">
                    <i class="fas fa-play"></i> Rejoindre
                </button>
            </div>
        `;
        liveContainer.appendChild(card);
    });
}

function displayContests(contests) {
    if (!contestsContainer) return;
    
    if (!contests || contests.length === 0) {
        contestsContainer.innerHTML = `
            <div class="card empty-state">
                <i class="fas fa-trophy"></i>
                <h3>Aucun concours</h3>
                <p>Les concours apparaîtront ici</p>
            </div>
        `;
        return;
    }
    
    contestsContainer.innerHTML = '';
    contests.forEach(contest => {
        const card = document.createElement('div');
        card.className = 'card hair-service-card';
        card.innerHTML = `
            <div class="card-header">
                <div class="promotion-badge">CONCOURS</div>
                <h3 class="card-title">${contest.title}</h3>
                <p><strong>Prix:</strong> ${contest.prize}</p>
            </div>
            <div class="card-content">
                <p>${contest.description || ''}</p>
                <button class="btn btn-primary btn-full" onclick="joinContest('${contest.id}')">
                    <i class="fas fa-sign-in-alt"></i> Participer
                </button>
            </div>
        `;
        contestsContainer.appendChild(card);
    });
}

// ========== Fonctions API restantes ==========
async function getLiveSessions() {
    try {
        const result = await apiCall('live');
        return result.sessions || result.data || [];
    } catch (error) {
        return [];
    }
}

async function getContests() {
    try {
        const result = await apiCall('contests');
        return result.contests || result.data || [];
    } catch (error) {
        return [];
    }
}

async function loadAdminStats() {
    if (!isAdmin) return;
    
    try {
        const result = await apiCall('admin/stats');
        if (result.stats) {
            const totalOffers = document.getElementById('totalOffers');
            const totalUsers = document.getElementById('totalUsers');
            const totalRevenue = document.getElementById('totalRevenue');
            
            if (totalOffers) totalOffers.textContent = result.stats.totalOffers || 0;
            if (totalUsers) totalUsers.textContent = result.stats.totalUsers || 1;
            if (totalRevenue) totalRevenue.textContent = `€${result.stats.totalRevenue || 0}`;
        }
    } catch (error) {
        console.log('⚠️ Stats admin non disponibles');
    }
}