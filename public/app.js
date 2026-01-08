// ========== Variables globales ==========
let userBalance = 0;
let userPoints = 0;
let currentLanguage = 'fr';
let currentUser = null;
let isAdmin = false;
let SOCKET = null;
const API_BASE_URL = window.location.origin;

// ========== Initialisation au chargement ==========
document.addEventListener('DOMContentLoaded', function() {
    // Éléments DOM
    const balanceAmount = document.getElementById('balanceAmount');
    const userBalanceEl = document.getElementById('userBalance');
    const userPointsEl = document.getElementById('userPoints');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsMenu = document.getElementById('settingsMenu');
    const addOfferBtn = document.getElementById('addOfferBtn');
    const addOfferModal = document.getElementById('addOfferModal');
    const cancelOfferBtn = document.getElementById('cancelOfferBtn');
    const saveOfferBtn = document.getElementById('saveOfferBtn');
    const startLiveBtn = document.getElementById('startLiveBtn');
    const startLiveModal = document.getElementById('startLiveModal');
    const cancelLiveBtn = document.getElementById('cancelLiveBtn');
    const goLiveBtn = document.getElementById('goLiveBtn');
    const createContestBtn = document.getElementById('createContestBtn');
    const createContestModal = document.getElementById('createContestModal');
    const cancelContestBtn = document.getElementById('cancelContestBtn');
    const saveContestBtn = document.getElementById('saveContestBtn');
    const chargeBtn = document.getElementById('chargeBtn');
    const chargeAmount = document.getElementById('chargeAmount');
    const offersContainer = document.getElementById('offersContainer');
    const liveContainer = document.getElementById('liveContainer');
    const contestsContainer = document.getElementById('contestsContainer');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const fabBtn = document.getElementById('fabBtn');
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');
    const authPages = document.querySelectorAll('.auth-page');
    const langBtns = document.querySelectorAll('.lang-btn');
    const loginPage = document.getElementById('loginPage');
    const registerPage = document.getElementById('registerPage');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const goToRegister = document.getElementById('goToRegister');
    const goToLogin = document.getElementById('goToLogin');
    const mainHeader = document.getElementById('mainHeader');
    const bottomNav = document.getElementById('bottomNav');
    const userAvatar = document.getElementById('userAvatar');
    const profileAvatar = document.getElementById('profileAvatar');
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profileNameInput = document.getElementById('profileNameInput');
    const profileEmailInput = document.getElementById('profileEmailInput');
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    const profileBalance = document.getElementById('profileBalance');
    const profilePoints = document.getElementById('profilePoints');
    const adminBadgeContainer = document.getElementById('adminBadgeContainer');
    const userDropdown = document.getElementById('userDropdown');
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutSidebarBtn = document.getElementById('logoutSidebarBtn');
    const adminOnlyElements = document.querySelectorAll('.admin-only');
    const manageUsersBtn = document.getElementById('manageUsersBtn');
    const viewStatsBtn = document.getElementById('viewStatsBtn');
    const homeOffersContainer = document.getElementById('homeOffersContainer');

    // ========== Fonctions API ==========
    async function apiCall(endpoint, method = 'GET', data = null, requiresAuth = true) {
        const token = localStorage.getItem('token');
        
        const headers = {
            'Content-Type': 'application/json',
        };
        
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
            const response = await fetch(`${API_BASE_URL}/api/${endpoint}`, options);
            
            if (response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                showLoginPage();
                throw new Error('Session expirée, veuillez vous reconnecter');
            }
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Erreur serveur');
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            showError(error.message);
            throw error;
        }
    }

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
        if (SOCKET) SOCKET.disconnect();
        
        const token = localStorage.getItem('token');
        if (!token) return;
        
        SOCKET = io(API_BASE_URL, {
            auth: { token }
        });
        
        SOCKET.on('connect', () => {
            console.log('✅ Connecté au serveur');
        });
        
        SOCKET.on('new_offer', (offer) => {
            addOfferToUI(offer);
            showNotification('Nouvelle offre ajoutée!');
        });
        
        SOCKET.on('live_started', (liveSession) => {
            addLiveToUI(liveSession);
            showNotification('Nouvelle session live démarrée!');
        });
        
        SOCKET.on('balance_updated', (data) => {
            if (currentUser && data.userId === currentUser.id) {
                userBalance = data.balance;
                userPoints = data.points;
                updateBalanceDisplay();
            }
        });
        
        SOCKET.on('disconnect', () => {
            console.log('❌ Déconnecté du serveur');
        });
    }

    // ========== Vérification session ==========
    async function checkAuth() {
        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');
        
        if (!token || !userStr) {
            return false;
        }
        
        try {
            const result = await apiCall('auth/verify');
            
            if (result.success) {
                currentUser = JSON.parse(userStr);
                isAdmin = currentUser.role === 'admin';
                userBalance = currentUser.balance || 0;
                userPoints = currentUser.points || 0;
                
                updateUserInfo();
                initSocket();
                switchToMainApp();
                loadInitialData();
                return true;
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            return false;
        }
    }

    // ========== Connexion ==========
    async function loginUser(email, password, isAdminLogin = false) {
        try {
            const result = await apiCall('auth/login', 'POST', {
                email,
                password,
                isAdmin: isAdminLogin
            }, false);
            
            if (result.success) {
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
                
                return true;
            }
        } catch (error) {
            console.error('Login error:', error);
            return false;
        }
    }

    // ========== Inscription ==========
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
                isAdmin = false;
                userBalance = result.user.balance || 0;
                userPoints = result.user.points || 0;
                
                updateUserInfo();
                initSocket();
                switchToMainApp();
                loadInitialData();
                
                return true;
            }
        } catch (error) {
            console.error('Register error:', error);
            return false;
        }
    }

    // ========== Déconnexion ==========
    function logoutUser() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        currentUser = null;
        isAdmin = false;
        userBalance = 0;
        userPoints = 0;
        
        if (SOCKET) {
            SOCKET.disconnect();
            SOCKET = null;
        }
        
        showLoginPage();
    }

    // ========== Chargement données ==========
    async function loadInitialData() {
        try {
            // Offres page d'accueil
            const offers = await getOffers();
            if (homeOffersContainer && offers.length > 0) {
                displayHomeOffers(offers.slice(0, 4));
            }
            
            // Offres page offres
            if (offersContainer) {
                displayAllOffers(offers);
            }
            
            // Sessions live
            const liveSessions = await getLiveSessions();
            if (liveContainer) {
                displayLiveSessions(liveSessions);
            }
            
            // Concours
            const contests = await getContests();
            if (contestsContainer) {
                displayContests(contests);
            }
            
            // Stats admin
            if (isAdmin) {
                loadAdminStats();
            }
            
        } catch (error) {
            console.error('Failed to load initial data:', error);
        }
    }

    // ========== Offres ==========
    async function getOffers() {
        try {
            const result = await apiCall('offers');
            return result.offers || [];
        } catch (error) {
            return [];
        }
    }

    async function addOffer(offerData) {
        try {
            const result = await apiCall('offers', 'POST', offerData);
            
            if (result.success && SOCKET) {
                SOCKET.emit('new_offer_added', result.offer);
            }
            
            return result.offer;
        } catch (error) {
            throw error;
        }
    }

    async function deleteOffer(offerId) {
        try {
            const result = await apiCall(`offers/${offerId}`, 'DELETE');
            return result.success;
        } catch (error) {
            throw error;
        }
    }

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
                    <h3>Aucune offre pour le moment</h3>
                    <p>Des offres seront ajoutées bientôt</p>
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
        const offerCard = document.createElement('div');
        offerCard.className = 'card hair-service-card';
        offerCard.dataset.id = offer.id;
        
        let badgeHtml = '';
        if (offer.badge) {
            badgeHtml = `<div class="promotion-badge">${offer.badge}</div>`;
        }
        
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
            <button class="book-now-btn" onclick="bookOffer('${offer.id}')">Réserver</button>
        `;
        
        offerCard.innerHTML = `
            ${badgeHtml}
            <div class="card-image">
                <img src="${offer.image_url || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80'}" alt="${offer.title}">
            </div>
            <div class="card-content">
                <span class="service-type">${offer.type || 'Service'}</span>
                <h3 class="service-name">${offer.title}</h3>
                <p class="card-subtitle" style="font-size: 12px; color: var(--gray); margin-bottom: 10px;">
                    ${offer.description || 'Service professionnel de haute qualité.'}
                </p>
                <div class="price-section">
                    ${priceHtml}
                </div>
                ${isAdmin ? `
                    <div class="admin-actions" style="margin-top: 10px; display: flex; gap: 5px;">
                        <button class="btn btn-secondary" onclick="editOffer('${offer.id}')" style="padding: 5px 10px; font-size: 12px;">Modifier</button>
                        <button class="btn btn-danger" onclick="deleteOfferFromUI('${offer.id}')" style="padding: 5px 10px; font-size: 12px;">Supprimer</button>
                    </div>
                ` : ''}
            </div>
        `;
        
        return offerCard;
    }

    async function deleteOfferFromUI(offerId) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette offre?')) return;
        
        try {
            await deleteOffer(offerId);
            const offerCard = document.querySelector(`[data-id="${offerId}"]`);
            if (offerCard) {
                offerCard.remove();
            }
            showNotification('Offre supprimée avec succès');
        } catch (error) {
            showError('Échec de la suppression');
        }
    }

    // ========== Live ==========
    async function getLiveSessions() {
        try {
            const result = await apiCall('live');
            return result.sessions || [];
        } catch (error) {
            return [];
        }
    }

    async function startLiveSession(title, description) {
        try {
            const result = await apiCall('live/start', 'POST', {
                title,
                description
            });
            
            if (result.success && SOCKET) {
                SOCKET.emit('live_session_started', result.session);
            }
            
            return result.session;
        } catch (error) {
            throw error;
        }
    }

    function displayLiveSessions(sessions) {
        if (!liveContainer) return;
        
        if (sessions.length === 0) {
            liveContainer.innerHTML = `
                <div class="card empty-state">
                    <i class="fas fa-video"></i>
                    <h3>Aucune session live</h3>
                    <p>Des sessions seront ajoutées bientôt</p>
                </div>
            `;
            return;
        }
        
        liveContainer.innerHTML = '';
        sessions.forEach(session => {
            const liveCard = createLiveCard(session);
            liveContainer.appendChild(liveCard);
        });
    }

    function createLiveCard(session) {
        const liveCard = document.createElement('div');
        liveCard.className = 'card hair-service-card';
        liveCard.innerHTML = `
            <div class="card-header">
                <div class="live-indicator">
                    <span class="live-dot"></span>
                    <span>EN DIRECT</span>
                </div>
                <h3 class="card-title">${session.title}</h3>
                <p class="card-subtitle">${session.description || 'Session de coiffure en direct'}</p>
            </div>
            <div class="card-content">
                <p>Rejoignez-nous maintenant pour regarder et interagir en temps réel!</p>
                <button class="btn btn-primary btn-full mt-12" onclick="joinLiveSession('${session.id}')">
                    <i class="fas fa-play btn-icon"></i>
                    Rejoindre la session
                </button>
            </div>
        `;
        return liveCard;
    }

    // ========== Concours ==========
    async function getContests() {
        try {
            const result = await apiCall('contests');
            return result.contests || [];
        } catch (error) {
            return [];
        }
    }

    async function createContest(contestData) {
        try {
            const result = await apiCall('contests', 'POST', contestData);
            return result.contest;
        } catch (error) {
            throw error;
        }
    }

    function displayContests(contests) {
        if (!contestsContainer) return;
        
        if (contests.length === 0) {
            contestsContainer.innerHTML = `
                <div class="card empty-state">
                    <i class="fas fa-trophy"></i>
                    <h3>Aucun concours</h3>
                    <p>Des concours seront ajoutés bientôt</p>
                </div>
            `;
            return;
        }
        
        contestsContainer.innerHTML = '';
        contests.forEach(contest => {
            const contestCard = createContestCard(contest);
            contestsContainer.appendChild(contestCard);
        });
    }

    function createContestCard(contest) {
        const formattedDate = new Date(contest.end_date).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        const contestCard = document.createElement('div');
        contestCard.className = 'card hair-service-card';
        contestCard.innerHTML = `
            <div class="card-header">
                <div class="promotion-badge">CONCOURS</div>
                <h3 class="card-title">${contest.title}</h3>
                <p class="card-subtitle">Fin: ${formattedDate}</p>
            </div>
            <div class="card-content">
                <p><strong>Prix:</strong> ${contest.prize}</p>
                <p>${contest.description || 'Participez à notre concours passionnant!'}</p>
                <button class="btn btn-primary btn-full mt-12" onclick="joinContest('${contest.id}')">
                    <i class="fas fa-sign-in-alt btn-icon"></i>
                    Participer
                </button>
            </div>
        `;
        return contestCard;
    }

    // ========== Portefeuille ==========
    async function chargeBalance(amount) {
        try {
            const result = await apiCall('payment/charge', 'POST', { amount });
            
            if (result.success) {
                userBalance = result.newBalance;
                userPoints = result.newPoints;
                
                if (SOCKET) {
                    SOCKET.emit('balance_charged', {
                        userId: currentUser.id,
                        amount,
                        newBalance: userBalance
                    });
                }
                
                updateBalanceDisplay();
                return true;
            }
            return false;
        } catch (error) {
            throw error;
        }
    }

    // ========== Profil ==========
    async function updateProfile(name, phone) {
        try {
            const result = await apiCall('profile/update', 'PUT', {
                name,
                phone
            });
            
            if (result.success) {
                currentUser.name = name;
                currentUser.phone = phone;
                localStorage.setItem('user', JSON.stringify(currentUser));
                updateUserInfo();
                return true;
            }
            return false;
        } catch (error) {
            throw error;
        }
    }

    // ========== Admin ==========
    async function loadAdminStats() {
        if (!isAdmin) return;
        
        try {
            const result = await apiCall('admin/stats');
            if (result.stats) {
                document.getElementById('totalOffers').textContent = result.stats.totalOffers || 0;
                document.getElementById('totalUsers').textContent = result.stats.totalUsers || 1;
                document.getElementById('totalRevenue').textContent = `€${result.stats.totalRevenue || 0}`;
            }
        } catch (error) {
            console.error('Failed to load admin stats:', error);
        }
    }

    // ========== UI ==========
    function updateBalanceDisplay() {
        if (balanceAmount) balanceAmount.textContent = `€${userBalance.toFixed(2)}`;
        if (userBalanceEl) userBalanceEl.textContent = userBalance.toFixed(2);
        if (userPointsEl) userPointsEl.textContent = userPoints;
        if (profileBalance) profileBalance.textContent = `€${userBalance}`;
        if (profilePoints) profilePoints.textContent = userPoints;
    }

    function updateUserInfo() {
        if (!currentUser) return;
        
        if (userAvatar) userAvatar.textContent = currentUser.name.charAt(0).toUpperCase();
        if (profileAvatar) profileAvatar.textContent = currentUser.name.charAt(0).toUpperCase();
        if (profileName) profileName.textContent = currentUser.name;
        if (profileEmail) profileEmail.textContent = currentUser.email;
        if (profileNameInput) profileNameInput.value = currentUser.name;
        if (profileEmailInput) profileEmailInput.value = currentUser.email;
        
        if (isAdmin) {
            if (adminBadgeContainer) {
                adminBadgeContainer.innerHTML = '<span class="admin-badge">ADMINISTRATEUR</span>';
            }
            adminOnlyElements.forEach(el => {
                el.style.display = 'flex';
                el.classList.add('show');
            });
            if (fabBtn) fabBtn.style.display = 'flex';
        } else {
            if (adminBadgeContainer) {
                adminBadgeContainer.innerHTML = '';
            }
            adminOnlyElements.forEach(el => {
                el.style.display = 'none';
                el.classList.remove('show');
            });
            if (fabBtn) fabBtn.style.display = 'none';
        }
        
        updateBalanceDisplay();
    }

    function switchToMainApp() {
        loginPage.classList.remove('active');
        registerPage.classList.remove('active');
        
        mainHeader.style.display = 'flex';
        bottomNav.style.display = 'flex';
        
        updateUserInfo();
        switchPage('home');
    }

    function showLoginPage() {
        mainHeader.style.display = 'none';
        bottomNav.style.display = 'none';
        
        adminOnlyElements.forEach(el => {
            el.style.display = 'none';
            el.classList.remove('show');
        });
        if (fabBtn) fabBtn.style.display = 'none';
        
        loginPage.classList.add('active');
        registerPage.classList.remove('active');
        
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
        document.getElementById('adminLogin').checked = false;
    }

    // ========== Navigation ==========
    window.switchPage = function(pageId) {
        pages.forEach(page => {
            page.classList.remove('active');
        });
        
        const targetPage = document.getElementById(pageId + 'Page');
        if (targetPage) {
            targetPage.classList.add('active');
        }
        
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-page') === pageId) {
                item.classList.add('active');
            }
        });
        
        userDropdown.classList.remove('active');
    }

    // ========== Événements ==========
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = item.getAttribute('data-page');
            switchPage(pageId);
        });
    });

    goToRegister.addEventListener('click', (e) => {
        e.preventDefault();
        loginPage.classList.remove('active');
        registerPage.classList.add('active');
    });

    goToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        registerPage.classList.remove('active');
        loginPage.classList.add('active');
    });

    loginBtn.addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        const isAdminLogin = document.getElementById('adminLogin').checked;
        
        if (!email || !password) {
            showError('Veuillez remplir tous les champs');
            return;
        }
        
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connexion...';
        
        const success = await loginUser(email, password, isAdminLogin);
        
        if (!success) {
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt btn-icon"></i> Se connecter';
            showError('Échec de connexion. Vérifiez vos identifiants.');
        }
    });

    registerBtn.addEventListener('click', async () => {
        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value.trim();
        const confirmPassword = document.getElementById('registerConfirmPassword').value.trim();
        
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
            showError('Échec de l\'inscription. Réessayez.');
        }
    });

    saveOfferBtn.addEventListener('click', async () => {
        const name = document.getElementById('offerName').value.trim();
        const type = document.getElementById('offerType').value;
        const originalPrice = document.getElementById('originalPrice').value;
        const promoPrice = document.getElementById('offerPrice').value.trim();
        const description = document.getElementById('offerDescription').value.trim();
        const image = document.getElementById('offerImage').value.trim();
        const promoBadge = document.getElementById('promoBadge').value;
        
        if (!name || !type || !originalPrice) {
            showError('Veuillez remplir les champs obligatoires');
            return;
        }
        
        try {
            const offerData = {
                title: name,
                type,
                original_price: parseFloat(originalPrice),
                description,
                badge: promoBadge || null
            };
            
            if (promoPrice) {
                offerData.promo_price = parseFloat(promoPrice);
            }
            
            if (image) {
                offerData.image_url = image;
            }
            
            await addOffer(offerData);
            
            addOfferModal.classList.remove('active');
            showNotification('Offre ajoutée avec succès!');
            clearOfferForm();
            
        } catch (error) {
            showError('Échec de l\'ajout de l\'offre');
        }
    });

    goLiveBtn.addEventListener('click', async () => {
        const title = document.getElementById('liveTitle').value.trim();
        const description = document.getElementById('liveDescription').value.trim();
        
        if (!title) {
            showError('Veuillez saisir un titre pour la session');
            return;
        }
        
        try {
            await startLiveSession(title, description);
            
            startLiveModal.classList.remove('active');
            showNotification('Session live démarrée avec succès!');
            clearLiveForm();
            
        } catch (error) {
            showError('Échec du démarrage de la session');
        }
    });

    saveContestBtn.addEventListener('click', async () => {
        const name = document.getElementById('contestName').value.trim();
        const description = document.getElementById('contestDescription').value.trim();
        const endDate = document.getElementById('contestEndDate').value;
        const prize = document.getElementById('contestPrize').value.trim();
        
        if (!name || !endDate || !prize) {
            showError('Veuillez remplir tous les champs obligatoires');
            return;
        }
        
        try {
            const contestData = {
                title: name,
                description,
                end_date: endDate,
                prize
            };
            
            await createContest(contestData);
            
            createContestModal.classList.remove('active');
            showNotification('Concours créé avec succès!');
            clearContestForm();
            
        } catch (error) {
            showError('Échec de la création du concours');
        }
    });

    chargeBtn.addEventListener('click', async () => {
        const amount = parseFloat(chargeAmount.value);
        
        if (!amount || amount <= 0) {
            showError('Veuillez saisir un montant valide');
            return;
        }
        
        try {
            await chargeBalance(amount);
            chargeAmount.value = '';
            showNotification(`Rechargement de €${amount} effectué avec succès!`);
        } catch (error) {
            showError('Échec du rechargement');
        }
    });

    saveProfileBtn.addEventListener('click', async () => {
        const newName = profileNameInput.value.trim();
        const phone = document.getElementById('profilePhone').value.trim();
        
        if (!newName) {
            showError('Veuillez entrer votre nom');
            return;
        }
        
        try {
            await updateProfile(newName, phone);
            showNotification('Profil mis à jour avec succès!');
        } catch (error) {
            showError('Échec de la mise à jour du profil');
        }
    });

    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        logoutUser();
    });

    logoutSidebarBtn.addEventListener('click', (e) => {
        e.preventDefault();
        logoutUser();
    });

    userAvatar.addEventListener('click', () => {
        userDropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!userAvatar.contains(e.target) && !userDropdown.contains(e.target)) {
            userDropdown.classList.remove('active');
        }
    });

    settingsBtn.addEventListener('click', () => {
        settingsMenu.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!settingsBtn.contains(e.target) && !settingsMenu.contains(e.target)) {
            settingsMenu.classList.remove('active');
        }
    });

    if (fabBtn) {
        fabBtn.addEventListener('click', () => {
            addOfferModal.classList.add('active');
        });
    }

    if (addOfferBtn) {
        addOfferBtn.addEventListener('click', () => {
            addOfferModal.classList.add('active');
        });
    }

    if (startLiveBtn) {
        startLiveBtn.addEventListener('click', () => {
            startLiveModal.classList.add('active');
        });
    }

    if (createContestBtn) {
        createContestBtn.addEventListener('click', () => {
            createContestModal.classList.add('active');
        });
    }

    cancelOfferBtn.addEventListener('click', () => {
        addOfferModal.classList.remove('active');
        clearOfferForm();
    });

    cancelLiveBtn.addEventListener('click', () => {
        startLiveModal.classList.remove('active');
        clearLiveForm();
    });

    cancelContestBtn.addEventListener('click', () => {
        createContestModal.classList.remove('active');
        clearContestForm();
    });

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            if (tabId === 'live') {
                liveContainer.classList.remove('hidden');
                contestsContainer.classList.add('hidden');
            } else {
                liveContainer.classList.add('hidden');
                contestsContainer.classList.remove('hidden');
            }
        });
    });

    langBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang');
            
            langBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            currentLanguage = lang;
            showNotification(`Langue changée: ${lang === 'fr' ? 'Français' : lang === 'en' ? 'Anglais' : 'Arabe'}`);
            
            settingsMenu.classList.remove('active');
        });
    });

    if (manageUsersBtn) {
        manageUsersBtn.addEventListener('click', () => {
            showNotification('Fonctionnalité de gestion des utilisateurs à venir!');
        });
    }

    if (viewStatsBtn) {
        viewStatsBtn.addEventListener('click', () => {
            showNotification('Statistiques détaillées à venir!');
        });
    }

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });

    // ========== Fonctions utilitaires ==========
    function clearOfferForm() {
        document.getElementById('offerName').value = '';
        document.getElementById('offerType').selectedIndex = 0;
        document.getElementById('originalPrice').value = '';
        document.getElementById('offerPrice').value = '';
        document.getElementById('offerDescription').value = '';
        document.getElementById('offerImage').value = '';
        document.getElementById('promoBadge').selectedIndex = 0;
    }

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

    // ========== Fonctions globales ==========
    window.bookOffer = async function(offerId) {
        try {
            const result = await apiCall('bookings', 'POST', { offerId });
            
            if (result.success) {
                userBalance = result.newBalance;
                updateBalanceDisplay();
                showNotification('Réservation réussie!');
            } else {
                showError('Échec de la réservation. Vérifiez votre solde.');
            }
        } catch (error) {
            showError('Échec de la réservation');
        }
    }

    window.joinLiveSession = function(sessionId) {
        showNotification('Connexion à la session live...');
    }

    window.joinContest = function(contestId) {
        showNotification('Participation au concours...');
    }

    window.editOffer = function(offerId) {
        showNotification('Fonctionnalité de modification à venir!');
    }

    // ========== Initialisation finale ==========
    updateBalanceDisplay();
    checkAuth();
});