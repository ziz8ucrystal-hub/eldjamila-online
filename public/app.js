// ============================================
// EL DJAMILA SALON - تطبيق كامل متوافق
// الإصدار النهائي مع جميع الإصلاحات
// ============================================

// ========== VARIABLES GLOBALES ==========
let userBalance = 0;
let userPoints = 0;
let currentUser = null;
let isAdmin = false;
let allOffers = [];
let liveSessions = [];

// ========== API CONFIG ==========
const API_BASE_URL = window.location.origin;

// ========== NOTIFICATION SYSTEM ==========
class NotificationSystem {
    constructor() {
        if (document.getElementById('dynamicIslandContainer')) {
            this.container = document.getElementById('dynamicIslandContainer');
        } else {
            this.container = document.createElement('div');
            this.container.id = 'dynamicIslandContainer';
            this.container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 999999;
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 10px;
            `;
            document.body.appendChild(this.container);
        }
    }

    show(message, type = 'info', duration = 4000) {
        const notification = document.createElement('div');
        notification.className = `dynamic-notification ${type}`;
        notification.style.cssText = `
            transform: translateX(120%);
            transition: transform 0.3s ease;
        `;

        notification.innerHTML = `
            <span style="font-size: 18px;">${this.getIcon(type)}</span>
            <span>${message}</span>
        `;

        this.container.appendChild(notification);

        // Show animation
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);

        // Auto remove
        setTimeout(() => {
            notification.style.transform = 'translateX(120%)';
            setTimeout(() => notification.remove(), 300);
        }, duration);

        // Click to close
        notification.onclick = () => {
            notification.style.transform = 'translateX(120%)';
            setTimeout(() => notification.remove(), 300);
        };
    }

    getIcon(type) {
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || 'ℹ';
    }
}

// Create notification system
const notification = new NotificationSystem();

// ========== API FUNCTIONS ==========
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
    
    if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(url, options);
        
        if (response.status === 401) {
            notification.show('Session expirée, veuillez vous reconnecter', 'error');
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
        notification.show(error.message || 'Erreur de connexion au serveur', 'error');
        throw error;
    }
}

// ========== AUTHENTICATION ==========
async function loginUser(email, password, isAdminLogin = false) {
    try {
        const result = await apiCall('auth/login', 'POST', {
            email,
            password
        }, false);

        if (result.success && result.token) {
            localStorage.setItem('token', result.token);
            localStorage.setItem('user', JSON.stringify(result.user));
            
            currentUser = result.user;
            isAdmin = result.user.role === 'admin';
            userBalance = result.user.balance || 0;
            userPoints = result.user.points || 0;
            
            notification.show('Connexion réussie!', 'success');
            switchToMainApp();
            
            // Load initial data
            await loadInitialData();
            
            // Update admin stats if admin
            if (isAdmin) {
                await updateAdminStats();
            }
        } else {
            notification.show(result.message || 'Email ou mot de passe incorrect', 'error');
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
            
            notification.show('Inscription réussie!', 'success');
            switchToMainApp();
            await loadInitialData();
        } else {
            notification.show(result.message || 'Échec de l\'inscription', 'error');
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
            await loadInitialData();
            
            if (isAdmin) {
                await updateAdminStats();
            }
            
            return true;
        }
    } catch (error) {
        console.log('Session invalid or expired');
        logout();
        return false;
    }
}

// ========== MAIN APP FUNCTIONS ==========
function switchToMainApp() {
    // Hide auth pages
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('registerPage').classList.remove('active');
    document.getElementById('registerPage').style.display = 'none';
    
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
    
    // Update balance card based on user role
    updateBalanceCard();
}

function updateBalanceDisplay() {
    document.getElementById('balanceAmount').textContent = `€${userBalance.toFixed(2)}`;
    document.getElementById('userBalance').textContent = userBalance.toFixed(2);
    document.getElementById('userPoints').textContent = userPoints;
}

function updateBalanceCard() {
    const balanceCard = document.getElementById('balanceCard');
    if (!balanceCard) return;
    
    if (isAdmin) {
        // Admin sees charge section
        balanceCard.innerHTML = `
            <h3><i class="fas fa-wallet"></i> Mon Portefeuille (Admin)</h3>
            <div class="payment-amount">€${userBalance.toFixed(2)}</div>
            
            <div class="payment-input-container">
                <input type="number" class="payment-input" id="chargeAmount" placeholder="Montant" min="1" step="0.01">
                <button class="payment-btn" id="chargeBtn">Recharger</button>
            </div>
            
            <p>Vos points: <strong>${userPoints}</strong> points</p>
            <p style="font-size: 12px; opacity: 0.9; margin-top: 8px;">1 point = €1. Utilisez vos points pour payer les prestations.</p>
        `;
        
        // Add event listener for admin charge button
        const chargeBtn = document.getElementById('chargeBtn');
        if (chargeBtn) {
            chargeBtn.onclick = chargeBalance;
        }
    } else {
        // Regular user sees only balance (NO CHARGE SECTION)
        balanceCard.innerHTML = `
            <h3><i class="fas fa-wallet"></i> Mon Portefeuille</h3>
            <div class="payment-amount">€${userBalance.toFixed(2)}</div>
            
            <p>Vos points: <strong>${userPoints}</strong> points</p>
            <p style="font-size: 13px; color: rgba(255,255,255,0.8); margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.2);">
                <i class="fas fa-info-circle"></i> Contactez l'administrateur pour recharger votre compte
            </p>
        `;
    }
}

// ========== PAGE NAVIGATION ==========
function switchPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
        page.style.display = 'none';
    });

    // Show selected page
    const targetPage = document.getElementById(pageId + 'Page');
    if (targetPage) {
        targetPage.classList.add('active');
        targetPage.style.display = 'block';
    }

    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-page') === pageId) {
            item.classList.add('active');
        }
    });

    // Close dropdown if open
    document.getElementById('userDropdown').classList.remove('active');
    document.getElementById('settingsMenu').classList.remove('active');

    // Load data for specific pages
    switch (pageId) {
        case 'home':
            loadHomeData();
            break;
        case 'offers':
            loadOffers();
            break;
        case 'live':
            loadLiveSessions();
            break;
        case 'payment':
            updateBalanceDisplay();
            updateBalanceCard();
            break;
        case 'admin':
            if (isAdmin) {
                updateAdminStats();
            }
            break;
    }
}

// ========== LOAD DATA FUNCTIONS ==========
async function loadInitialData() {
    await Promise.all([
        loadOffers(),
        loadLiveSessions()
    ]);
}

async function loadHomeData() {
    try {
        const result = await apiCall('offers');
        if (result.success && result.offers && result.offers.length > 0) {
            allOffers = result.offers;
            renderHomeOffers(result.offers.slice(0, 4));
        }
    } catch (error) {
        console.error('Error loading home data:', error);
    }
}

async function loadOffers() {
    try {
        const result = await apiCall('offers');
        
        if (result.success && result.offers && result.offers.length > 0) {
            allOffers = result.offers;
            renderOffers(result.offers);
        } else {
            renderEmptyOffers();
        }
    } catch (error) {
        console.error('Error loading offers:', error);
        renderEmptyOffers();
    }
}

async function loadLiveSessions() {
    try {
        const result = await apiCall('live/sessions');
        
        if (result.success && result.sessions && result.sessions.length > 0) {
            liveSessions = result.sessions;
            renderLiveSessions(result.sessions);
        } else {
            renderEmptyLiveSessions();
        }
    } catch (error) {
        console.error('Error loading live sessions:', error);
        renderEmptyLiveSessions();
    }
}

// ========== RENDER FUNCTIONS ==========
function renderHomeOffers(offers) {
    const container = document.getElementById('homeOffersContainer');
    if (!container) return;
    
    if (offers.length === 0) {
        renderEmptyHomeOffers();
        return;
    }
    
    container.innerHTML = offers.map(offer => createOfferCard(offer)).join('');
}

function renderEmptyHomeOffers() {
    const container = document.getElementById('homeOffersContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="card empty-state">
            <i class="fas fa-gift"></i>
            <h3>Bienvenue chez El Djamila</h3>
            <p>Découvrez bientôt nos prestations exclusives</p>
            <button class="btn btn-primary mt-12" onclick="switchPage('offers')">
                Voir toutes les prestations
            </button>
        </div>
    `;
}

function renderOffers(offers) {
    const container = document.getElementById('offersContainer');
    if (!container) return;
    
    if (offers.length === 0) {
        renderEmptyOffers();
        return;
    }
    
    container.innerHTML = offers.map(offer => createOfferCard(offer)).join('');
}

function renderEmptyOffers() {
    const container = document.getElementById('offersContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="card empty-state">
            <i class="fas fa-gift"></i>
            <h3>Aucune prestation disponible</h3>
            <p>${isAdmin ? 'Ajoutez votre première prestation' : 'Les prestations apparaîtront ici bientôt'}</p>
            ${isAdmin ? `
                <button class="btn btn-primary mt-12" onclick="showAddOfferModal()">
                    <i class="fas fa-plus btn-icon"></i>
                    Ajouter une prestation
                </button>
            ` : ''}
        </div>
    `;
}

function createOfferCard(offer) {
    const discountPercent = offer.promo_price && offer.original_price 
        ? Math.round((1 - offer.promo_price / offer.original_price) * 100)
        : 0;

    return `
        <div class="card hair-service-card">
            ${offer.badge ? `<div class="${offer.badge === 'TOP' ? 'salon-badge' : 'promotion-badge'}">${offer.badge}</div>` : ''}
            
            <div class="card-image">
                <img src="${offer.image_url || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=500&auto=format&fit=crop'}" 
                     alt="${offer.title}"
                     onerror="this.src='https://images.unsplash.com/photo-1560066984-138dadb4c035?w=500&auto=format&fit=crop'">
            </div>
            
            <div class="card-content">
                <span class="service-type">${offer.type || 'Service'}</span>
                <h3 class="service-name">${offer.title}</h3>
                <p class="card-subtitle">${offer.description || 'Service professionnel de haute qualité'}</p>
                
                <div class="price-section">
                    <div class="price-info">
                        ${offer.promo_price ? `<div class="original-price">€${offer.original_price}</div>` : ''}
                        <div class="current-price">€${offer.promo_price || offer.original_price || offer.price}</div>
                    </div>
                    
                    ${discountPercent > 0 ? `
                        <div class="discount-percent">-${discountPercent}%</div>
                    ` : ''}
                    
                    <button class="book-now-btn" onclick="bookOffer('${offer.id}')">
                        Réserver
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderLiveSessions(sessions) {
    const container = document.getElementById('liveContainer');
    if (!container) return;
    
    if (sessions.length === 0) {
        renderEmptyLiveSessions();
        return;
    }
    
    container.innerHTML = sessions.map(session => `
        <div class="card">
            <div class="card-header">
                ${session.status === 'active' ? `
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
                        <span>${session.duration ? Math.round(session.duration / 60) + 'h' : 'En cours'}</span>
                    </div>
                </div>
                
                <button class="btn btn-primary btn-full mt-12" onclick="joinLiveSession()">
                    <i class="fas fa-play btn-icon"></i>
                    ${session.status === 'active' ? 'Rejoindre la séance' : 'Voir le replay'}
                </button>
            </div>
        </div>
    `).join('');
}

function renderEmptyLiveSessions() {
    const container = document.getElementById('liveContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="card empty-state">
            <i class="fas fa-video"></i>
            <h3>Aucune séance en direct</h3>
            <p>${isAdmin ? 'Commencez votre première séance' : 'Aucune séance en ce moment'}</p>
            ${isAdmin ? `
                <button class="btn btn-primary mt-12" onclick="showStartLiveModal()">
                    <i class="fas fa-broadcast-tower btn-icon"></i>
                    Démarrer une séance
                </button>
            ` : ''}
        </div>
    `;
}

// ========== OFFER FUNCTIONS ==========
function showAddOfferModal() {
    if (!isAdmin) {
        notification.show('Accès réservé aux administrateurs', 'error');
        return;
    }
    
    document.getElementById('addOfferModal').classList.add('active');
}

async function createOffer() {
    if (!isAdmin) {
        notification.show('Accès refusé', 'error');
        return;
    }

    const name = document.getElementById('offerName').value.trim();
    const type = document.getElementById('offerType').value;
    const originalPrice = document.getElementById('originalPrice').value;
    const promoPrice = document.getElementById('offerPrice').value.trim();
    const description = document.getElementById('offerDescription').value.trim();
    const image = document.getElementById('offerImage').value.trim();
    const promoBadge = document.getElementById('promoBadge').value;

    if (!name || !type || !originalPrice) {
        notification.show('Veuillez remplir tous les champs obligatoires', 'error');
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
            notification.show('Prestation ajoutée avec succès!', 'success');
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
        notification.show('Veuillez vous connecter pour réserver', 'warning');
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
            notification.show('Réservation effectuée avec succès!', 'success');
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

// ========== LIVE SESSION FUNCTIONS ==========
function showStartLiveModal() {
    if (!isAdmin) {
        notification.show('Accès réservé aux administrateurs', 'error');
        return;
    }
    
    document.getElementById('startLiveModal').classList.add('active');
}

async function createLiveSession() {
    if (!isAdmin) {
        notification.show('Accès refusé', 'error');
        return;
    }

    const title = document.getElementById('liveTitle').value.trim();
    const description = document.getElementById('liveDescription').value.trim();
    
    if (!title) {
        notification.show('Veuillez saisir un titre pour votre séance', 'error');
        return;
    }
    
    try {
        const result = await apiCall('live/create', 'POST', {
            title,
            description
        });
        
        if (result.success) {
            notification.show('Séance en direct démarrée!', 'success');
            await loadLiveSessions();
            document.getElementById('startLiveModal').classList.remove('active');
            clearLiveForm();
        }
    } catch (error) {
        console.error('Start live error:', error);
    }
}

function joinLiveSession() {
    notification.show('Connexion à la séance en cours...', 'info');
    setTimeout(() => {
        notification.show('Vous êtes maintenant connecté à la séance en direct!', 'success');
    }, 1000);
}

function clearLiveForm() {
    document.getElementById('liveTitle').value = '';
    document.getElementById('liveDescription').value = '';
    document.getElementById('liveSchedule').value = '';
}

// ========== PROFILE FUNCTIONS ==========
async function saveProfile() {
    const newName = document.getElementById('profileNameInput').value.trim();
    const newEmail = document.getElementById('profileEmailInput').value.trim();
    const phone = document.getElementById('profilePhone')?.value.trim() || '';
    
    if (!newName) {
        notification.show('Veuillez entrer votre nom', 'error');
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
            notification.show('Profil mis à jour avec succès!', 'success');
        }
    } catch (error) {
        console.error('Update profile error:', error);
    }
}

// ========== PAYMENT FUNCTIONS ==========
async function chargeBalance() {
    const amount = parseFloat(document.getElementById('chargeAmount').value);
    
    if (!amount || amount <= 0) {
        notification.show('Veuillez saisir un montant valide', 'error');
        return;
    }
    
    if (!isAdmin) {
        notification.show('Le rechargement est réservé aux administrateurs', 'warning');
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
            notification.show(`Rechargement de €${amount.toFixed(2)} effectué!`, 'success');
        }
    } catch (error) {
        console.error('Charge error:', error);
    }
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

function manageUsers() {
    notification.show('Gestion des utilisateurs à venir bientôt!', 'info');
}

function viewStats() {
    notification.show('Statistiques détaillées à venir bientôt!', 'info');
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
    
    document.getElementById('loginPage').style.display = 'block';
    document.getElementById('loginPage').classList.add('active');
    document.getElementById('registerPage').style.display = 'none';
    document.getElementById('registerPage').classList.remove('active');
    
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('adminLogin').checked = false;
    
    notification.show('Déconnexion réussie', 'success');
}

// ========== EVENT LISTENERS SETUP ==========
function setupEventListeners() {
    console.log('🔧 Setting up event listeners...');
    
    // ========== AUTH EVENT LISTENERS ==========
    
    // Switch between auth pages
    document.getElementById('goToRegister').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('loginPage').classList.remove('active');
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('registerPage').classList.add('active');
        document.getElementById('registerPage').style.display = 'block';
    });
    
    document.getElementById('goToLogin').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('registerPage').classList.remove('active');
        document.getElementById('registerPage').style.display = 'none';
        document.getElementById('loginPage').classList.add('active');
        document.getElementById('loginPage').style.display = 'block';
    });
    
    // Login button
    document.getElementById('loginBtn').addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        const isAdminLogin = document.getElementById('adminLogin').checked;
        
        if (!email || !password) {
            notification.show('Veuillez remplir tous les champs', 'error');
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
            notification.show('Veuillez remplir tous les champs', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            notification.show('Les mots de passe ne correspondent pas', 'error');
            return;
        }
        
        if (password.length < 6) {
            notification.show('Le mot de passe doit contenir au moins 6 caractères', 'error');
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
    
    // Settings button
    document.getElementById('settingsBtn').addEventListener('click', () => {
        document.getElementById('settingsMenu').classList.toggle('active');
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        const userAvatar = document.getElementById('userAvatar');
        const userDropdown = document.getElementById('userDropdown');
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsMenu = document.getElementById('settingsMenu');
        
        if (userAvatar && userDropdown && !userAvatar.contains(e.target) && !userDropdown.contains(e.target)) {
            userDropdown.classList.remove('active');
        }
        
        if (settingsBtn && settingsMenu && !settingsBtn.contains(e.target) && !settingsMenu.contains(e.target)) {
            settingsMenu.classList.remove('active');
        }
    });
    
    // FAB Button
    document.getElementById('fabBtn').addEventListener('click', () => {
        showAddOfferModal();
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
    document.getElementById('cancelOfferBtn').addEventListener('click', () => {
        document.getElementById('addOfferModal').classList.remove('active');
        clearOfferForm();
    });
    
    document.getElementById('saveOfferBtn').addEventListener('click', createOffer);
    
    // Start Live Modal
    document.getElementById('startLiveBtn')?.addEventListener('click', () => {
        showStartLiveModal();
    });
    
    document.getElementById('cancelLiveBtn').addEventListener('click', () => {
        document.getElementById('startLiveModal').classList.remove('active');
        clearLiveForm();
    });
    
    document.getElementById('goLiveBtn').addEventListener('click', createLiveSession);
    
    // ========== OTHER EVENT LISTENERS ==========
    
    // Save Profile
    document.getElementById('saveProfileBtn').addEventListener('click', saveProfile);
    
    // Charge Balance (for admin - handled in updateBalanceCard)
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
    
    document.getElementById('logoutSidebarBtn').addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
    
    // Admin buttons
    document.getElementById('manageUsersBtn').addEventListener('click', manageUsers);
    document.getElementById('viewStatsBtn').addEventListener('click', viewStats);
    
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

// ========== GLOBAL FUNCTIONS ==========
window.switchPage = switchPage;
window.bookOffer = bookOffer;
window.showAddOfferModal = showAddOfferModal;
window.showStartLiveModal = showStartLiveModal;
window.joinLiveSession = joinLiveSession;
window.logout = logout;

// ========== INITIALIZE APP ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 El Djamila App Starting...');
    
    // Setup event listeners
    setupEventListeners();
    
    // Check if user is already logged in
    checkLoginStatus().then(isLoggedIn => {
        if (!isLoggedIn) {
            // Show login page by default
            document.getElementById('loginPage').style.display = 'block';
            document.getElementById('loginPage').classList.add('active');
            document.getElementById('registerPage').style.display = 'none';
            document.getElementById('registerPage').classList.remove('active');
        }
    });
    
    console.log('✅ App started successfully');
});