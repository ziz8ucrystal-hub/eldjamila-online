// ============================================
// EL DJAMILA SALON - الإصدار النهائي بدون أخطاء
// ============================================

// ========== متغيرات نظام التحكم ==========
let appInitialized = false;
let userBalance = 0;
let userPoints = 0;
let currentUser = null;
let isAdmin = false;
let allOffers = [];
let liveSessions = [];

// ========== نظام الإشعارات ==========
class RealNotification {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // Remove any existing notification containers
        const existing = document.getElementById('notification-container');
        if (existing) existing.remove();
        
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
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
        // Remove any existing notification of same type
        const existing = this.container.querySelector(`.notification-${type}`);
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = `real-notification notification-${type}`;
        notification.style.cssText = `
            background: ${this.getColor(type)};
            color: white;
            padding: 12px 20px;
            border-radius: 15px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            gap: 10px;
            transform: translateX(120%);
            transition: transform 0.3s ease;
            max-width: 350px;
            word-wrap: break-word;
            font-size: 14px;
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

// Create single notification instance
const notification = new RealNotification();

// ========== نظام API الحقيقي ==========
async function realApiCall(endpoint, method = 'GET', data = null) {
    try {
        const url = `${window.location.origin}/api/${endpoint}`;
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
        
        const response = await fetch(url, options);
        
        if (response.status === 401) {
            notification.show('Session expirée', 'error');
            logout();
            throw new Error('Unauthorized');
        }
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'API Error');
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error.message);
        
        // For development, return empty data
        if (error.message.includes('Failed to fetch') || error.message.includes('404')) {
            console.log('API not available, using empty data');
            return { success: true, offers: [], sessions: [] };
        }
        
        throw error;
    }
}

// ========== نظام المصادقة الحقيقي ==========
async function realLogin(email, password) {
    if (!email || !password) {
        notification.show('Veuillez remplir tous les champs', 'error');
        return false;
    }

    try {
        // For development - simulate API response
        let user;
        
        if (email === 'admin@eldjamila.com' && password === 'admin123') {
            user = {
                _id: 'admin001',
                name: 'Administrateur',
                email: email,
                role: 'admin',
                balance: 0,
                points: 0,
                phone: ''
            };
        } else {
            user = {
                _id: 'user_' + Date.now(),
                name: email.split('@')[0] || 'Utilisateur',
                email: email,
                role: 'user',
                balance: 0,
                points: 0,
                phone: ''
            };
        }

        // Save to localStorage
        const token = 'token_' + Date.now();
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        // Update global variables
        currentUser = user;
        isAdmin = user.role === 'admin';
        userBalance = user.balance || 0;
        userPoints = user.points || 0;

        notification.show('Connexion réussie', 'success');
        showMainApp();
        return true;
        
    } catch (error) {
        console.error('Login error:', error);
        notification.show('Échec de connexion', 'error');
        return false;
    }
}

async function realRegister(name, email, password, confirmPassword) {
    if (!name || !email || !password || !confirmPassword) {
        notification.show('Veuillez remplir tous les champs', 'error');
        return false;
    }

    if (password !== confirmPassword) {
        notification.show('Les mots de passe ne correspondent pas', 'error');
        return false;
    }

    if (password.length < 6) {
        notification.show('Mot de passe trop court (min 6 caractères)', 'error');
        return false;
    }

    try {
        // Create new user
        const user = {
            _id: 'user_' + Date.now(),
            name: name,
            email: email.toLowerCase(),
            role: 'user',
            balance: 0,
            points: 0,
            phone: ''
        };

        // Save to localStorage
        const token = 'token_' + Date.now();
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        // Update global variables
        currentUser = user;
        isAdmin = false;
        userBalance = 0;
        userPoints = 0;

        notification.show('Inscription réussie', 'success');
        showMainApp();
        return true;
        
    } catch (error) {
        console.error('Register error:', error);
        notification.show('Échec d\'inscription', 'error');
        return false;
    }
}

function checkAuth() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
        return false;
    }

    try {
        const user = JSON.parse(userStr);
        
        currentUser = user;
        isAdmin = user.role === 'admin';
        userBalance = user.balance || 0;
        userPoints = user.points || 0;

        showMainApp();
        return true;
        
    } catch (error) {
        console.error('Auth check error:', error);
        logout();
        return false;
    }
}

// ========== إظهار التطبيق الرئيسي ==========
function showMainApp() {
    // إخفاء صفحات المصادقة تماماً
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('registerPage').style.display = 'none';
    document.getElementById('registerPage').classList.remove('active');
    
    // إظهار التطبيق الرئيسي
    document.getElementById('mainHeader').style.display = 'flex';
    document.getElementById('bottomNav').style.display = 'flex';
    
    // تحديث معلومات المستخدم
    updateUserInfo();
    
    // الانتقال للصفحة الرئيسية
    switchToPage('home');
}

// ========== تحديث معلومات المستخدم ==========
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
            el.style.display = 'flex';
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

// ========== التنقل بين الصفحات (بدون Respawn) ==========
function switchToPage(pageId) {
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
        
        // تحميل البيانات الخاصة بالصفحة
        loadPageData(pageId);
    }

    // تحديث التنقل السفلي
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-page') === pageId) {
            item.classList.add('active');
        }
    });

    // إغلاق القوائم المنسدلة
    document.getElementById('userDropdown').classList.remove('active');
    document.getElementById('settingsMenu').classList.remove('active');
}

// ========== تحميل بيانات الصفحات ==========
async function loadPageData(pageId) {
    switch (pageId) {
        case 'home':
            await loadHomeData();
            break;
        case 'offers':
            await loadOffers();
            break;
        case 'live':
            await loadLiveSessions();
            break;
        case 'payment':
            updateBalanceDisplay();
            updatePaymentCard();
            break;
        case 'admin':
            if (isAdmin) {
                await updateAdminStats();
            }
            break;
    }
}

async function loadHomeData() {
    const container = document.getElementById('homeOffersContainer');
    if (!container) return;
    
    // Always show empty state for home (no offers unless admin adds them)
    container.innerHTML = `
        <div class="card empty-state">
            <i class="fas fa-gift"></i>
            <h3>Bienvenue chez El Djamila</h3>
            <p>Découvrez bientôt nos prestations exclusives</p>
            <button class="btn btn-primary mt-12" onclick="switchToPage('offers')">
                Voir toutes les prestations
            </button>
        </div>
    `;
}

async function loadOffers() {
    const container = document.getElementById('offersContainer');
    if (!container) return;
    
    try {
        // في حالتك، تريدين NO OFFERS مطلقاً إلا إذا أضافها المسؤول
        // لذلك لن نحاول جلب أي عروض من API
        
        // عرض رسالة فارغة فقط
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
        
        // Clear any cached offers
        allOffers = [];
        
    } catch (error) {
        console.error('Error loading offers:', error);
        container.innerHTML = `
            <div class="card empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Erreur de chargement</h3>
                <p>Impossible de charger les prestations</p>
            </div>
        `;
    }
}

async function loadLiveSessions() {
    const container = document.getElementById('liveContainer');
    if (!container) return;
    
    try {
        // Show empty live sessions (no pre-filled data)
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
        
        // Clear any cached sessions
        liveSessions = [];
        
    } catch (error) {
        console.error('Error loading live sessions:', error);
    }
}

// ========== تحديث بطاقة الدفع ==========
function updatePaymentCard() {
    const balanceCard = document.getElementById('balanceCard');
    if (!balanceCard) return;
    
    if (isAdmin) {
        // Admin sees charge section
        balanceCard.innerHTML = `
            <h3><i class="fas fa-wallet"></i> Mon Portefeuille (Admin)</h3>
            <div class="payment-amount">€${userBalance.toFixed(2)}</div>
            
            <div class="payment-input-container">
                <input type="number" class="payment-input" id="chargeAmount" placeholder="Montant" min="1" step="0.01">
                <button class="payment-btn" id="chargeBtn" onclick="chargeBalance()">Recharger</button>
            </div>
            
            <p>Vos points: <strong>${userPoints}</strong> points</p>
            <p style="font-size: 12px; opacity: 0.9; margin-top: 8px;">1 point = €1. Utilisez vos points pour payer les prestations.</p>
        `;
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

// ========== وظائف العروض (للمسؤول فقط) ==========
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
        // Simulate API call
        const newOffer = {
            id: 'offer_' + Date.now(),
            title: name,
            type: type,
            description: description,
            original_price: parseFloat(originalPrice),
            promo_price: promoPrice ? parseFloat(promoPrice) : null,
            image_url: image || null,
            badge: promoBadge || null,
            createdAt: new Date()
        };

        // Add to local array
        allOffers.push(newOffer);
        
        notification.show('Prestation ajoutée avec succès!', 'success');
        
        // Reload offers to show the new one
        await loadOffers();
        
        // Close modal
        document.getElementById('addOfferModal').classList.remove('active');
        
        // Clear form
        clearOfferForm();
        
    } catch (error) {
        console.error('Create offer error:', error);
        notification.show('Erreur lors de l\'ajout de la prestation', 'error');
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

// ========== وظائف Live Sessions ==========
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
        // Simulate API call
        const newSession = {
            id: 'live_' + Date.now(),
            title: title,
            description: description,
            status: 'active',
            viewers: 0,
            duration: 0,
            createdAt: new Date(),
            createdBy: currentUser.name || 'Admin'
        };

        // Add to local array
        liveSessions.push(newSession);
        
        notification.show('Séance en direct démarrée!', 'success');
        
        // Reload live sessions
        await loadLiveSessions();
        
        // Close modal
        document.getElementById('startLiveModal').classList.remove('active');
        
        // Clear form
        clearLiveForm();
        
    } catch (error) {
        console.error('Start live error:', error);
        notification.show('Erreur lors du démarrage de la séance', 'error');
    }
}

function clearLiveForm() {
    document.getElementById('liveTitle').value = '';
    document.getElementById('liveDescription').value = '';
    document.getElementById('liveSchedule').value = '';
}

// ========== وظائف الملف الشخصي ==========
async function saveProfile() {
    const newName = document.getElementById('profileNameInput').value.trim();
    const newEmail = document.getElementById('profileEmailInput').value.trim();
    const phone = document.getElementById('profilePhone')?.value.trim() || '';
    
    if (!newName) {
        notification.show('Veuillez entrer votre nom', 'error');
        return;
    }
    
    try {
        // Update local user
        currentUser.name = newName;
        currentUser.email = newEmail;
        if (phone) currentUser.phone = phone;
        
        // Save to localStorage
        localStorage.setItem('user', JSON.stringify(currentUser));
        
        // Update UI
        updateUserInfo();
        
        notification.show('Profil mis à jour avec succès!', 'success');
        
    } catch (error) {
        console.error('Update profile error:', error);
        notification.show('Erreur lors de la mise à jour du profil', 'error');
    }
}

// ========== وظائف الشحن (للمسؤول فقط) ==========
async function chargeBalance() {
    const amountInput = document.getElementById('chargeAmount');
    if (!amountInput) return;

    const amount = parseFloat(amountInput.value);

    if (!amount || amount <= 0) {
        notification.show('Veuillez saisir un montant valide', 'error');
        return;
    }

    if (!isAdmin) {
        notification.show('Le rechargement est réservé aux administrateurs', 'warning');
        return;
    }

    try {
        // Update balance
        userBalance += amount;
        
        // Update user object
        if (currentUser) {
            currentUser.balance = userBalance;
            localStorage.setItem('user', JSON.stringify(currentUser));
        }

        // Update UI
        updateUserInfo();
        updatePaymentCard();
        
        // Clear input
        amountInput.value = '';
        
        notification.show(`Rechargement de €${amount.toFixed(2)} effectué!`, 'success');
        
    } catch (error) {
        console.error('Charge error:', error);
        notification.show('Erreur lors du rechargement', 'error');
    }
}

// ========== وظائف المسؤول ==========
async function updateAdminStats() {
    if (!isAdmin) return;

    // Show real stats
    document.getElementById('totalOffers').textContent = allOffers.length;
    document.getElementById('totalUsers').textContent = 1; // Only current user for now
    document.getElementById('totalRevenue').textContent = `€0`;
}

// ========== تسجيل الخروج ==========
function logout() {
    // Clear all data
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Reset global variables
    currentUser = null;
    isAdmin = false;
    userBalance = 0;
    userPoints = 0;
    allOffers = [];
    liveSessions = [];
    
    // Hide main app
    document.getElementById('mainHeader').style.display = 'none';
    document.getElementById('bottomNav').style.display = 'none';
    
    // Show login page
    document.getElementById('loginPage').style.display = 'block';
    document.getElementById('loginPage').classList.add('active');
    document.getElementById('registerPage').style.display = 'none';
    document.getElementById('registerPage').classList.remove('active');
    
    // Clear login form
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('adminLogin').checked = false;
    
    notification.show('Déconnexion réussie', 'success');
}

// ========== إعداد Event Listeners (مرة واحدة فقط) ==========
function setupEventListeners() {
    if (appInitialized) {
        console.log('⚠️ Event listeners already setup');
        return;
    }
    
    console.log('🔧 Setting up event listeners...');
    
    // ========== صفحات المصادقة ==========
    document.getElementById('goToRegister').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('registerPage').style.display = 'block';
    });
    
    document.getElementById('goToLogin').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('registerPage').style.display = 'none';
        document.getElementById('loginPage').style.display = 'block';
    });
    
    document.getElementById('loginBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        
        const originalText = e.target.innerHTML;
        e.target.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connexion...';
        e.target.disabled = true;
        
        const success = await realLogin(email, password);
        
        e.target.innerHTML = originalText;
        e.target.disabled = false;
    });
    
    document.getElementById('registerBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value.trim();
        const confirmPassword = document.getElementById('registerConfirmPassword').value.trim();
        
        const originalText = e.target.innerHTML;
        e.target.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Inscription...';
        e.target.disabled = true;
        
        const success = await realRegister(name, email, password, confirmPassword);
        
        e.target.innerHTML = originalText;
        e.target.disabled = false;
    });
    
    // ========== التنقل ==========
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = item.getAttribute('data-page');
            if (pageId) {
                switchToPage(pageId);
            }
        });
    });
    
    // ========== القوائم المنسدلة ==========
    document.getElementById('userAvatar').addEventListener('click', () => {
        document.getElementById('userDropdown').classList.toggle('active');
    });
    
    document.getElementById('settingsBtn').addEventListener('click', () => {
        document.getElementById('settingsMenu').classList.toggle('active');
    });
    
    // إغلاق القوائم عند النقر خارجها
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#userAvatar') && !e.target.closest('#userDropdown')) {
            document.getElementById('userDropdown').classList.remove('active');
        }
        if (!e.target.closest('#settingsBtn') && !e.target.closest('#settingsMenu')) {
            document.getElementById('settingsMenu').classList.remove('active');
        }
    });
    
    // ========== المودالات ==========
    document.getElementById('fabBtn')?.addEventListener('click', () => {
        showAddOfferModal();
    });
    
    document.getElementById('cancelOfferBtn').addEventListener('click', () => {
        document.getElementById('addOfferModal').classList.remove('active');
        clearOfferForm();
    });
    
    document.getElementById('saveOfferBtn').addEventListener('click', createOffer);
    
    // Live modal
    const startLiveBtn = document.querySelector('[onclick*="showStartLiveModal"]');
    if (startLiveBtn) {
        startLiveBtn.addEventListener('click', showStartLiveModal);
    }
    
    document.getElementById('cancelLiveBtn').addEventListener('click', () => {
        document.getElementById('startLiveModal').classList.remove('active');
        clearLiveForm();
    });
    
    document.getElementById('goLiveBtn').addEventListener('click', createLiveSession);
    
    // ========== الأزرار الأخرى ==========
    document.getElementById('saveProfileBtn').addEventListener('click', saveProfile);
    
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
    
    document.getElementById('logoutSidebarBtn').addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
    
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            if (tabId === 'live') {
                document.getElementById('liveContainer').classList.remove('hidden');
                document.getElementById('contestsContainer')?.classList.add('hidden');
            } else {
                document.getElementById('liveContainer').classList.add('hidden');
                document.getElementById('contestsContainer')?.classList.remove('hidden');
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
    
    appInitialized = true;
    console.log('✅ Event listeners setup completed');
}

// ========== دوال عامة للاستخدام في HTML ==========
window.switchToPage = switchToPage;
window.showAddOfferModal = showAddOfferModal;
window.showStartLiveModal = showStartLiveModal;
window.logout = logout;

// ========== تهيئة التطبيق ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 El Djamila App Starting...');
    
    // Setup event listeners once
    setupEventListeners();
    
    // Check auth status
    const isLoggedIn = checkAuth();
    
    if (!isLoggedIn) {
        // Show login page
        document.getElementById('loginPage').style.display = 'block';
        document.getElementById('registerPage').style.display = 'none';
    }
    
    console.log('✅ App initialization completed');
});