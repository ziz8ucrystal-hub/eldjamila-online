// ========== CONFIGURATION ==========
const CONFIG = {
    API_BASE_URL: window.location.origin,
    APP_NAME: 'El Djamila',
    COLORS: {
        primary: '#E75480',
        dark: '#DB7093',
        accent: '#FFB6C1',
        light: '#FFF0F5',
        success: '#4CAF50',
        error: '#FF4444',
        warning: '#FF9800',
        info: '#2196F3'
    }
};

// ========== STATE MANAGEMENT ==========
let state = {
    user: null,
    balance: 0,
    points: 0,
    isAdmin: false,
    language: 'fr',
    offers: [],
    liveSessions: [],
    users: [],
    isLoading: false
};

// ========== DYNAMIC ISLAND NOTIFICATION SYSTEM ==========
class NotificationSystem {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // Create notification container
        this.container = document.createElement('div');
        this.container.className = 'dynamic-island-container';
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 999999;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            width: auto;
            max-width: 400px;
        `;
        document.body.appendChild(this.container);
    }

    show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `dynamic-island ${type}`;
        
        // Map types to icons
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ℹ'
        };
        
        notification.innerHTML = `
            <div class="island-content">
                <span class="island-icon">${icons[type] || icons.info}</span>
                <span class="island-message">${message}</span>
                <button class="island-close">×</button>
            </div>
        `;
        
        // Add styles
        notification.style.cssText = `
            background: ${type === 'error' ? CONFIG.COLORS.error : 
                          type === 'success' ? CONFIG.COLORS.success : 
                          type === 'warning' ? CONFIG.COLORS.warning : 
                          CONFIG.COLORS.primary};
            color: white;
            padding: 12px 20px;
            border-radius: 50px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            backdrop-filter: blur(10px);
            animation: islandSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            min-width: 200px;
            max-width: 350px;
            overflow: hidden;
        `;
        
        const content = notification.querySelector('.island-content');
        content.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            font-weight: 500;
        `;
        
        const icon = notification.querySelector('.island-icon');
        icon.style.cssText = `
            font-size: 16px;
            font-weight: bold;
        `;
        
        const messageSpan = notification.querySelector('.island-message');
        messageSpan.style.cssText = `
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        `;
        
        const closeBtn = notification.querySelector('.island-close');
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            padding: 0;
            line-height: 1;
            opacity: 0.7;
            transition: opacity 0.2s;
        `;
        
        closeBtn.addEventListener('mouseover', () => {
            closeBtn.style.opacity = '1';
        });
        
        closeBtn.addEventListener('mouseout', () => {
            closeBtn.style.opacity = '0.7';
        });
        
        closeBtn.addEventListener('click', () => {
            this.remove(notification);
        });
        
        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes islandSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(-20px) scale(0.9);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
            
            @keyframes islandSlideOut {
                from {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
                to {
                    opacity: 0;
                    transform: translateY(-20px) scale(0.9);
                }
            }
            
            .dynamic-island {
                transition: all 0.3s ease;
            }
        `;
        document.head.appendChild(style);
        
        this.container.appendChild(notification);
        
        // Auto remove after duration
        if (duration > 0) {
            setTimeout(() => {
                this.remove(notification);
            }, duration);
        }
        
        return notification;
    }

    remove(notification) {
        if (notification && notification.parentNode) {
            notification.style.animation = 'islandSlideOut 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }

    success(message, duration = 3000) {
        return this.show(message, 'success', duration);
    }

    error(message, duration = 5000) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration = 4000) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration = 3000) {
        return this.show(message, 'info', duration);
    }
}

// Initialize notification system
const notify = new NotificationSystem();

// ========== API SERVICE ==========
class ApiService {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}/api/${endpoint}`;
        const token = localStorage.getItem('token');
        
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const config = {
            ...options,
            headers
        };
        
        try {
            console.log(`🌐 API Call: ${config.method || 'GET'} ${url}`);
            
            const response = await fetch(url, config);
            
            // Handle 401 Unauthorized
            if (response.status === 401) {
                notify.error('Session expirée. Veuillez vous reconnecter.');
                logout();
                throw new Error('Session expirée');
            }
            
            // Handle other errors
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ API Error ${response.status}:`, errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const data = await response.json();
            
            if (!data.success && data.message) {
                notify.error(data.message);
                throw new Error(data.message);
            }
            
            return data;
            
        } catch (error) {
            console.error('❌ API Request Failed:', error);
            
            if (!error.message.includes('Session expirée')) {
                notify.error('Erreur de connexion au serveur');
            }
            
            throw error;
        }
    }

    // Auth endpoints
    async login(email, password) {
        return this.request('auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    }

    async register(name, email, password) {
        return this.request('auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password })
        });
    }

    async verify() {
        return this.request('auth/verify');
    }

    // Offers endpoints
    async getOffers() {
        return this.request('offers');
    }

    async createOffer(offerData) {
        return this.request('offers/create', {
            method: 'POST',
            body: JSON.stringify(offerData)
        });
    }

    async bookOffer(offerId) {
        return this.request('offers/book', {
            method: 'POST',
            body: JSON.stringify({ offerId })
        });
    }

    // User endpoints
    async updateProfile(profileData) {
        return this.request('user/update', {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
    }

    async chargeBalance(amount) {
        return this.request('user/charge', {
            method: 'POST',
            body: JSON.stringify({ amount })
        });
    }

    async searchUsers(query) {
        return this.request(`users/search?q=${encodeURIComponent(query)}`);
    }

    // Live endpoints
    async getLiveStats() {
        return this.request('live/stats');
    }

    async getLiveSessions() {
        return this.request('live/sessions');
    }

    async createLiveSession(sessionData) {
        return this.request('live/create', {
            method: 'POST',
            body: JSON.stringify(sessionData)
        });
    }

    // Admin endpoints
    async getAdminStats() {
        return this.request('admin/stats');
    }
}

// Initialize API service
const api = new ApiService(CONFIG.API_BASE_URL);

// ========== DOM ELEMENTS ==========
let DOM = {};

function initializeDOM() {
    DOM = {
        // Auth pages
        loginPage: document.getElementById('loginPage'),
        registerPage: document.getElementById('registerPage'),
        loginBtn: document.getElementById('loginBtn'),
        registerBtn: document.getElementById('registerBtn'),
        goToRegister: document.getElementById('goToRegister'),
        goToLogin: document.getElementById('goToLogin'),
        
        // Main app
        mainHeader: document.getElementById('mainHeader'),
        bottomNav: document.getElementById('bottomNav'),
        balanceAmount: document.getElementById('balanceAmount'),
        
        // User elements
        userAvatar: document.getElementById('userAvatar'),
        profileAvatar: document.getElementById('profileAvatar'),
        profileName: document.getElementById('profileName'),
        profileEmail: document.getElementById('profileEmail'),
        profileNameInput: document.getElementById('profileNameInput'),
        profileEmailInput: document.getElementById('profileEmailInput'),
        saveProfileBtn: document.getElementById('saveProfileBtn'),
        profileBalance: document.getElementById('profileBalance'),
        profilePoints: document.getElementById('profilePoints'),
        adminBadgeContainer: document.getElementById('adminBadgeContainer'),
        
        // Navigation
        userDropdown: document.getElementById('userDropdown'),
        logoutBtn: document.getElementById('logoutBtn'),
        logoutSidebarBtn: document.getElementById('logoutSidebarBtn'),
        navItems: document.querySelectorAll('.nav-item'),
        pages: document.querySelectorAll('.page'),
        
        // Offers
        offersContainer: document.getElementById('offersContainer'),
        addOfferBtn: document.getElementById('addOfferBtn'),
        fabBtn: document.getElementById('fabBtn'),
        
        // Live & Contests
        liveContainer: document.getElementById('liveContainer'),
        contestsContainer: document.getElementById('contestsContainer'),
        tabBtns: document.querySelectorAll('.tab-btn'),
        startLiveBtn: document.getElementById('startLiveBtn'),
        
        // Admin
        adminOnlyElements: document.querySelectorAll('.admin-only'),
        manageUsersBtn: document.getElementById('manageUsersBtn'),
        viewStatsBtn: document.getElementById('viewStatsBtn'),
        totalOffers: document.getElementById('totalOffers'),
        totalUsers: document.getElementById('totalUsers'),
        totalRevenue: document.getElementById('totalRevenue'),
        
        // Modals
        addOfferModal: document.getElementById('addOfferModal'),
        cancelOfferBtn: document.getElementById('cancelOfferBtn'),
        saveOfferBtn: document.getElementById('saveOfferBtn'),
        startLiveModal: document.getElementById('startLiveModal'),
        cancelLiveBtn: document.getElementById('cancelLiveBtn'),
        goLiveBtn: document.getElementById('goLiveBtn'),
        createContestModal: document.getElementById('createContestModal'),
        cancelContestBtn: document.getElementById('cancelContestBtn'),
        saveContestBtn: document.getElementById('saveContestBtn'),
        
        // Settings
        settingsBtn: document.getElementById('settingsBtn'),
        settingsMenu: document.getElementById('settingsMenu'),
        langBtns: document.querySelectorAll('.lang-btn'),
        
        // Search
        userSearch: document.getElementById('userSearch'),
        searchResults: document.getElementById('searchResults')
    };
}

// ========== STATE MANAGEMENT FUNCTIONS ==========
function updateState(newState) {
    state = { ...state, ...newState };
    updateUI();
}

function setLoading(isLoading) {
    updateState({ isLoading });
    
    if (isLoading) {
        document.body.classList.add('loading');
    } else {
        document.body.classList.remove('loading');
    }
}

// ========== UI UPDATE FUNCTIONS ==========
function updateUI() {
    updateUserInfo();
    updateBalanceDisplay();
    updateAdminElements();
}

function updateUserInfo() {
    if (!state.user) return;
    
    // Update avatars
    const initials = state.user.name ? state.user.name.charAt(0).toUpperCase() : 'U';
    if (DOM.userAvatar) DOM.userAvatar.textContent = initials;
    if (DOM.profileAvatar) DOM.profileAvatar.textContent = initials;
    
    // Update profile info
    if (DOM.profileName) DOM.profileName.textContent = state.user.name || 'Utilisateur';
    if (DOM.profileEmail) DOM.profileEmail.textContent = state.user.email || 'email@exemple.com';
    if (DOM.profileNameInput) DOM.profileNameInput.value = state.user.name || '';
    if (DOM.profileEmailInput) DOM.profileEmailInput.value = state.user.email || '';
    
    // Update balance and points
    if (DOM.profileBalance) DOM.profileBalance.textContent = `€${state.balance}`;
    if (DOM.profilePoints) DOM.profilePoints.textContent = state.points;
    
    // Update admin badge
    if (DOM.adminBadgeContainer) {
        if (state.isAdmin) {
            DOM.adminBadgeContainer.innerHTML = '<span class="admin-badge">ADMINISTRATEUR</span>';
        } else {
            DOM.adminBadgeContainer.innerHTML = '';
        }
    }
}

function updateBalanceDisplay() {
    if (DOM.balanceAmount) {
        DOM.balanceAmount.textContent = `€${state.balance.toFixed(2)}`;
    }
}

function updateAdminElements() {
    DOM.adminOnlyElements.forEach(el => {
        if (state.isAdmin) {
            el.style.display = 'flex';
            el.classList.add('show');
        } else {
            el.style.display = 'none';
            el.classList.remove('show');
        }
    });
    
    if (DOM.fabBtn) {
        DOM.fabBtn.style.display = state.isAdmin ? 'flex' : 'none';
    }
}

// ========== AUTH FUNCTIONS ==========
async function login(email, password, isAdminLogin = false) {
    setLoading(true);
    
    try {
        const result = await api.login(email, password);
        
        if (result.success) {
            // Save token and user data
            localStorage.setItem('token', result.token);
            localStorage.setItem('user', JSON.stringify(result.user));
            
            // Update state
            updateState({
                user: result.user,
                isAdmin: result.user.role === 'admin',
                balance: result.user.balance || 0,
                points: result.user.points || 0
            });
            
            notify.success('Connexion réussie!');
            
            // Switch to main app
            switchToMainApp();
            
            // Load initial data
            await loadOffers();
            if (state.isAdmin) {
                await updateAdminStats();
            }
        }
    } catch (error) {
        console.error('Login failed:', error);
    } finally {
        setLoading(false);
    }
}

async function register(name, email, password, confirmPassword) {
    if (password !== confirmPassword) {
        notify.error('Les mots de passe ne correspondent pas');
        return;
    }
    
    if (password.length < 6) {
        notify.error('Le mot de passe doit contenir au moins 6 caractères');
        return;
    }
    
    setLoading(true);
    
    try {
        const result = await api.register(name, email, password);
        
        if (result.success) {
            // Save token and user data
            localStorage.setItem('token', result.token);
            localStorage.setItem('user', JSON.stringify(result.user));
            
            // Update state
            updateState({
                user: result.user,
                isAdmin: result.user.role === 'admin',
                balance: result.user.balance || 0,
                points: result.user.points || 0
            });
            
            notify.success('Inscription réussie!');
            
            // Switch to main app
            switchToMainApp();
            
            // Load offers
            await loadOffers();
        }
    } catch (error) {
        console.error('Registration failed:', error);
    } finally {
        setLoading(false);
    }
}

async function checkLoginStatus() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!token || !userStr) {
        return false;
    }
    
    try {
        const result = await api.verify();
        
        if (result.success) {
            updateState({
                user: result.user,
                isAdmin: result.user.role === 'admin',
                balance: result.user.balance || 0,
                points: result.user.points || 0
            });
            
            notify.info('Session restaurée');
            
            switchToMainApp();
            await loadOffers();
            
            if (state.isAdmin) {
                await updateAdminStats();
            }
            
            return true;
        }
    } catch (error) {
        console.log('Session invalid, logging out');
        logout();
        return false;
    }
}

function logout() {
    // Clear localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Reset state
    updateState({
        user: null,
        balance: 0,
        points: 0,
        isAdmin: false,
        offers: [],
        liveSessions: [],
        users: []
    });
    
    // Hide main app
    DOM.mainHeader.style.display = 'none';
    DOM.bottomNav.style.display = 'none';
    
    // Reset login form
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const adminLogin = document.getElementById('adminLogin');
    
    if (loginEmail) loginEmail.value = '';
    if (loginPassword) loginPassword.value = '';
    if (adminLogin) adminLogin.checked = false;
    
    // Show login page
    DOM.loginPage.classList.add('active');
    DOM.registerPage.classList.remove('active');
    
    notify.info('Déconnexion réussie');
}

function switchToMainApp() {
    // Hide auth pages
    DOM.loginPage.classList.remove('active');
    DOM.registerPage.classList.remove('active');
    
    // Show main app
    DOM.mainHeader.style.display = 'flex';
    DOM.bottomNav.style.display = 'flex';
    
    // Update UI
    updateUI();
    
    // Go to home page
    switchPage('home');
}

// ========== PAGE NAVIGATION ==========
function switchPage(pageId) {
    // Check permissions for specific pages
    if (pageId === 'payment' && !state.isAdmin) {
        notify.warning('Le rechargement est réservé aux administrateurs');
        switchPage('home');
        return;
    }
    
    // Hide all pages
    DOM.pages.forEach(page => {
        page.classList.remove('active');
    });
    
    // Show selected page
    const pageElement = document.getElementById(pageId + 'Page');
    if (pageElement) {
        pageElement.classList.add('active');
    }
    
    // Update navigation
    DOM.navItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-page') === pageId) {
            item.classList.add('active');
        }
    });
    
    // Close dropdown if open
    if (DOM.userDropdown) {
        DOM.userDropdown.classList.remove('active');
    }
    
    // Load data for specific pages
    switch (pageId) {
        case 'home':
            loadOffers();
            break;
        case 'offers':
            loadOffers();
            break;
        case 'live':
            loadLiveSessions();
            break;
        case 'admin':
            if (state.isAdmin) {
                updateAdminStats();
            }
            break;
    }
}

// ========== OFFERS MANAGEMENT ==========
async function loadOffers() {
    if (!state.user) return;
    
    setLoading(true);
    
    try {
        const result = await api.getOffers();
        
        if (result.success && result.offers && result.offers.length > 0) {
            updateState({ offers: result.offers });
            renderOffers(result.offers);
        } else {
            DOM.offersContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-cut"></i>
                    <h3>Aucune prestation disponible</h3>
                    <p>Les prestations apparaîtront ici</p>
                    ${state.isAdmin ? `
                        <button class="btn btn-primary mt-12" onclick="DOM.addOfferBtn.click()">
                            <i class="fas fa-plus btn-icon"></i>
                            Ajouter une prestation
                        </button>
                    ` : ''}
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading offers:', error);
        DOM.offersContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Erreur de chargement</h3>
                <p>Impossible de charger les prestations</p>
            </div>
        `;
    } finally {
        setLoading(false);
    }
}

function renderOffers(offers) {
    DOM.offersContainer.innerHTML = '';
    
    offers.forEach(offer => {
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
        
        offerCard.innerHTML = `
            ${badgeHtml}
            <div class="card-image">
                <img src="${offer.image_url || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80'}" 
                     alt="${offer.title}"
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
        
        DOM.offersContainer.appendChild(offerCard);
    });
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
        notify.error('Veuillez remplir tous les champs obligatoires');
        return;
    }
    
    setLoading(true);
    
    try {
        const result = await api.createOffer({
            title: name,
            type: type,
            original_price: parseFloat(originalPrice),
            promo_price: promoPrice ? parseFloat(promoPrice) : null,
            description: description,
            image_url: image || null,
            badge: promoBadge || null
        });
        
        if (result.success) {
            notify.success('Prestation ajoutée avec succès!');
            
            // Reload offers
            await loadOffers();
            
            // Update admin stats
            await updateAdminStats();
            
            // Close modal and clear form
            DOM.addOfferModal.classList.remove('active');
            clearOfferForm();
        }
    } catch (error) {
        console.error('Create offer error:', error);
    } finally {
        setLoading(false);
    }
}

async function bookOffer(offerId) {
    if (!state.user) {
        notify.warning('Veuillez vous connecter pour réserver');
        switchPage('profile');
        return;
    }
    
    if (!confirm('Confirmer la réservation?')) {
        return;
    }
    
    setLoading(true);
    
    try {
        const result = await api.bookOffer(offerId);
        
        if (result.success) {
            // Update state
            updateState({
                balance: result.userBalance || state.balance,
                points: result.userPoints || state.points,
                user: result.user || state.user
            });
            
            // Save updated user
            if (result.user) {
                localStorage.setItem('user', JSON.stringify(result.user));
            }
            
            notify.success('Réservation effectuée avec succès!');
        }
    } catch (error) {
        console.error('Booking error:', error);
    } finally {
        setLoading(false);
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
        const result = await api.getLiveSessions();
        
        if (result.success && result.sessions && result.sessions.length > 0) {
            updateState({ liveSessions: result.sessions });
            renderLiveSessions(result.sessions);
        } else {
            DOM.liveContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-video"></i>
                    <h3>Aucune séance en direct</h3>
                    <p>${state.isAdmin ? 'Commencez votre première séance' : 'Aucune séance en ce moment'}</p>
                    ${state.isAdmin ? `
                        <button class="btn btn-primary mt-12" onclick="DOM.startLiveBtn.click()">
                            <i class="fas fa-broadcast-tower btn-icon"></i>
                            Démarrer une séance
                        </button>
                    ` : ''}
                </div>
            `;
        }
        
        // Load live stats
        if (state.isAdmin) {
            await loadLiveStats();
        }
    } catch (error) {
        console.error('Error loading live sessions:', error);
    }
}

function renderLiveSessions(sessions) {
    DOM.liveContainer.innerHTML = '';
    
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
                <button class="btn btn-primary btn-full mt-12">
                    <i class="fas fa-play btn-icon"></i>
                    ${isActive ? 'Rejoindre la séance' : 'Voir le replay'}
                </button>
            </div>
        `;
        
        DOM.liveContainer.appendChild(sessionCard);
    });
}

async function loadLiveStats() {
    try {
        const result = await api.getLiveStats();
        
        if (result.success) {
            const stats = result.stats;
            
            // Create stats cards
            const statsHTML = `
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
            
            // Insert stats before live container
            const livePage = document.getElementById('livePage');
            const existingStats = livePage.querySelector('.live-stats');
            
            if (existingStats) {
                existingStats.innerHTML = statsHTML;
            } else {
                const statsContainer = document.createElement('div');
                statsContainer.className = 'live-stats';
                statsContainer.innerHTML = statsHTML;
                DOM.liveContainer.parentNode.insertBefore(statsContainer, DOM.liveContainer);
            }
        }
    } catch (error) {
        console.error('Error loading live stats:', error);
    }
}

// ========== USER MANAGEMENT ==========
async function searchUsers() {
    const query = DOM.userSearch ? DOM.userSearch.value.trim() : '';
    
    if (!query) {
        notify.warning('Veuillez entrer un terme de recherche');
        return;
    }
    
    setLoading(true);
    
    try {
        const result = await api.searchUsers(query);
        
        if (result.success && result.users.length > 0) {
            renderSearchResults(result.users);
        } else {
            if (DOM.searchResults) {
                DOM.searchResults.innerHTML = `
                    <div class="no-results">
                        <i class="fas fa-search"></i>
                        <p>Aucun utilisateur trouvé</p>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Search error:', error);
    } finally {
        setLoading(false);
    }
}

function renderSearchResults(users) {
    if (!DOM.searchResults) return;
    
    DOM.searchResults.innerHTML = '';
    
    users.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-result-item';
        
        const initials = user.name ? user.name.charAt(0).toUpperCase() : 'U';
        const isAdmin = user.role === 'admin';
        
        userItem.innerHTML = `
            <div class="user-avatar-small">${initials}</div>
            <div class="user-info">
                <h4>${user.name} ${isAdmin ? '<span class="admin-badge">ADMIN</span>' : ''}</h4>
                <p>${user.email}</p>
                <div class="user-stats">
                    <span>€${user.balance || 0}</span>
                    <span>${user.points || 0} pts</span>
                    <span>${new Date(user.createdAt).toLocaleDateString('fr-FR')}</span>
                </div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="viewUserDetails('${user.id || user._id}')">
                <i class="fas fa-eye"></i>
            </button>
        `;
        
        DOM.searchResults.appendChild(userItem);
    });
}

function viewUserDetails(userId) {
    notify.info(`Affichage des détails de l'utilisateur: ${userId}`);
    // Implement user details view
}

// ========== ADMIN FUNCTIONS ==========
async function updateAdminStats() {
    if (!state.isAdmin) return;
    
    try {
        const result = await api.getAdminStats();
        
        if (result.success) {
            const stats = result.stats;
            
            if (DOM.totalOffers) DOM.totalOffers.textContent = stats.totalOffers || 0;
            if (DOM.totalUsers) DOM.totalUsers.textContent = stats.totalUsers || 1;
            if (DOM.totalRevenue) DOM.totalRevenue.textContent = `€${stats.totalRevenue || 0}`;
        }
    } catch (error) {
        console.error('Error loading admin stats:', error);
    }
}

// ========== PROFILE MANAGEMENT ==========
async function saveProfile() {
    const newName = DOM.profileNameInput.value.trim();
    const newEmail = DOM.profileEmailInput.value.trim();
    const phone = document.getElementById('profilePhone')?.value.trim() || '';
    
    if (!newName) {
        notify.error('Veuillez entrer votre nom');
        return;
    }
    
    setLoading(true);
    
    try {
        const result = await api.updateProfile({
            name: newName,
            email: newEmail,
            phone: phone
        });
        
        if (result.success) {
            // Update state
            updateState({
                user: result.user,
                balance: result.user.balance || state.balance,
                points: result.user.points || state.points
            });
            
            // Save updated user
            localStorage.setItem('user', JSON.stringify(result.user));
            
            notify.success('Profil mis à jour avec succès!');
        }
    } catch (error) {
        console.error('Update profile error:', error);
    } finally {
        setLoading(false);
    }
}

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', function() {
    // Initialize DOM elements
    initializeDOM();
    
    // Initialize UI
    updateBalanceDisplay();
    
    // Check login status
    checkLoginStatus();
    
    // ========== EVENT LISTENERS ==========
    
    // Auth page switching
    if (DOM.goToRegister) {
        DOM.goToRegister.addEventListener('click', (e) => {
            e.preventDefault();
            DOM.loginPage.classList.remove('active');
            DOM.registerPage.classList.add('active');
        });
    }
    
    if (DOM.goToLogin) {
        DOM.goToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            DOM.registerPage.classList.remove('active');
            DOM.loginPage.classList.add('active');
        });
    }
    
    // Login
    if (DOM.loginBtn) {
        DOM.loginBtn.addEventListener('click', async () => {
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value.trim();
            const isAdminLogin = document.getElementById('adminLogin').checked;
            
            if (!email || !password) {
                notify.error('Veuillez remplir tous les champs');
                return;
            }
            
            await login(email, password, isAdminLogin);
        });
    }
    
    // Register
    if (DOM.registerBtn) {
        DOM.registerBtn.addEventListener('click', async () => {
            const name = document.getElementById('registerName').value.trim();
            const email = document.getElementById('registerEmail').value.trim();
            const password = document.getElementById('registerPassword').value.trim();
            const confirmPassword = document.getElementById('registerConfirmPassword').value.trim();
            
            if (!name || !email || !password || !confirmPassword) {
                notify.error('Veuillez remplir tous les champs');
                return;
            }
            
            await register(name, email, password, confirmPassword);
        });
    }
    
    // Navigation
    DOM.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = item.getAttribute('data-page');
            switchPage(pageId);
        });
    });
    
    // User avatar click
    if (DOM.userAvatar) {
        DOM.userAvatar.addEventListener('click', () => {
            DOM.userDropdown.classList.toggle('active');
        });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (DOM.userAvatar && DOM.userDropdown && 
            !DOM.userAvatar.contains(e.target) && 
            !DOM.userDropdown.contains(e.target)) {
            DOM.userDropdown.classList.remove('active');
        }
    });
    
    // Settings menu
    if (DOM.settingsBtn) {
        DOM.settingsBtn.addEventListener('click', () => {
            DOM.settingsMenu.classList.toggle('active');
        });
    }
    
    // Language switching
    DOM.langBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang');
            
            // Update active language button
            DOM.langBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Change language
            updateState({ language: lang });
            
            // Show notification
            const langNames = {
                fr: 'Français',
                en: 'English',
                ar: 'العربية'
            };
            notify.success(`Langue changée: ${langNames[lang] || lang}`);
            
            // Close settings menu
            DOM.settingsMenu.classList.remove('active');
        });
    });
    
    // FAB Button
    if (DOM.fabBtn) {
        DOM.fabBtn.addEventListener('click', () => {
            if (DOM.addOfferModal) {
                DOM.addOfferModal.classList.add('active');
            }
        });
    }
    
    // Tab switching
    DOM.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            // Update active tab button
            DOM.tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Show active tab content
            if (tabId === 'live') {
                DOM.liveContainer.classList.remove('hidden');
                DOM.contestsContainer.classList.add('hidden');
            } else {
                DOM.liveContainer.classList.add('hidden');
                DOM.contestsContainer.classList.remove('hidden');
            }
        });
    });
    
    // Add Offer Modal
    if (DOM.addOfferBtn) {
        DOM.addOfferBtn.addEventListener('click', () => {
            DOM.addOfferModal.classList.add('active');
        });
    }
    
    if (DOM.cancelOfferBtn) {
        DOM.cancelOfferBtn.addEventListener('click', () => {
            DOM.addOfferModal.classList.remove('active');
            clearOfferForm();
        });
    }
    
    if (DOM.saveOfferBtn) {
        DOM.saveOfferBtn.addEventListener('click', createOffer);
    }
    
    // Start Live Modal
    if (DOM.startLiveBtn) {
        DOM.startLiveBtn.addEventListener('click', () => {
            DOM.startLiveModal.classList.add('active');
        });
    }
    
    if (DOM.cancelLiveBtn) {
        DOM.cancelLiveBtn.addEventListener('click', () => {
            DOM.startLiveModal.classList.remove('active');
            clearLiveForm();
        });
    }
    
    if (DOM.goLiveBtn) {
        DOM.goLiveBtn.addEventListener('click', async () => {
            const title = document.getElementById('liveTitle').value.trim();
            const description = document.getElementById('liveDescription').value.trim();
            
            if (!title) {
                notify.error('Veuillez saisir un titre pour votre séance');
                return;
            }
            
            try {
                const result = await api.createLiveSession({ title, description });
                
                if (result.success) {
                    notify.success('Séance en direct démarrée!');
                    
                    // Reload live sessions
                    await loadLiveSessions();
                    
                    // Close modal
                    DOM.startLiveModal.classList.remove('active');
                    clearLiveForm();
                    
                    // Switch to live page
                    switchPage('live');
                }
            } catch (error) {
                console.error('Start live error:', error);
            }
        });
    }
    
    // Create Contest Modal
    if (DOM.createContestBtn) {
        DOM.createContestBtn.addEventListener('click', () => {
            DOM.createContestModal.classList.add('active');
        });
    }
    
    if (DOM.cancelContestBtn) {
        DOM.cancelContestBtn.addEventListener('click', () => {
            DOM.createContestModal.classList.remove('active');
            clearContestForm();
        });
    }
    
    // Save Profile
    if (DOM.saveProfileBtn) {
        DOM.saveProfileBtn.addEventListener('click', saveProfile);
    }
    
    // Logout
    if (DOM.logoutBtn) {
        DOM.logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
    
    if (DOM.logoutSidebarBtn) {
        DOM.logoutSidebarBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
    
    // Manage Users Button
    if (DOM.manageUsersBtn) {
        DOM.manageUsersBtn.addEventListener('click', () => {
            notify.info('Gestion des utilisateurs à venir bientôt!');
        });
    }
    
    // View Stats Button
    if (DOM.viewStatsBtn) {
        DOM.viewStatsBtn.addEventListener('click', () => {
            notify.info('Statistiques détaillées à venir bientôt!');
        });
    }
    
    // User Search
    if (DOM.userSearch) {
        DOM.userSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchUsers();
            }
        });
    }
    
    // Close modals when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    // Add loading styles
    const style = document.createElement('style');
    style.textContent = `
        .loading {
            position: relative;
        }
        
        .loading::after {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(2px);
            z-index: 9998;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .loading::before {
            content: '';
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 50px;
            height: 50px;
            border: 3px solid ${CONFIG.COLORS.primary};
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            z-index: 9999;
        }
        
        @keyframes spin {
            0% { transform: translate(-50%, -50%) rotate(0deg); }
            100% { transform: translate(-50%, -50%) rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
});

// ========== HELPER FUNCTIONS ==========
function clearLiveForm() {
    document.getElementById('liveTitle').value = '';
    document.getElementById('liveDescription').value = '';
    document.getElementById('liveSchedule').value = '';
}

function clearContestForm() {
    document.getElementById('contestName').value = '';
    document.getElementById('contestDescription').value = '';
    document.getElementById('contestEndDate').value = '';
    document.getElementById('contestPrize').value = '';
}

// ========== GLOBAL FUNCTIONS ==========
window.switchPage = switchPage;
window.bookOffer = bookOffer;
window.searchUsers = searchUsers;
window.logout = logout;