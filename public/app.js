// ========== GLOBAL VARIABLES ==========
let userBalance = 0;
let userPoints = 0;
let currentLanguage = 'fr';
let currentUser = null;
let isAdmin = false;

// ========== API CONFIGURATION ==========
const API_BASE_URL = window.location.origin; // Auto-detect Vercel URL

// API call function
async function apiCall(endpoint, method = 'GET', data = null, requiresAuth = true) {
    const url = `${API_BASE_URL}/api/${endpoint}`;
    
    const headers = {
        'Content-Type': 'application/json',
    };
    
    // Add token if needed
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
        console.log(`📤 API Call: ${method} ${url}`);
        const response = await fetch(url, options);
        
        if (response.status === 401) {
            // Token expired
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
        throw error;
    }
}

// ========== INITIALIZE APP ==========
document.addEventListener('DOMContentLoaded', function() {
    // Get DOM Elements
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

    // Initialize UI
    updateBalanceDisplay();
    
    // Check login status on load
    checkLoginStatus();
    
    // Load initial data if logged in
    if (currentUser) {
        loadOffers();
        updateAdminStats();
    }

    // ========== AUTH PAGES SWITCHING ==========
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

    // ========== LOGIN FUNCTIONALITY - REAL API ==========
    loginBtn.addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        const isAdminLogin = document.getElementById('adminLogin').checked;

        if (!email || !password) {
            alert('Veuillez remplir tous les champs');
            return;
        }

        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connexion...';

        try {
            const result = await apiCall('auth/login', 'POST', {
                email,
                password
            }, false);

            if (result.success) {
                // Save token and user data
                localStorage.setItem('token', result.token);
                localStorage.setItem('user', JSON.stringify(result.user));
                
                currentUser = result.user;
                isAdmin = result.user.role === 'admin';
                userBalance = result.user.balance || 0;
                userPoints = result.user.points || 0;
                
                console.log('✅ Login successful, role:', result.user.role);
                
                // Switch to main app
                switchToMainApp();
                
                // Load offers
                loadOffers();
                
                // Update admin stats if admin
                if (isAdmin) {
                    updateAdminStats();
                }
            } else {
                alert(result.message || 'Échec de connexion');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Erreur de connexion au serveur');
        } finally {
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt btn-icon"></i> Se connecter';
        }
    });

    // ========== REGISTER FUNCTIONALITY - REAL API ==========
    registerBtn.addEventListener('click', async () => {
        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value.trim();
        const confirmPassword = document.getElementById('registerConfirmPassword').value.trim();

        if (!name || !email || !password || !confirmPassword) {
            alert('Veuillez remplir tous les champs');
            return;
        }

        if (password !== confirmPassword) {
            alert('Les mots de passe ne correspondent pas');
            return;
        }

        if (password.length < 6) {
            alert('Le mot de passe doit contenir au moins 6 caractères');
            return;
        }

        registerBtn.disabled = true;
        registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Inscription...';

        try {
            const result = await apiCall('auth/register', 'POST', {
                name,
                email,
                password
            }, false);

            if (result.success) {
                // Save token and user data
                localStorage.setItem('token', result.token);
                localStorage.setItem('user', JSON.stringify(result.user));
                
                currentUser = result.user;
                isAdmin = result.user.role === 'admin';
                userBalance = result.user.balance || 0;
                userPoints = result.user.points || 0;
                
                console.log('✅ Registration successful, role:', result.user.role);
                
                // Switch to main app
                switchToMainApp();
                
                // Load offers
                loadOffers();
            } else {
                alert(result.message || 'Échec de l\'inscription');
            }
        } catch (error) {
            console.error('Registration error:', error);
            alert('Erreur d\'inscription au serveur');
        } finally {
            registerBtn.disabled = false;
            registerBtn.innerHTML = '<i class="fas fa-user-plus btn-icon"></i> S\'inscrire';
        }
    });

    // ========== SWITCH TO MAIN APP ==========
    function switchToMainApp() {
        // Hide auth pages
        loginPage.classList.remove('active');
        registerPage.classList.remove('active');

        // Show main app
        mainHeader.style.display = 'flex';
        bottomNav.style.display = 'flex';

        // Update user info
        updateUserInfo();

        // Show admin elements if admin
        if (isAdmin) {
            adminOnlyElements.forEach(el => {
                el.style.display = 'flex';
                el.classList.add('show');
            });
            if (fabBtn) fabBtn.style.display = 'flex';
        }

        // Go to home page
        switchPage('home');
    }

    // ========== CHECK LOGIN STATUS ==========
    async function checkLoginStatus() {
        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');
        
        if (!token || !userStr) {
            console.log('No session found');
            return false;
        }
        
        try {
            // Verify token with API
            const result = await apiCall('auth/verify', 'GET', null, true);
            
            if (result.success) {
                currentUser = result.user;
                isAdmin = result.user.role === 'admin';
                userBalance = result.user.balance || 0;
                userPoints = result.user.points || 0;
                
                console.log('✅ Session restored, role:', result.user.role);
                
                switchToMainApp();
                return true;
            }
        } catch (error) {
            console.log('Session invalid, logging out');
            logout();
            return false;
        }
    }

    // ========== UPDATE USER INFO ==========
    function updateUserInfo() {
        if (!currentUser) return;

        // Update avatar with initials
        const initials = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U';
        userAvatar.textContent = initials;
        profileAvatar.textContent = initials;

        // Update profile info
        profileName.textContent = currentUser.name || 'Utilisateur';
        profileEmail.textContent = currentUser.email || 'email@exemple.com';
        profileNameInput.value = currentUser.name || '';
        profileEmailInput.value = currentUser.email || '';

        // Update balance and points
        profileBalance.textContent = `€${userBalance}`;
        profilePoints.textContent = userPoints;

        // Show admin badge if admin
        if (isAdmin) {
            adminBadgeContainer.innerHTML = '<span class="admin-badge">ADMINISTRATEUR</span>';
            adminOnlyElements.forEach(el => {
                el.style.display = 'flex';
                el.classList.add('show');
            });
            if (fabBtn) fabBtn.style.display = 'flex';
        } else {
            adminBadgeContainer.innerHTML = '';
            adminOnlyElements.forEach(el => {
                el.style.display = 'none';
                el.classList.remove('show');
            });
            if (fabBtn) fabBtn.style.display = 'none';
        }

        // Update balance display
        updateBalanceDisplay();
    }

    // ========== LOAD OFFERS FROM API ==========
    async function loadOffers() {
        try {
            const result = await apiCall('offers', 'GET');
            
            if (result.success && result.offers) {
                // Clear container
                offersContainer.innerHTML = '';
                
                if (result.offers.length === 0) {
                    offersContainer.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-cut"></i>
                            <h3>Aucune prestation disponible</h3>
                            <p>Ajoutez votre première prestation</p>
                        </div>
                    `;
                    return;
                }
                
                // Add each offer
                result.offers.forEach(offer => {
                    const offerCard = document.createElement('div');
                    offerCard.className = 'card hair-service-card';
                    
                    // Add promotion badge if exists
                    let badgeHtml = '';
                    if (offer.badge) {
                        badgeHtml = `<div class="promotion-badge">${offer.badge}</div>`;
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
                                <button class="book-now-btn" onclick="bookOffer('${offer.id || offer._id}')">Réserver</button>
                            </div>
                        </div>
                    `;
                    
                    offersContainer.appendChild(offerCard);
                });
            } else {
                offersContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-cut"></i>
                        <h3>Aucune prestation disponible</h3>
                        <p>Ajoutez votre première prestation</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading offers:', error);
            offersContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Erreur de chargement</h3>
                    <p>Impossible de charger les prestations</p>
                </div>
            `;
        }
    }

    // ========== BOOK OFFER FUNCTION ==========
    window.bookOffer = async function(offerId) {
        if (!currentUser) {
            alert('Veuillez vous connecter pour réserver');
            switchPage('profile');
            return;
        }

        try {
            const result = await apiCall('offers/book', 'POST', {
                offerId: offerId
            });

            if (result.success) {
                // Update user balance
                userBalance = result.userBalance || userBalance;
                userPoints = result.userPoints || userPoints;
                
                // Update localStorage
                if (result.user) {
                    localStorage.setItem('user', JSON.stringify(result.user));
                    currentUser = result.user;
                }
                
                updateUserInfo();
                alert('Réservation effectuée avec succès!');
            } else {
                alert(result.message || 'Échec de la réservation');
            }
        } catch (error) {
            console.error('Booking error:', error);
            alert('Erreur lors de la réservation');
        }
    };

    // ========== PAGE NAVIGATION ==========
    function switchPage(pageId) {
        // Hide all pages
        pages.forEach(page => {
            page.classList.remove('active');
        });

        // Show selected page
        const pageElement = document.getElementById(pageId + 'Page');
        if (pageElement) {
            pageElement.classList.add('active');
        }

        // Update navigation
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-page') === pageId) {
                item.classList.add('active');
            }
        });

        // Close dropdown if open
        if (userDropdown) {
            userDropdown.classList.remove('active');
        }

        // Load data for specific pages
        if (pageId === 'home' && currentUser) {
            loadOffers();
        }
    }

    // Make switchPage globally accessible
    window.switchPage = switchPage;

    // ========== NAVIGATION EVENT LISTENERS ==========
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = item.getAttribute('data-page');
            switchPage(pageId);
        });
    });

    // User avatar click - toggle dropdown
    if (userAvatar) {
        userAvatar.addEventListener('click', () => {
            userDropdown.classList.toggle('active');
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (userAvatar && userDropdown && !userAvatar.contains(e.target) && !userDropdown.contains(e.target)) {
            userDropdown.classList.remove('active');
        }
    });

    // ========== SETTINGS MENU ==========
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            settingsMenu.classList.toggle('active');
        });
    }

    // Close settings when clicking outside
    document.addEventListener('click', (e) => {
        if (settingsBtn && settingsMenu && !settingsBtn.contains(e.target) && !settingsMenu.contains(e.target)) {
            settingsMenu.classList.remove('active');
        }
    });

    // ========== LANGUAGE SWITCHING ==========
    langBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang');

            // Update active language button
            langBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Change language
            currentLanguage = lang;
            alert(`Language changed to: ${lang === 'fr' ? 'French' : lang === 'en' ? 'English' : 'Arabic'}`);

            // Close settings menu
            if (settingsMenu) {
                settingsMenu.classList.remove('active');
            }
        });
    });

    // ========== FAB BUTTON ==========
    if (fabBtn) {
        fabBtn.addEventListener('click', () => {
            if (addOfferModal) {
                addOfferModal.classList.add('active');
            }
        });
    }

    // ========== TAB SWITCHING ==========
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');

            // Update active tab button
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Show active tab content
            if (tabId === 'live') {
                liveContainer.classList.remove('hidden');
                contestsContainer.classList.add('hidden');
            } else {
                liveContainer.classList.add('hidden');
                contestsContainer.classList.remove('hidden');
            }
        });
    });

    // ========== ADD OFFER MODAL ==========
    if (addOfferBtn) {
        addOfferBtn.addEventListener('click', () => {
            addOfferModal.classList.add('active');
        });
    }

    if (cancelOfferBtn) {
        cancelOfferBtn.addEventListener('click', () => {
            addOfferModal.classList.remove('active');
            clearOfferForm();
        });
    }

    if (saveOfferBtn) {
        saveOfferBtn.addEventListener('click', async () => {
            const name = document.getElementById('offerName').value.trim();
            const type = document.getElementById('offerType').value;
            const originalPrice = document.getElementById('originalPrice').value;
            const promoPrice = document.getElementById('offerPrice').value.trim();
            const description = document.getElementById('offerDescription').value.trim();
            const image = document.getElementById('offerImage').value.trim();
            const promoBadge = document.getElementById('promoBadge').value;

            if (!name || !type || !originalPrice) {
                alert('Veuillez remplir tous les champs obligatoires');
                return;
            }

            saveOfferBtn.disabled = true;
            saveOfferBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ajout...';

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
                    // Reload offers
                    loadOffers();
                    
                    // Update admin stats
                    updateAdminStats();
                    
                    // Close modal and clear form
                    addOfferModal.classList.remove('active');
                    clearOfferForm();
                    
                    alert('Prestation ajoutée avec succès!');
                } else {
                    alert(result.message || 'Échec de l\'ajout');
                }
            } catch (error) {
                console.error('Add offer error:', error);
                alert('Erreur lors de l\'ajout');
            } finally {
                saveOfferBtn.disabled = false;
                saveOfferBtn.innerHTML = 'Ajouter la prestation';
            }
        });
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

    // ========== START LIVE MODAL ==========
    if (startLiveBtn) {
        startLiveBtn.addEventListener('click', () => {
            startLiveModal.classList.add('active');
        });
    }

    if (cancelLiveBtn) {
        cancelLiveBtn.addEventListener('click', () => {
            startLiveModal.classList.remove('active');
            clearLiveForm();
        });
    }

    if (goLiveBtn) {
        goLiveBtn.addEventListener('click', () => {
            const title = document.getElementById('liveTitle').value.trim();
            const description = document.getElementById('liveDescription').value.trim();

            if (!title) {
                alert('Veuillez saisir un titre pour votre séance');
                return;
            }

            // Remove empty state if it exists
            const emptyState = liveContainer.querySelector('.empty-state');
            if (emptyState) {
                liveContainer.removeChild(emptyState);
            }

            // Create new live card
            const liveCard = document.createElement('div');
            liveCard.className = 'card hair-service-card';
            liveCard.innerHTML = `
                <div class="card-header">
                    <div class="live-indicator">
                        <span class="live-dot"></span>
                        <span>EN DIRECT</span>
                    </div>
                    <h3 class="card-title">${title}</h3>
                    <p class="card-subtitle">${description || 'Séance de coiffure en direct'}</p>
                </div>
                <div class="card-content">
                    <p>Rejoignez-nous maintenant pour regarder et interagir en temps réel!</p>
                    <button class="btn btn-primary btn-full mt-12">
                        <i class="fas fa-play btn-icon"></i>
                        Rejoindre la séance
                    </button>
                </div>
            `;

            // Add to live container at the beginning
            liveContainer.prepend(liveCard);

            // Close modal and clear form
            startLiveModal.classList.remove('active');
            clearLiveForm();

            // Show success message
            alert('Séance en direct démarrée avec succès!');
        });
    }

    function clearLiveForm() {
        document.getElementById('liveTitle').value = '';
        document.getElementById('liveDescription').value = '';
        document.getElementById('liveSchedule').value = '';
    }

    // ========== CREATE CONTEST MODAL ==========
    if (createContestBtn) {
        createContestBtn.addEventListener('click', () => {
            createContestModal.classList.add('active');
        });
    }

    if (cancelContestBtn) {
        cancelContestBtn.addEventListener('click', () => {
            createContestModal.classList.remove('active');
            clearContestForm();
        });
    }

    if (saveContestBtn) {
        saveContestBtn.addEventListener('click', () => {
            const name = document.getElementById('contestName').value.trim();
            const description = document.getElementById('contestDescription').value.trim();
            const endDate = document.getElementById('contestEndDate').value;
            const prize = document.getElementById('contestPrize').value.trim();

            if (!name || !endDate || !prize) {
                alert('Veuillez remplir tous les champs obligatoires');
                return;
            }

            // Remove empty state if it exists
            const emptyState = contestsContainer.querySelector('.empty-state');
            if (emptyState) {
                contestsContainer.removeChild(emptyState);
            }

            // Format date
            const formattedDate = new Date(endDate).toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            // Create new contest card
            const contestCard = document.createElement('div');
            contestCard.className = 'card hair-service-card';
            contestCard.innerHTML = `
                <div class="card-header">
                    <div class="promotion-badge">CONCOURS</div>
                    <h3 class="card-title">${name}</h3>
                    <p class="card-subtitle">Fin: ${formattedDate}</p>
                </div>
                <div class="card-content">
                    <p><strong>Prix:</strong> ${prize}</p>
                    <p>${description || 'Participez à notre concours passionnant!'}</p>
                    <button class="btn btn-primary btn-full mt-12">
                        <i class="fas fa-sign-in-alt btn-icon"></i>
                        Participer
                    </button>
                </div>
            `;

            // Add to contests container at the beginning
            contestsContainer.prepend(contestCard);

            // Close modal and clear form
            createContestModal.classList.remove('active');
            clearContestForm();

            // Show success message
            alert('Concours créé avec succès!');
        });
    }

    function clearContestForm() {
        document.getElementById('contestName').value = '';
        document.getElementById('contestDescription').value = '';
        document.getElementById('contestEndDate').value = '';
        document.getElementById('contestPrize').value = '';
    }

    // ========== PAYMENT SYSTEM ==========
    if (chargeBtn) {
        chargeBtn.addEventListener('click', async () => {
            const amount = parseFloat(chargeAmount.value);

            if (!amount || amount <= 0) {
                alert('Veuillez saisir un montant valide');
                return;
            }

            try {
                const result = await apiCall('user/charge', 'POST', {
                    amount: amount
                });

                if (result.success) {
                    // Update local variables
                    userBalance = result.balance;
                    userPoints = result.points;
                    
                    // Update current user
                    if (result.user) {
                        currentUser = result.user;
                        localStorage.setItem('user', JSON.stringify(currentUser));
                    }

                    updateBalanceDisplay();
                    updateUserInfo();

                    // Clear input
                    chargeAmount.value = '';

                    alert(`Rechargement de €${amount.toFixed(2)} effectué avec succès!`);
                } else {
                    alert(result.message || 'Échec du rechargement');
                }
            } catch (error) {
                console.error('Charge error:', error);
                alert('Erreur lors du rechargement');
            }
        });
    }

    function updateBalanceDisplay() {
        if (balanceAmount) balanceAmount.textContent = `€${userBalance.toFixed(2)}`;
        if (userBalanceEl) userBalanceEl.textContent = userBalance.toFixed(2);
        if (userPointsEl) userPointsEl.textContent = userPoints;
    }

    // ========== SAVE PROFILE ==========
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async () => {
            const newName = profileNameInput.value.trim();
            const newEmail = profileEmailInput.value.trim();

            if (!newName) {
                alert('Veuillez entrer votre nom');
                return;
            }

            if (!newEmail) {
                alert('Veuillez entrer votre email');
                return;
            }

            try {
                const result = await apiCall('user/update', 'PUT', {
                    name: newName,
                    email: newEmail
                });

                if (result.success) {
                    // Update current user
                    currentUser = result.user;
                    localStorage.setItem('user', JSON.stringify(currentUser));

                    // Update UI
                    updateUserInfo();

                    alert('Profil mis à jour avec succès!');
                } else {
                    alert(result.message || 'Échec de la mise à jour');
                }
            } catch (error) {
                console.error('Update profile error:', error);
                alert('Erreur lors de la mise à jour du profil');
            }
        });
    }

    // ========== LOGOUT FUNCTIONALITY ==========
    function logout() {
        // Clear localStorage
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Reset variables
        currentUser = null;
        isAdmin = false;
        userBalance = 0;
        userPoints = 0;
        
        // Hide main app
        mainHeader.style.display = 'none';
        bottomNav.style.display = 'none';
        
        // Hide admin elements
        adminOnlyElements.forEach(el => {
            el.style.display = 'none';
            el.classList.remove('show');
        });
        if (fabBtn) fabBtn.style.display = 'none';
        
        // Show login page
        loginPage.classList.add('active');
        registerPage.classList.remove('active');
        
        // Reset login form
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
        document.getElementById('adminLogin').checked = false;
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }

    if (logoutSidebarBtn) {
        logoutSidebarBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }

    // ========== ADMIN STATS ==========
    async function updateAdminStats() {
        if (!isAdmin) return;

        try {
            const result = await apiCall('admin/stats', 'GET');
            
            if (result.success) {
                document.getElementById('totalOffers').textContent = result.totalOffers || 0;
                document.getElementById('totalUsers').textContent = result.totalUsers || 0;
                document.getElementById('totalRevenue').textContent = `€${result.totalRevenue || 0}`;
            }
        } catch (error) {
            console.error('Error loading admin stats:', error);
        }
    }

    // ========== MANAGE USERS BUTTON ==========
    if (manageUsersBtn) {
        manageUsersBtn.addEventListener('click', () => {
            alert('Fonctionnalité de gestion des utilisateurs à venir!');
        });
    }

    // ========== VIEW STATS BUTTON ==========
    if (viewStatsBtn) {
        viewStatsBtn.addEventListener('click', () => {
            alert('Statistiques détaillées à venir!');
        });
    }

    // ========== MODAL CLOSE ON CLICK OUTSIDE ==========
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
});