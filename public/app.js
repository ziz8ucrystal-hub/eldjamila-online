// ========== GLOBAL VARIABLES ==========
let userBalance = 0;
let userPoints = 0;
let currentLanguage = 'fr';
let currentUser = null;
let isAdmin = false;
let allOffers = [];
let liveSessions = [];

// ========== API CONFIG ==========
const API_BASE_URL = window.location.origin;

// ========== NOTIFICATION SYSTEM ==========
function showNotification(message, type = 'info', duration = 5000) {
    // Remove existing notifications
    const existingNotif = document.querySelector('.notification');
    if (existingNotif) existingNotif.remove();
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';
    
    notification.innerHTML = `
        <span class="notif-icon">${icon}</span>
        <span class="notif-message">${message}</span>
        <button class="notif-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove
    if (duration > 0) {
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, duration);
    }
}

// ========== API CALL FUNCTION ==========
async function apiCall(endpoint, method = 'GET', data = null, requiresAuth = true) {
    const url = `${API_BASE_URL}/api/${endpoint}`;
    
    const headers = {
        'Content-Type': 'application/json',
    };
    
    const token = localStorage.getItem('token');
    if (requiresAuth && token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const options = {
        method,
        headers,
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    try {
        console.log(`🌐 API: ${method} ${url}`);
        const response = await fetch(url, options);
        
        if (response.status === 401) {
            showNotification('Session expirée, veuillez vous reconnecter', 'error');
            logout();
            throw new Error('Session expired');
        }
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('❌ API Error:', error);
        showNotification(error.message || 'Erreur de connexion au serveur', 'error');
        throw error;
    }
}

// ========== AUTH FUNCTIONS ==========
async function loginUser(email, password, isAdminLogin = false) {
    try {
        const result = await apiCall('auth/login', 'POST', {
            email,
            password
        }, false);

        if (result.success) {
            localStorage.setItem('token', result.token);
            localStorage.setItem('user', JSON.stringify(result.user));
            
            currentUser = result.user;
            isAdmin = result.user.role === 'admin';
            userBalance = result.user.balance || 0;
            userPoints = result.user.points || 0;
            
            showNotification('Connexion réussie!', 'success');
            switchToMainApp();
            await loadOffers();
            
            if (isAdmin) {
                await updateAdminStats();
            }
        } else {
            showNotification(result.message || 'Échec de connexion', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
    }
}

async function registerUser(name, email, password) {
    try {
        const result = await apiCall('auth/register', 'POST', {
            name,
            email,
            password
        }, false);

        if (result.success) {
            localStorage.setItem('token', result.token);
            localStorage.setItem('user', JSON.stringify(result.user));
            
            currentUser = result.user;
            isAdmin = result.user.role === 'admin';
            userBalance = result.user.balance || 0;
            userPoints = result.user.points || 0;
            
            showNotification('Inscription réussie!', 'success');
            switchToMainApp();
            await loadOffers();
        } else {
            showNotification(result.message || 'Échec de l\'inscription', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
    }
}

async function checkLoginStatus() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!token || !userStr) {
        return false;
    }
    
    try {
        const result = await apiCall('auth/verify', 'GET', null, true);
        
        if (result.success) {
            currentUser = result.user;
            isAdmin = result.user.role === 'admin';
            userBalance = result.user.balance || 0;
            userPoints = result.user.points || 0;
            
            switchToMainApp();
            await loadOffers();
            
            if (isAdmin) {
                await updateAdminStats();
            }
            
            return true;
        }
    } catch (error) {
        console.log('Session invalid');
        logout();
        return false;
    }
}

// ========== MAIN APP FUNCTIONS ==========
function switchToMainApp() {
    // Hide auth pages
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('registerPage').classList.remove('active');
    
    // Show main app
    document.getElementById('mainHeader').style.display = 'flex';
    document.getElementById('bottomNav').style.display = 'flex';
    
    // Update user info
    updateUserInfo();
    
    // Go to home page
    switchPage('home');
}

function updateUserInfo() {
    if (!currentUser) return;

    // Update avatars
    const initials = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U';
    document.getElementById('userAvatar').textContent = initials;
    document.getElementById('profileAvatar').textContent = initials;

    // Update profile info
    document.getElementById('profileName').textContent = currentUser.name || 'Utilisateur';
    document.getElementById('profileEmail').textContent = currentUser.email || 'email@exemple.com';
    document.getElementById('profileNameInput').value = currentUser.name || '';
    document.getElementById('profileEmailInput').value = currentUser.email || '';

    // Update balance and points
    document.getElementById('profileBalance').textContent = `€${userBalance}`;
    document.getElementById('profilePoints').textContent = userPoints;

    // Update admin badge
    if (isAdmin) {
        document.getElementById('adminBadgeContainer').innerHTML = '<span class="admin-badge">ADMINISTRATEUR</span>';
        // Show admin elements
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'flex';
        });
        document.getElementById('fabBtn').style.display = 'flex';
    } else {
        document.getElementById('adminBadgeContainer').innerHTML = '';
        // Hide admin elements
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'none';
        });
        document.getElementById('fabBtn').style.display = 'none';
    }

    // Update balance display
    updateBalanceDisplay();
}

function updateBalanceDisplay() {
    document.getElementById('balanceAmount').textContent = `€${userBalance.toFixed(2)}`;
    document.getElementById('userBalance').textContent = userBalance.toFixed(2);
    document.getElementById('userPoints').textContent = userPoints;
}

// ========== PAGE NAVIGATION ==========
function switchPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // Show selected page
    document.getElementById(pageId + 'Page').classList.add('active');

    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-page') === pageId) {
            item.classList.add('active');
        }
    });

    // Close dropdown if open
    document.getElementById('userDropdown').classList.remove('active');

    // Load data for specific pages
    switch (pageId) {
        case 'home':
            loadHomeOffers();
            break;
        case 'offers':
            loadOffers();
            break;
        case 'live':
            loadLiveSessions();
            break;
        case 'admin':
            if (isAdmin) {
                updateAdminStats();
            }
            break;
    }
}

// ========== OFFERS FUNCTIONS ==========
async function loadOffers() {
    try {
        const result = await apiCall('offers', 'GET');
        
        if (result.success && result.offers && result.offers.length > 0) {
            allOffers = result.offers;
            renderOffers(result.offers);
        } else {
            document.getElementById('offersContainer').innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-gift"></i>
                    <h3>Aucune prestation disponible</h3>
                    <p>${isAdmin ? 'Ajoutez votre première prestation' : 'Les prestations apparaîtront ici'}</p>
                    ${isAdmin ? `
                        <button class="btn btn-primary mt-12" onclick="document.getElementById('addOfferBtn').click()">
                            <i class="fas fa-plus btn-icon"></i>
                            Ajouter une prestation
                        </button>
                    ` : ''}
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading offers:', error);
        document.getElementById('offersContainer').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Erreur de chargement</h3>
                <p>Impossible de charger les prestations</p>
            </div>
        `;
    }
}

async function loadHomeOffers() {
    try {
        const result = await apiCall('offers', 'GET');
        
        if (result.success && result.offers && result.offers.length > 0) {
            allOffers = result.offers.slice(0, 4); // Show only 4 on home
            renderHomeOffers(result.offers.slice(0, 4));
        }
    } catch (error) {
        console.error('Error loading home offers:', error);
    }
}

function renderOffers(offers) {
    const container = document.getElementById('offersContainer');
    container.innerHTML = '';
    
    offers.forEach(offer => {
        const offerCard = createOfferCard(offer);
        container.appendChild(offerCard);
    });
}

function renderHomeOffers(offers) {
    const container = document.getElementById('homeOffersContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    offers.forEach(offer => {
        const offerCard = createOfferCard(offer);
        container.appendChild(offerCard);
    });
}

function createOfferCard(offer) {
    const offerCard = document.createElement('div');
    offerCard.className = 'card hair-service-card';
    
    // Add promotion badge if exists
    let badgeHtml = '';
    if (offer.badge) {
        if (offer.badge === 'TOP') {
            badgeHtml = `<div class="salon-badge">${offer.badge}</div>`;
        } else {
            badgeHtml = `<div class="promotion-badge">${offer.badge}</div>`;
        }
    }
    
    // Calculate price display
    let priceHtml = '';
    if (offer.promo_price) {
        const discountPercent = Math.round((1 - offer.promo_price / offer.original_price) * 100);
        priceHtml = `
            <div class="price-info">
                <div class="original-price">€${offer.original_price}</div>
                <div class="current-price">€${offer.promo_price}</div>
            </div>
            <div class="discount-percent">-${discountPercent}%</div>
        `;
    } else {
        priceHtml = `
            <div class="price-info">
                <div class="current-price">€${offer.original_price || offer.price}</div>
            </div>
        `;
    }
    
    const imageUrl = offer.image_url || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80';
    
    offerCard.innerHTML = `
        ${badgeHtml}
        <div class="card-image">
            <img src="${imageUrl}" alt="${offer.title}" 
                 onerror="this.src='https://images.unsplash.com/photo-1560066984-138dadb4c035?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80'">
        </div>
        <div class="card-content">
            <span class="service-type">${offer.type || 'Service'}</span>
            <h3 class="service-name">${offer.title}</h3>
            <p class="card-subtitle">${offer.description || 'Service professionnel de haute qualité'}</p>
            <div class="price-section">
                ${priceHtml}
                <button class="book-now-btn" onclick="bookOffer('${offer.id || offer._id}')">
                    Réserver
                </button>
            </div>
        </div>
    `;
    
    return offerCard;
}

async function createOffer() {
    const name = document.getElementById('offerName').value.trim();
    const type = document.getElementById('offerType').value;
    const originalPrice = document.getElementById('originalPrice').value;
    const promoPrice = document.getElementById('offerPrice').value.trim();
    const description = document.getElementById('offerDescription').value.trim();
    const image = document.getElementById('offerImage').value.trim();
    const promoBadge = document.getElementById('promoBadge').value;
    
    if (!name || !type || !originalPrice) {
        showNotification('Veuillez remplir tous les champs obligatoires', 'error');
        return;
    }
    
    try {
        const result = await apiCall('offers/create', 'POST', {
            title: name,
            type: type,
            original_price: parseFloat(originalPrice),
            promo_price: promoPrice ? parseFloat(promoPrice) : null,
            description: description,
            image_url: image || null,
            badge: promoBadge || null
        });
        
        if (result.success) {
            showNotification('Prestation ajoutée avec succès!', 'success');
            await loadOffers();
            await updateAdminStats();
            document.getElementById('addOfferModal').classList.remove('active');
            clearOfferForm();
        }
    } catch (error) {
        console.error('Create offer error:', error);
    }
}

async function bookOffer(offerId) {
    if (!currentUser) {
        showNotification('Veuillez vous connecter pour réserver', 'warning');
        switchPage('profile');
        return;
    }
    
    if (!confirm('Voulez-vous vraiment réserver cette prestation?')) {
        return;
    }
    
    try {
        const result = await apiCall('offers/book', 'POST', {
            offerId: offerId
        });
        
        if (result.success) {
            userBalance = result.userBalance || userBalance;
            userPoints = result.userPoints || userPoints;
            
            if (result.user) {
                currentUser = result.user;
                localStorage.setItem('user', JSON.stringify(currentUser));
            }
            
            updateUserInfo();
            showNotification('Réservation effectuée avec succès!', 'success');
        }
    } catch (error) {
        console.error('Booking error:', error);
    }
}

function clearOfferForm() {
    document.getElementById('offerName').value = '';
    document.getElementById('offerType').selectedIndex = 0;
    document.getElementById('originalPrice').value = '';
    document.getElementById('offerPrice').value = '';
    document.getElementById('offerDescription').value = '';
    document.getElementById('offerImage').value = '';
    document.getElementById('promoBadge').selectedIndex = 0;
}

// ========== LIVE SESSIONS ==========
async function loadLiveSessions() {
    try {
        const result = await apiCall('live/sessions', 'GET');
        
        if (result.success && result.sessions && result.sessions.length > 0) {
            liveSessions = result.sessions;
            renderLiveSessions(result.sessions);
        } else {
            document.getElementById('liveContainer').innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-video"></i>
                    <h3>Aucune séance en direct</h3>
                    <p>${isAdmin ? 'Commencez votre première séance' : 'Aucune séance en ce moment'}</p>
                    ${isAdmin ? `
                        <button class="btn btn-primary mt-12" onclick="document.getElementById('startLiveBtn').click()">
                            <i class="fas fa-broadcast-tower btn-icon"></i>
                            Démarrer une séance
                        </button>
                    ` : ''}
                </div>
            `;
        }
        
        // Load live stats if admin
        if (isAdmin) {
            await loadLiveStats();
        }
    } catch (error) {
        console.error('Error loading live sessions:', error);
    }
}

function renderLiveSessions(sessions) {
    const container = document.getElementById('liveContainer');
    container.innerHTML = '';
    
    sessions.forEach(session => {
        const sessionCard = document.createElement('div');
        sessionCard.className = 'card';
        
        const isActive = session.status === 'active';
        const duration = session.duration ? `${Math.round(session.duration / 60)}h` : 'En cours';
        
        sessionCard.innerHTML = `
            <div class="card-header">
                ${isActive ? `
                    <div class="live-indicator">
                        <span class="live-dot"></span>
                        <span>EN DIRECT</span>
                    </div>
                ` : ''}
                <h3 class="card-title">${session.title}</h3>
                <p class="card-subtitle">${session.description || 'Séance de coiffure'}</p>
            </div>
            <div class="card-content">
                <div class="card-meta">
                    <div class="meta-item">
                        <i class="fas fa-user"></i>
                        <span>${session.createdBy || 'Admin'}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-clock"></i>
                        <span>${duration}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-eye"></i>
                        <span>${session.viewers || 0} spectateurs</span>
                    </div>
                </div>
                <button class="btn btn-primary btn-full mt-12" onclick="joinLiveSession('${session.id || session._id}')">
                    <i class="fas fa-play btn-icon"></i>
                    ${isActive ? 'Rejoindre la séance' : 'Voir le replay'}
                </button>
            </div>
        `;
        
        container.appendChild(sessionCard);
    });
}

async function loadLiveStats() {
    try {
        const result = await apiCall('live/stats', 'GET');
        
        if (result.success) {
            const stats = result.stats;
            
            // Create stats container if doesn't exist
            let statsContainer = document.querySelector('.live-stats');
            if (!statsContainer) {
                statsContainer = document.createElement('div');
                statsContainer.className = 'live-stats';
                const liveContainer = document.getElementById('liveContainer');
                liveContainer.parentNode.insertBefore(statsContainer, liveContainer);
            }
            
            statsContainer.innerHTML = `
                <div class="stats-grid">
                    <div class="stat-card-live">
                        <div class="stat-icon"><i class="fas fa-video"></i></div>
                        <div class="stat-number-live">${stats.totalSessions}</div>
                        <div class="stat-label-live">Séances totales</div>
                    </div>
                    <div class="stat-card-live">
                        <div class="stat-icon"><i class="fas fa-broadcast-tower"></i></div>
                        <div class="stat-number-live">${stats.activeSessions}</div>
                        <div class="stat-label-live">En direct</div>
                    </div>
                    <div class="stat-card-live">
                        <div class="stat-icon"><i class="fas fa-clock"></i></div>
                        <div class="stat-number-live">${stats.totalDuration}</div>
                        <div class="stat-label-live">Heures totales</div>
                    </div>
                    <div class="stat-card-live">
                        <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
                        <div class="stat-number-live">${stats.avgDuration}</div>
                        <div class="stat-label-live">Moyenne (heures)</div>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading live stats:', error);
    }
}

async function createLiveSession() {
    const title = document.getElementById('liveTitle').value.trim();
    const description = document.getElementById('liveDescription').value.trim();
    
    if (!title) {
        showNotification('Veuillez saisir un titre pour votre séance', 'error');
        return;
    }
    
    try {
        const result = await apiCall('live/create', 'POST', {
            title,
            description
        });
        
        if (result.success) {
            showNotification('Séance en direct démarrée!', 'success');
            await loadLiveSessions();
            document.getElementById('startLiveModal').classList.remove('active');
            clearLiveForm();
        }
    } catch (error) {
        console.error('Start live error:', error);
    }
}

function joinLiveSession(sessionId) {
    showNotification('Connexion à la séance en cours...', 'info');
    // Here you would implement actual live streaming logic
    setTimeout(() => {
        showNotification('Vous êtes maintenant connecté à la séance en direct!', 'success');
    }, 1000);
}

function clearLiveForm() {
    document.getElementById('liveTitle').value = '';
    document.getElementById('liveDescription').value = '';
    document.getElementById('liveSchedule').value = '';
}

// ========== ADMIN FUNCTIONS ==========
async function updateAdminStats() {
    if (!isAdmin) return;
    
    try {
        const result = await apiCall('admin/stats', 'GET');
        
        if (result.success) {
            const stats = result.stats;
            document.getElementById('totalOffers').textContent = stats.totalOffers || 0;
            document.getElementById('totalUsers').textContent = stats.totalUsers || 1;
            document.getElementById('totalRevenue').textContent = `€${stats.totalRevenue || 0}`;
        }
    } catch (error) {
        console.error('Error loading admin stats:', error);
    }
}

// ========== PROFILE FUNCTIONS ==========
async function saveProfile() {
    const newName = document.getElementById('profileNameInput').value.trim();
    const newEmail = document.getElementById('profileEmailInput').value.trim();
    const phone = document.getElementById('profilePhone')?.value.trim() || '';
    
    if (!newName) {
        showNotification('Veuillez entrer votre nom', 'error');
        return;
    }
    
    try {
        const result = await apiCall('user/update', 'PUT', {
            name: newName,
            email: newEmail,
            phone: phone
        });
        
        if (result.success) {
            currentUser = result.user;
            localStorage.setItem('user', JSON.stringify(currentUser));
            updateUserInfo();
            showNotification('Profil mis à jour avec succès!', 'success');
        }
    } catch (error) {
        console.error('Update profile error:', error);
    }
}

// ========== PAYMENT FUNCTIONS ==========
async function chargeBalance() {
    const amount = parseFloat(document.getElementById('chargeAmount').value);
    
    if (!amount || amount <= 0) {
        showNotification('Veuillez saisir un montant valide', 'error');
        return;
    }
    
    if (!isAdmin) {
        showNotification('Le rechargement est réservé aux administrateurs', 'warning');
        switchPage('home');
        return;
    }
    
    try {
        const result = await apiCall('user/charge', 'POST', {
            amount: amount
        });
        
        if (result.success) {
            userBalance = result.balance;
            userPoints = result.points;
            
            if (result.user) {
                currentUser = result.user;
                localStorage.setItem('user', JSON.stringify(currentUser));
            }
            
            updateUserInfo();
            document.getElementById('chargeAmount').value = '';
            showNotification(`Rechargement de €${amount.toFixed(2)} effectué!`, 'success');
        }
    } catch (error) {
        console.error('Charge error:', error);
    }
}

// ========== LOGOUT FUNCTION ==========
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    currentUser = null;
    isAdmin = false;
    userBalance = 0;
    userPoints = 0;
    
    document.getElementById('mainHeader').style.display = 'none';
    document.getElementById('bottomNav').style.display = 'none';
    
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('adminLogin').checked = false;
    
    document.getElementById('loginPage').classList.add('active');
    document.getElementById('registerPage').classList.remove('active');
    
    showNotification('Déconnexion réussie', 'success');
}

// ========== EVENT LISTENERS SETUP ==========
function setupEventListeners() {
    console.log('🔧 Setting up event listeners...');
    
    // ========== AUTH EVENT LISTENERS ==========
    
    // Switch between auth pages
    document.getElementById('goToRegister').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('loginPage').classList.remove('active');
        document.getElementById('registerPage').classList.add('active');
    });
    
    document.getElementById('goToLogin').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('registerPage').classList.remove('active');
        document.getElementById('loginPage').classList.add('active');
    });
    
    // Login button
    document.getElementById('loginBtn').addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        const isAdminLogin = document.getElementById('adminLogin').checked;
        
        if (!email || !password) {
            showNotification('Veuillez remplir tous les champs', 'error');
            return;
        }
        
        document.getElementById('loginBtn').disabled = true;
        document.getElementById('loginBtn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connexion...';
        
        await loginUser(email, password, isAdminLogin);
        
        document.getElementById('loginBtn').disabled = false;
        document.getElementById('loginBtn').innerHTML = '<i class="fas fa-sign-in-alt btn-icon"></i> Se connecter';
    });
    
    // Register button
    document.getElementById('registerBtn').addEventListener('click', async () => {
        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value.trim();
        const confirmPassword = document.getElementById('registerConfirmPassword').value.trim();
        
        if (!name || !email || !password || !confirmPassword) {
            showNotification('Veuillez remplir tous les champs', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            showNotification('Les mots de passe ne correspondent pas', 'error');
            return;
        }
        
        if (password.length < 6) {
            showNotification('Le mot de passe doit contenir au moins 6 caractères', 'error');
            return;
        }
        
        document.getElementById('registerBtn').disabled = true;
        document.getElementById('registerBtn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Inscription...';
        
        await registerUser(name, email, password);
        
        document.getElementById('registerBtn').disabled = false;
        document.getElementById('registerBtn').innerHTML = '<i class="fas fa-user-plus btn-icon"></i> S\'inscrire';
    });
    
    // ========== NAVIGATION EVENT LISTENERS ==========
    
    // Bottom navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = item.getAttribute('data-page');
            switchPage(pageId);
        });
    });
    
    // User avatar click
    document.getElementById('userAvatar').addEventListener('click', () => {
        document.getElementById('userDropdown').classList.toggle('active');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const userAvatar = document.getElementById('userAvatar');
        const userDropdown = document.getElementById('userDropdown');
        
        if (!userAvatar.contains(e.target) && !userDropdown.contains(e.target)) {
            userDropdown.classList.remove('active');
        }
    });
    
    // Settings menu
    document.getElementById('settingsBtn').addEventListener('click', () => {
        document.getElementById('settingsMenu').classList.toggle('active');
    });
    
    // Language switching
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang');
            
            document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            currentLanguage = lang;
            showNotification(`Langue changée en: ${lang === 'fr' ? 'Français' : lang === 'en' ? 'English' : 'العربية'}`, 'info');
            
            document.getElementById('settingsMenu').classList.remove('active');
        });
    });
    
    // FAB Button
    document.getElementById('fabBtn').addEventListener('click', () => {
        document.getElementById('addOfferModal').classList.add('active');
    });
    
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            if (tabId === 'live') {
                document.getElementById('liveContainer').classList.remove('hidden');
                document.getElementById('contestsContainer').classList.add('hidden');
            } else {
                document.getElementById('liveContainer').classList.add('hidden');
                document.getElementById('contestsContainer').classList.remove('hidden');
            }
        });
    });
    
    // ========== MODAL EVENT LISTENERS ==========
    
    // Add Offer Modal
    document.getElementById('addOfferBtn').addEventListener('click', () => {
        document.getElementById('addOfferModal').classList.add('active');
    });
    
    document.getElementById('cancelOfferBtn').addEventListener('click', () => {
        document.getElementById('addOfferModal').classList.remove('active');
        clearOfferForm();
    });
    
    document.getElementById('saveOfferBtn').addEventListener('click', createOffer);
    
    // Start Live Modal
    document.getElementById('startLiveBtn').addEventListener('click', () => {
        document.getElementById('startLiveModal').classList.add('active');
    });
    
    document.getElementById('cancelLiveBtn').addEventListener('click', () => {
        document.getElementById('startLiveModal').classList.remove('active');
        clearLiveForm();
    });
    
    document.getElementById('goLiveBtn').addEventListener('click', createLiveSession);
    
    // Create Contest Modal
    document.getElementById('createContestBtn').addEventListener('click', () => {
        document.getElementById('createContestModal').classList.add('active');
    });
    
    document.getElementById('cancelContestBtn').addEventListener('click', () => {
        document.getElementById('createContestModal').classList.remove('active');
        clearContestForm();
    });
    
    // ========== OTHER EVENT LISTENERS ==========
    
    // Save Profile
    document.getElementById('saveProfileBtn').addEventListener('click', saveProfile);
    
    // Charge Balance
    document.getElementById('chargeBtn').addEventListener('click', chargeBalance);
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
    
    document.getElementById('logoutSidebarBtn').addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
    
    // Manage Users Button
    document.getElementById('manageUsersBtn').addEventListener('click', () => {
        showNotification('Gestion des utilisateurs à venir bientôt!', 'info');
    });
    
    // View Stats Button
    document.getElementById('viewStatsBtn').addEventListener('click', () => {
        showNotification('Statistiques détaillées à venir bientôt!', 'info');
    });
    
    // Close modals when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    console.log('✅ Event listeners setup completed');
}

// ========== HELPER FUNCTIONS ==========
function clearContestForm() {
    document.getElementById('contestName').value = '';
    document.getElementById('contestDescription').value = '';
    document.getElementById('contestEndDate').value = '';
    document.getElementById('contestPrize').value = '';
}

// ========== GLOBAL FUNCTIONS ==========
window.switchPage = switchPage;
window.bookOffer = bookOffer;
window.logout = logout;

// ========== INITIALIZE APP ==========
// Check login status on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 El Djamila App Starting...');
    
    // Setup event listeners
    setupEventListeners();
    
    // Check if user is already logged in
    checkLoginStatus();
    
    console.log('✅ App started successfully');
});