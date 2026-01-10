// ============================================
// EL DJAMILA SALON - REAL PRODUCTION APP
// NO TEST DATA - EVERYTHING STARTS EMPTY
// ============================================

// ========== GLOBAL VARIABLES ==========
let userBalance = 0; // صفر - سيرفع من السيرفر
let userPoints = 0;  // صفر - سيرفع من السيرفر
let currentLanguage = 'fr';
let currentUser = null;
let isAdmin = false;
let allOffers = []; // فارغ تماماً - سيتم ملؤه من السيرفر
let liveSessions = []; // فارغ - من السيرفر
let allUsers = []; // فارغ - للمسؤول فقط

// ========== API CONFIG ==========
const API_BASE_URL = window.location.origin;

// ========== REAL DYNAMIC ISLAND SYSTEM ==========
class RealNotification {
    constructor() {
        this.container = document.createElement('div');
        this.container.className = 'dynamic-island-container';
        document.body.appendChild(this.container);
    }

    show(message, type = 'info', duration = 4000) {
        const notification = document.createElement('div');
        notification.className = `dynamic-island ${type}`;
        notification.innerHTML = `
            <div class="island-content">
                <span class="island-icon">${this.getIcon(type)}</span>
                <span class="island-text">${message}</span>
            </div>
        `;

        this.container.appendChild(notification);

        // Add animation
        setTimeout(() => notification.classList.add('show'), 10);

        // Auto remove
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, duration);

        // Click to close
        notification.onclick = () => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        };
    }

    getIcon(type) {
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ⓘ'
        };
        return icons[type] || 'ⓘ';
    }
}

const notificationSystem = new RealNotification();

// ========== REAL API CALL ==========
async function realApiCall(endpoint, method = 'GET', data = null) {
    const token = localStorage.getItem('token');
    
    const headers = {
        'Content-Type': 'application/json',
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const options = {
        method,
        headers,
        credentials: 'include'
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/${endpoint}`, options);
        
        if (response.status === 401) {
            notificationSystem.show('Session expirée - Veuillez vous reconnecter', 'error');
            logout();
            throw new Error('Unauthorized');
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'API Error');
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        notificationSystem.show(`Erreur: ${error.message}`, 'error');
        throw error;
    }
}

// ========== AUTH SYSTEM ==========
async function realLogin(email, password) {
    try {
        const result = await realApiCall('auth/login', 'POST', { email, password });
        
        if (result.token) {
            localStorage.setItem('token', result.token);
            localStorage.setItem('user', JSON.stringify(result.user));
            
            currentUser = result.user;
            isAdmin = result.user.role === 'admin';
            userBalance = result.user.balance || 0;
            userPoints = result.user.points || 0;
            
            notificationSystem.show('Connexion réussie', 'success');
            loadRealData();
            showMainApp();
            
            return true;
        }
    } catch (error) {
        console.error('Login failed:', error);
    }
    return false;
}

async function realRegister(name, email, password) {
    try {
        const result = await realApiCall('auth/register', 'POST', {
            name, email, password, role: 'user'
        });
        
        if (result.success) {
            notificationSystem.show('Compte créé avec succès', 'success');
            return true;
        }
    } catch (error) {
        console.error('Registration failed:', error);
    }
    return false;
}

// ========== REAL DATA LOADING ==========
async function loadRealData() {
    if (!currentUser) return;
    
    // Load offers
    try {
        const offersData = await realApiCall('offers');
        allOffers = offersData.offers || [];
        renderRealOffers();
    } catch (error) {
        allOffers = [];
        renderRealOffers();
    }
    
    // Load live sessions
    try {
        const liveData = await realApiCall('live/sessions');
        liveSessions = liveData.sessions || [];
        renderRealLiveSessions();
    } catch (error) {
        liveSessions = [];
        renderRealLiveSessions();
    }
    
    // Load users if admin
    if (isAdmin) {
        try {
            const usersData = await realApiCall('admin/users');
            allUsers = usersData.users || [];
            updateRealAdminStats();
        } catch (error) {
            allUsers = [];
        }
    }
}

// ========== REAL OFFERS RENDERING ==========
function renderRealOffers() {
    const container = document.getElementById('offersContainer') || 
                     document.getElementById('homeOffersContainer');
    
    if (!container) return;
    
    if (allOffers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-gift"></i>
                <h3>Aucune offre disponible</h3>
                <p>Les offres apparaîtront ici lorsqu'elles seront ajoutées</p>
                ${isAdmin ? `
                    <button class="btn btn-primary" onclick="showAddOfferModal()">
                        Ajouter la première offre
                    </button>
                ` : ''}
            </div>
        `;
        return;
    }
    
    container.innerHTML = allOffers.map(offer => `
        <div class="real-offer-card" data-id="${offer._id || offer.id}">
            <div class="offer-image">
                <img src="${offer.image || '/api/placeholder/400/300'}" 
                     alt="${offer.title}"
                     onerror="this.src='/api/placeholder/400/300'">
                ${offer.discount ? `
                    <div class="discount-badge">-${offer.discount}%</div>
                ` : ''}
            </div>
            <div class="offer-content">
                <span class="offer-category">${offer.category || 'Service'}</span>
                <h3 class="offer-title">${offer.title}</h3>
                <p class="offer-desc">${offer.description || ''}</p>
                
                <div class="offer-footer">
                    <div class="pricing">
                        ${offer.oldPrice ? `
                            <span class="old-price">€${offer.oldPrice}</span>
                        ` : ''}
                        <span class="current-price">€${offer.price}</span>
                    </div>
                    <button class="book-btn" onclick="bookRealOffer('${offer._id || offer.id}')">
                        Réserver
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// ========== REAL LIVE SESSIONS ==========
function renderRealLiveSessions() {
    const container = document.getElementById('liveContainer');
    if (!container) return;
    
    if (liveSessions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-video"></i>
                <h3>Aucune session en direct</h3>
                <p>${isAdmin ? 'Vous pouvez démarrer la première session' : 'Revenez plus tard'}</p>
                ${isAdmin ? `
                    <button class="btn btn-primary" onclick="showStartLiveModal()">
                        Démarrer une session
                    </button>
                ` : ''}
            </div>
        `;
        return;
    }
    
    container.innerHTML = liveSessions.map(session => `
        <div class="live-session-card ${session.status === 'live' ? 'is-live' : ''}">
            <div class="live-header">
                <div class="live-status">
                    ${session.status === 'live' ? `
                        <span class="live-indicator"></span>
                        <span>EN DIRECT</span>
                    ` : '<span>TERMINÉ</span>'}
                </div>
                <span class="viewers">👁 ${session.viewers || 0}</span>
            </div>
            
            <div class="live-content">
                <h3>${session.title}</h3>
                <p>${session.description || ''}</p>
                
                <div class="live-meta">
                    <span>${formatTime(session.duration || 0)}</span>
                    <span>${formatDate(session.createdAt)}</span>
                </div>
                
                ${session.status === 'live' ? `
                    <button class="join-btn" onclick="joinRealLive('${session.id}')">
                        Rejoindre
                    </button>
                ` : `
                    <button class="replay-btn" onclick="watchReplay('${session.id}')">
                        Voir le replay
                    </button>
                `}
            </div>
        </div>
    `).join('');
    
    updateRealLiveStats();
}

function updateRealLiveStats() {
    const statsContainer = document.getElementById('liveStats');
    if (!statsContainer) return;
    
    const totalSessions = liveSessions.length;
    const activeSessions = liveSessions.filter(s => s.status === 'live').length;
    const totalDuration = liveSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    
    statsContainer.innerHTML = `
        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-number">${totalSessions}</div>
                <div class="stat-label">Sessions totales</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${activeSessions}</div>
                <div class="stat-label">En direct</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${Math.round(totalDuration / 60)}h</div>
                <div class="stat-label">Durée totale</div>
            </div>
        </div>
    `;
}

// ========== REAL USER BALANCE CARD ==========
function updateRealBalanceCard() {
    const balanceCard = document.getElementById('balanceCard');
    if (!balanceCard) return;
    
    // للمستخدم العادي: عرض الرصيد فقط بدون شحن
    if (!isAdmin) {
        balanceCard.innerHTML = `
            <div class="balance-display-card">
                <div class="balance-header">
                    <h3>Mon Solde</h3>
                    <i class="fas fa-wallet"></i>
                </div>
                <div class="balance-amount">€${userBalance.toFixed(2)}</div>
                <div class="balance-points">
                    <i class="fas fa-star"></i>
                    <span>${userPoints} points</span>
                </div>
                <p class="balance-note">Contactez l'admin pour recharger</p>
            </div>
        `;
    } else {
        // للمسؤول: عرض رصيده + أدوات الشحن
        balanceCard.innerHTML = `
            <div class="admin-balance-card">
                <div class="admin-section">
                    <h3>Mon Solde</h3>
                    <div class="admin-balance">€${userBalance.toFixed(2)}</div>
                    <div class="admin-points">${userPoints} points</div>
                </div>
                
                <div class="charge-section">
                    <h4>Recharger un client</h4>
                    <div class="charge-form">
                        <input type="number" id="chargeAmount" class="charge-input" 
                               placeholder="Montant (€)" min="1" step="0.01">
                        <input type="email" id="clientEmail" class="charge-input" 
                               placeholder="Email du client">
                        <button class="charge-btn" onclick="chargeClientBalance()">
                            <i class="fas fa-plus"></i> Recharger
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
}

// ========== REAL FUNCTIONS ==========
async function addRealOffer(offerData) {
    if (!isAdmin) {
        notificationSystem.show('Accès refusé', 'error');
        return;
    }
    
    try {
        const result = await realApiCall('offers/create', 'POST', offerData);
        if (result.success) {
            notificationSystem.show('Offre ajoutée', 'success');
            loadRealData();
        }
    } catch (error) {
        console.error('Add offer failed:', error);
    }
}

async function bookRealOffer(offerId) {
    if (!currentUser) {
        notificationSystem.show('Connectez-vous pour réserver', 'warning');
        return;
    }
    
    try {
        const result = await realApiCall('offers/book', 'POST', { offerId });
        if (result.success) {
            userBalance = result.newBalance;
            userPoints = result.newPoints;
            updateRealBalanceCard();
            notificationSystem.show('Réservation confirmée', 'success');
        }
    } catch (error) {
        notificationSystem.show('Erreur de réservation', 'error');
    }
}

async function startRealLive(title, description) {
    if (!isAdmin) {
        notificationSystem.show('Admin seulement', 'error');
        return;
    }
    
    try {
        const result = await realApiCall('live/create', 'POST', { title, description });
        if (result.session) {
            notificationSystem.show('Session démarrée', 'success');
            loadRealData();
        }
    } catch (error) {
        console.error('Start live failed:', error);
    }
}

async function chargeClientBalance() {
    if (!isAdmin) return;
    
    const amount = parseFloat(document.getElementById('chargeAmount').value);
    const clientEmail = document.getElementById('clientEmail').value.trim();
    
    if (!amount || amount <= 0 || !clientEmail) {
        notificationSystem.show('Données invalides', 'error');
        return;
    }
    
    try {
        const result = await realApiCall('admin/charge', 'POST', {
            clientEmail,
            amount
        });
        
        if (result.success) {
            notificationSystem.show(`Solde rechargé pour ${clientEmail}`, 'success');
            document.getElementById('chargeAmount').value = '';
            document.getElementById('clientEmail').value = '';
        }
    } catch (error) {
        console.error('Charge failed:', error);
    }
}

// ========== REAL USER SEARCH ==========
function initRealUserSearch() {
    const searchInput = document.getElementById('userSearchInput');
    const resultsContainer = document.getElementById('searchResults');
    
    if (!searchInput || !resultsContainer) return;
    
    searchInput.addEventListener('input', async (e) => {
        const query = e.target.value.trim();
        
        if (query.length < 2) {
            resultsContainer.innerHTML = '';
            resultsContainer.style.display = 'none';
            return;
        }
        
        try {
            const result = await realApiCall(`users/search?q=${encodeURIComponent(query)}`);
            displayRealSearchResults(result.users || []);
        } catch (error) {
            resultsContainer.innerHTML = '<div class="search-error">Erreur de recherche</div>';
        }
    });
}

function displayRealSearchResults(users) {
    const container = document.getElementById('searchResults');
    if (!container) return;
    
    if (users.length === 0) {
        container.innerHTML = '<div class="no-results">Aucun utilisateur trouvé</div>';
        container.style.display = 'block';
        return;
    }
    
    container.innerHTML = users.map(user => `
        <div class="user-result" onclick="viewUserDetails('${user._id}')">
            <div class="user-avatar">${user.name.charAt(0).toUpperCase()}</div>
            <div class="user-info">
                <strong>${user.name}</strong>
                <small>${user.email}</small>
                <div class="user-meta">
                    <span>€${user.balance || 0}</span>
                    <span>${user.points || 0} pts</span>
                </div>
            </div>
        </div>
    `).join('');
    
    container.style.display = 'block';
}

// ========== REAL INITIALIZATION ==========
async function initRealApp() {
    // Check existing session
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (token && userStr) {
        try {
            const result = await realApiCall('auth/verify');
            if (result.user) {
                currentUser = result.user;
                isAdmin = result.user.role === 'admin';
                userBalance = result.user.balance || 0;
                userPoints = result.user.points || 0;
                
                showMainApp();
                loadRealData();
                updateRealBalanceCard();
                
                if (isAdmin) {
                    initRealUserSearch();
                }
                
                notificationSystem.show('Session restaurée', 'info');
                return;
            }
        } catch (error) {
            console.log('Session invalid');
        }
    }
    
    // Show login if no valid session
    showLoginPage();
}

// ========== REAL PAGE MANAGEMENT ==========
function showLoginPage() {
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginPage').style.display = 'block';
}

function showMainApp() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
}

// ========== REAL HELPER FUNCTIONS ==========
function formatTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR');
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    currentUser = null;
    isAdmin = false;
    userBalance = 0;
    userPoints = 0;
    allOffers = [];
    liveSessions = [];
    allUsers = [];
    
    showLoginPage();
    notificationSystem.show('Déconnecté', 'info');
}

// ========== GLOBAL EXPORTS ==========
window.realLogin = realLogin;
window.realRegister = realRegister;
window.addRealOffer = addRealOffer;
window.bookRealOffer = bookRealOffer;
window.startRealLive = startRealLive;
window.chargeClientBalance = chargeClientBalance;
window.logout = logout;

// ========== START REAL APP ==========
document.addEventListener('DOMContentLoaded', initRealApp);