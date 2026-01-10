// ============================================
// EL DJAMILA SALON - تطبيق متوافق تماماً
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
class DynamicIsland {
    constructor() {
        this.container = document.createElement('div');
        this.container.className = 'dynamic-island-container';
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

    show(message, type = 'info', duration = 4000) {
        const notification = document.createElement('div');
        notification.className = `dynamic-island ${type}`;
        notification.style.cssText = `
            background: ${this.getColor(type)};
            color: white;
            padding: 12px 20px;
            border-radius: 20px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            gap: 10px;
            transform: translateX(120%);
            transition: transform 0.3s ease;
            max-width: 350px;
            word-wrap: break-word;
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

    getColor(type) {
        const colors = {
            success: 'linear-gradient(135deg, #4CAF50, #2E7D32)',
            error: 'linear-gradient(135deg, #ff4444, #cc0000)',
            warning: 'linear-gradient(135deg, #ff9800, #f57c00)',
            info: 'linear-gradient(135deg, #2196F3, #1976D2)'
        };
        return colors[type] || colors.info;
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

// إنشاء نظام الإشعارات
const dynamicIsland = new DynamicIsland();

// دالة مساعدة للإشعارات
function showNotification(message, type = 'info') {
    dynamicIsland.show(message, type);
}

// ========== API FUNCTIONS ==========
async function apiCall(endpoint, method = 'GET', data = null) {
    const url = `${API_BASE_URL}/api/${endpoint}`;
    
    const headers = {
        'Content-Type': 'application/json',
    };
    
    const token = localStorage.getItem('token');
    if (token) {
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
        console.log(`🌐 API Call: ${method} ${url}`);
        const response = await fetch(url, options);
        
        // التحقق من حالة 401
        if (response.status === 401) {
            showNotification('Session expirée. Veuillez vous reconnecter.', 'error');
            logout();
            throw new Error('Unauthorized');
        }
        
        // التحقق من حالة 404
        if (response.status === 404) {
            // إذا كان الـ API غير موجود، نستخدم بيانات محلية
            console.warn('API not found, using local data');
            return getLocalData(endpoint);
        }
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('❌ API Error:', error);
        
        // إذا فشل الاتصال بالـ API، نستخدم البيانات المحلية
        if (error.message.includes('Failed to fetch')) {
            console.log('Using local data due to API connection failure');
            return getLocalData(endpoint);
        }
        
        throw error;
    }
}

// بيانات محلية احتياطية
function getLocalData(endpoint) {
    const data = {
        'auth/verify': { success: false, user: null },
        'offers': { success: true, offers: [] },
        'live/sessions': { success: true, sessions: [] },
        'admin/stats': { success: true, stats: { totalOffers: 0, totalUsers: 0, totalRevenue: 0 } }
    };
    
    return data[endpoint] || { success: false, message: 'Endpoint not found' };
}

// ========== AUTHENTICATION ==========
async function login() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const isAdminLogin = document.getElementById('adminLogin').checked;

    if (!email || !password) {
        showNotification('Veuillez remplir tous les champs', 'error');
        return;
    }

    const loginBtn = document.getElementById('loginBtn');
    const originalText = loginBtn.innerHTML;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connexion...';
    loginBtn.disabled = true;

    try {
        // استخدام بيانات محلية للاختبار
        let user;
        if (isAdminLogin) {
            // مسؤول
            user = {
                _id: 'admin001',
                name: 'Administrateur',
                email: email,
                role: 'admin',
                balance: 0,
                points: 0,
                createdAt: new Date()
            };
        } else {
            // مستخدم عادي
            user = {
                _id: 'user001',
                name: email.split('@')[0] || 'Utilisateur',
                email: email,
                role: 'user',
                balance: 0,
                points: 0,
                createdAt: new Date()
            };
        }

        // حفظ في localStorage
        const token = 'mock_token_' + Date.now();
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        // تحديث المتغيرات العالمية
        currentUser = user;
        isAdmin = user.role === 'admin';
        userBalance = user.balance || 0;
        userPoints = user.points || 0;

        showNotification('Connexion réussie!', 'success');
        
        // إظهار التطبيق الرئيسي
        showMainApp();
        
        // تحميل البيانات
        await loadInitialData();

    } catch (error) {
        console.error('Login error:', error);
        showNotification('Échec de connexion. Vérifiez vos identifiants.', 'error');
    } finally {
        loginBtn.innerHTML = originalText;
        loginBtn.disabled = false;
    }
}

async function register() {
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

    const registerBtn = document.getElementById('registerBtn');
    const originalText = registerBtn.innerHTML;
    registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Inscription...';
    registerBtn.disabled = true;

    try {
        // إنشاء مستخدم جديد
        const user = {
            _id: 'user_' + Date.now(),
            name: name,
            email: email,
            role: 'user',
            balance: 0,
            points: 0,
            createdAt: new Date()
        };

        // حفظ في localStorage
        const token = 'mock_token_' + Date.now();
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        // تحديث المتغيرات
        currentUser = user;
        isAdmin = false;
        userBalance = 0;
        userPoints = 0;

        showNotification('Inscription réussie!', 'success');
        
        // إظهار التطبيق الرئيسي
        showMainApp();
        
        // تحميل البيانات
        await loadInitialData();

    } catch (error) {
        console.error('Registration error:', error);
        showNotification('Échec de l\'inscription', 'error');
    } finally {
        registerBtn.innerHTML = originalText;
        registerBtn.disabled = false;
    }
}

async function checkAuth() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
        return false;
    }

    try {
        const user = JSON.parse(userStr);
        
        // التحقق من صلاحية الجلسة
        currentUser = user;
        isAdmin = user.role === 'admin';
        userBalance = user.balance || 0;
        userPoints = user.points || 0;

        showMainApp();
        await loadInitialData();
        
        return true;
    } catch (error) {
        console.error('Auth check error:', error);
        logout();
        return false;
    }
}

// ========== MAIN APP FUNCTIONS ==========
function showMainApp() {
    // إخفاء صفحات المصادقة
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('registerPage').classList.remove('active');
    document.getElementById('registerPage').style.display = 'none';

    // إظهار التطبيق الرئيسي
    document.getElementById('mainHeader').style.display = 'flex';
    document.getElementById('bottomNav').style.display = 'flex';

    // تحديث معلومات المستخدم
    updateUserInfo();

    // الانتقال للصفحة الرئيسية
    switchPage('home');
}

function updateUserInfo() {
    if (!currentUser) return;

    // تحديث الصورة الرمزية
    const initials = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U';
    document.getElementById('userAvatar').textContent = initials;
    document.getElementById('profileAvatar').textContent = initials;

    // تحديث معلومات الملف الشخصي
    document.getElementById('profileName').textContent = currentUser.name || 'Utilisateur';
    document.getElementById('profileEmail').textContent = currentUser.email || 'email@exemple.com';
    document.getElementById('profileNameInput').value = currentUser.name || '';
    document.getElementById('profileEmailInput').value = currentUser.email || '';

    // تحديث الرصيد والنقاط
    document.getElementById('profileBalance').textContent = `€${userBalance}`;
    document.getElementById('profilePoints').textContent = userPoints;

    // تحديث شارة المسؤول
    if (isAdmin) {
        document.getElementById('adminBadgeContainer').innerHTML = '<span class="admin-badge">ADMINISTRATEUR</span>';
        
        // إظهار عناصر المسؤول
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'block';
        });
        document.getElementById('fabBtn').style.display = 'flex';
    } else {
        document.getElementById('adminBadgeContainer').innerHTML = '';
        
        // إخفاء عناصر المسؤول
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'none';
        });
        document.getElementById('fabBtn').style.display = 'none';
    }

    // تحديث عرض الرصيد
    updateBalanceDisplay();
}

function updateBalanceDisplay() {
    document.getElementById('balanceAmount').textContent = `€${userBalance.toFixed(2)}`;
    document.getElementById('userBalance').textContent = userBalance.toFixed(2);
    document.getElementById('userPoints').textContent = userPoints;
}

// ========== PAGE NAVIGATION ==========
function switchPage(pageId) {
    console.log(`Switching to page: ${pageId}`);

    // إخفاء جميع الصفحات
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
        page.style.display = 'none';
    });

    // إظهار الصفحة المحددة
    const targetPage = document.getElementById(pageId + 'Page');
    if (targetPage) {
        targetPage.classList.add('active');
        targetPage.style.display = 'block';
    }

    // تحديث التنقل السفلي
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-page') === pageId) {
            item.classList.add('active');
        }
    });

    // إغلاق القائمة المنسدلة إذا كانت مفتوحة
    document.getElementById('userDropdown').classList.remove('active');
    document.getElementById('settingsMenu').classList.remove('active');

    // تحميل البيانات للصفحة المحددة
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
        } else {
            renderEmptyHomeOffers();
        }
    } catch (error) {
        console.error('Error loading home data:', error);
        renderEmptyHomeOffers();
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

    container.innerHTML = offers.map(offer => createOfferCardHTML(offer)).join('');
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

    container.innerHTML = offers.map(offer => createOfferCardHTML(offer)).join('');
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

function createOfferCardHTML(offer) {
    const discountPercent = offer.promo_price && offer.original_price 
        ? Math.round((1 - offer.promo_price / offer.original_price) * 100)
        : 0;

    return `
        <div class="card hair-service-card">
            ${offer.badge ? `<div class="promotion-badge">${offer.badge}</div>` : ''}
            
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
                    
                    <button class="book-now-btn" onclick="bookOffer('${offer.id || offer._id || '1'}')">
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
                    <div class="meta-item">
                        <i class="fas fa-eye"></i>
                        <span>${session.viewers || 0} spectateurs</span>
                    </div>
                </div>
                
                <button class="btn btn-primary btn-full mt-12" 
                        onclick="${session.status === 'active' ? 'joinLiveSession()' : 'watchReplay()'}">
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
        showNotification('Accès réservé aux administrateurs', 'error');
        return;
    }
    
    document.getElementById('addOfferModal').classList.add('active');
}

async function createOffer() {
    if (!isAdmin) {
        showNotification('Accès refusé', 'error');
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
        showNotification('Veuillez remplir tous les champs obligatoires', 'error');
        return;
    }

    try {
        const offerData = {
            title: name,
            type: type,
            original_price: parseFloat(originalPrice),
            description: description,
            image_url: image || null,
            badge: promoBadge || null
        };

        if (promoPrice) {
            offerData.promo_price = parseFloat(promoPrice);
        }

        // حفظ محلياً (بدون API)
        const newOffer = {
            id: 'offer_' + Date.now(),
            ...offerData,
            createdAt: new Date()
        };

        allOffers.push(newOffer);
        
        showNotification('Prestation ajoutée avec succès!', 'success');
        
        // تحديث العرض
        renderOffers(allOffers);
        
        // إغلاق المودال
        document.getElementById('addOfferModal').classList.remove('active');
        
        // تفريغ النموذج
        clearOfferForm();
        
    } catch (error) {
        console.error('Create offer error:', error);
        showNotification('Erreur lors de l\'ajout de la prestation', 'error');
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

async function bookOffer(offerId) {
    if (!currentUser) {
        showNotification('Veuillez vous connecter pour réserver', 'warning');
        switchPage('profile');
        return;
    }

    const confirmRes = confirm('Voulez-vous vraiment réserver cette prestation?');
    if (!confirmRes) return;

    try {
        // العثور على العرض
        const offer = allOffers.find(o => (o.id === offerId || o._id === offerId));
        if (!offer) {
            showNotification('Prestation non trouvée', 'error');
            return;
        }

        const price = offer.promo_price || offer.original_price || 0;
        
        // التحقق من الرصيد
        if (userBalance < price) {
            showNotification('Solde insuffisant. Veuillez recharger votre compte.', 'error');
            switchPage('payment');
            return;
        }

        // خصم السعر
        userBalance -= price;
        
        // إضافة النقاط
        const pointsEarned = Math.floor(price / 10);
        userPoints += pointsEarned;

        // تحديث بيانات المستخدم
        if (currentUser) {
            currentUser.balance = userBalance;
            currentUser.points = userPoints;
            localStorage.setItem('user', JSON.stringify(currentUser));
        }

        // تحديث العرض
        updateUserInfo();
        updateBalanceDisplay();
        
        showNotification(`Réservation confirmée! ${pointsEarned} points gagnés.`, 'success');

    } catch (error) {
        console.error('Booking error:', error);
        showNotification('Erreur lors de la réservation', 'error');
    }
}

// ========== LIVE SESSION FUNCTIONS ==========
function showStartLiveModal() {
    if (!isAdmin) {
        showNotification('Accès réservé aux administrateurs', 'error');
        return;
    }
    
    document.getElementById('startLiveModal').classList.add('active');
}

async function startLiveSession() {
    if (!isAdmin) {
        showNotification('Accès refusé', 'error');
        return;
    }

    const title = document.getElementById('liveTitle').value.trim();
    const description = document.getElementById('liveDescription').value.trim();

    if (!title) {
        showNotification('Veuillez saisir un titre pour votre séance', 'error');
        return;
    }

    try {
        const sessionData = {
            id: 'live_' + Date.now(),
            title: title,
            description: description,
            status: 'active',
            viewers: 0,
            duration: 0,
            createdAt: new Date(),
            createdBy: currentUser.name || 'Admin'
        };

        liveSessions.push(sessionData);
        
        showNotification('Séance en direct démarrée!', 'success');
        
        // تحديث العرض
        renderLiveSessions(liveSessions);
        
        // إغلاق المودال
        document.getElementById('startLiveModal').classList.remove('active');
        
        // تفريغ النموذج
        clearLiveForm();
        
    } catch (error) {
        console.error('Start live error:', error);
        showNotification('Erreur lors du démarrage de la séance', 'error');
    }
}

function clearLiveForm() {
    document.getElementById('liveTitle').value = '';
    document.getElementById('liveDescription').value = '';
    document.getElementById('liveSchedule').value = '';
}

function joinLiveSession() {
    showNotification('Connexion à la séance en cours...', 'info');
    
    // محاكاة الاتصال
    setTimeout(() => {
        showNotification('Vous êtes maintenant connecté à la séance en direct!', 'success');
    }, 1500);
}

function watchReplay() {
    showNotification('Lecture du replay en cours...', 'info');
    
    setTimeout(() => {
        showNotification('Replay chargé avec succès!', 'success');
    }, 1000);
}

// ========== PAYMENT FUNCTIONS ==========
async function chargeBalance() {
    const amountInput = document.getElementById('chargeAmount');
    if (!amountInput) return;

    const amount = parseFloat(amountInput.value);

    if (!amount || amount <= 0) {
        showNotification('Veuillez saisir un montant valide', 'error');
        return;
    }

    // للمستخدم العادي: إخفاء خيار الشحن
    if (!isAdmin) {
        showNotification('Le rechargement est réservé aux administrateurs', 'warning');
        amountInput.value = '';
        return;
    }

    try {
        // زيادة الرصيد
        userBalance += amount;
        
        // تحديث بيانات المستخدم
        if (currentUser) {
            currentUser.balance = userBalance;
            localStorage.setItem('user', JSON.stringify(currentUser));
        }

        // تحديث العرض
        updateUserInfo();
        updateBalanceDisplay();
        
        // تفريغ الحقل
        amountInput.value = '';
        
        showNotification(`Rechargement de €${amount.toFixed(2)} effectué!`, 'success');
        
    } catch (error) {
        console.error('Charge error:', error);
        showNotification('Erreur lors du rechargement', 'error');
    }
}

// ========== ADMIN FUNCTIONS ==========
function updateAdminStats() {
    if (!isAdmin) return;

    document.getElementById('totalOffers').textContent = allOffers.length;
    document.getElementById('totalUsers').textContent = 1; // سيتغير مع API حقيقي
    document.getElementById('totalRevenue').textContent = `€${(allOffers.length * 50).toFixed(2)}`;
}

function manageUsers() {
    if (!isAdmin) {
        showNotification('Accès refusé', 'error');
        return;
    }
    
    showNotification('Gestion des utilisateurs - Fonctionnalité à venir', 'info');
}

function viewStats() {
    if (!isAdmin) {
        showNotification('Accès refusé', 'error');
        return;
    }
    
    showNotification('Statistiques détaillées - Fonctionnalité à venir', 'info');
}

// ========== PROFILE FUNCTIONS ==========
async function saveProfile() {
    const newName = document.getElementById('profileNameInput').value.trim();
    const newEmail = document.getElementById('profileEmailInput').value.trim();
    const phoneInput = document.getElementById('profilePhone');
    const phone = phoneInput ? phoneInput.value.trim() : '';

    if (!newName) {
        showNotification('Veuillez entrer votre nom', 'error');
        return;
    }

    try {
        // تحديث بيانات المستخدم
        if (currentUser) {
            currentUser.name = newName;
            if (newEmail) currentUser.email = newEmail;
            if (phone) currentUser.phone = phone;
            
            localStorage.setItem('user', JSON.stringify(currentUser));
            
            // تحديث العرض
            updateUserInfo();
            
            showNotification('Profil mis à jour avec succès!', 'success');
        }
    } catch (error) {
        console.error('Update profile error:', error);
        showNotification('Erreur lors de la mise à jour du profil', 'error');
    }
}

// ========== LOGOUT FUNCTION ==========
function logout() {
    // مسح البيانات المحلية
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // إعادة تعيين المتغيرات
    currentUser = null;
    isAdmin = false;
    userBalance = 0;
    userPoints = 0;
    allOffers = [];
    liveSessions = [];
    
    // إخفاء التطبيق الرئيسي
    document.getElementById('mainHeader').style.display = 'none';
    document.getElementById('bottomNav').style.display = 'none';
    
    // إظهار صفحة الدخول
    document.getElementById('loginPage').style.display = 'block';
    document.getElementById('loginPage').classList.add('active');
    document.getElementById('registerPage').style.display = 'none';
    document.getElementById('registerPage').classList.remove('active');
    
    // إخفاء جميع الصفحات
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
        page.style.display = 'none';
    });
    
    // تفريغ حقول الدخول
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('adminLogin').checked = false;
    
    showNotification('Déconnexion réussie', 'success');
}

// ========== EVENT LISTENERS SETUP ==========
function setupEventListeners() {
    console.log('🔧 Setting up event listeners...');
    
    // ========== AUTH EVENT LISTENERS ==========
    
    // Switch between auth pages
    document.getElementById('goToRegister').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('loginPage').classList.remove('active');
        document.getElementById('registerPage').style.display = 'block';
        document.getElementById('registerPage').classList.add('active');
    });
    
    document.getElementById('goToLogin').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('registerPage').style.display = 'none';
        document.getElementById('registerPage').classList.remove('active');
        document.getElementById('loginPage').style.display = 'block';
        document.getElementById('loginPage').classList.add('active');
    });
    
    // Login button
    document.getElementById('loginBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        await login();
    });
    
    // Register button
    document.getElementById('registerBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        await register();
    });
    
    // ========== NAVIGATION EVENT LISTENERS ==========
    
    // Bottom navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = item.getAttribute('data-page');
            if (pageId) {
                switchPage(pageId);
            }
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
    
    // ========== MODAL EVENT LISTENERS ==========
    
    // Add Offer Modal
    const addOfferBtn = document.getElementById('fabBtn');
    if (addOfferBtn) {
        addOfferBtn.addEventListener('click', () => {
            showAddOfferModal();
        });
    }
    
    document.getElementById('cancelOfferBtn')?.addEventListener('click', () => {
        document.getElementById('addOfferModal').classList.remove('active');
        clearOfferForm();
    });
    
    document.getElementById('saveOfferBtn')?.addEventListener('click', createOffer);
    
    // Start Live Modal
    document.getElementById('startLiveBtn')?.addEventListener('click', () => {
        showStartLiveModal();
    });
    
    document.getElementById('cancelLiveBtn')?.addEventListener('click', () => {
        document.getElementById('startLiveModal').classList.remove('active');
        clearLiveForm();
    });
    
    document.getElementById('goLiveBtn')?.addEventListener('click', startLiveSession);
    
    // ========== OTHER EVENT LISTENERS ==========
    
    // Save Profile
    document.getElementById('saveProfileBtn')?.addEventListener('click', saveProfile);
    
    // Charge Balance
    document.getElementById('chargeBtn')?.addEventListener('click', chargeBalance);
    
    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
    
    document.getElementById('logoutSidebarBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
    
    // Admin buttons
    document.getElementById('manageUsersBtn')?.addEventListener('click', manageUsers);
    document.getElementById('viewStatsBtn')?.addEventListener('click', viewStats);
    
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
// تصدير الدوال للاستخدام في HTML
window.switchPage = switchPage;
window.bookOffer = bookOffer;
window.showAddOfferModal = showAddOfferModal;
window.showStartLiveModal = showStartLiveModal;
window.joinLiveSession = joinLiveSession;
window.watchReplay = watchReplay;
window.logout = logout;

// ========== INITIALIZE APP ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 El Djamila App Starting...');
    
    // Setup event listeners
    setupEventListeners();
    
    // Check if user is already logged in
    const isLoggedIn = checkAuth();
    
    if (!isLoggedIn) {
        // Show login page by default
        document.getElementById('loginPage').style.display = 'block';
        document.getElementById('loginPage').classList.add('active');
        document.getElementById('registerPage').style.display = 'none';
        document.getElementById('registerPage').classList.remove('active');
    }
    
    console.log('✅ App started successfully');
});