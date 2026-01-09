// Initialize variables
let userBalance = 0;
let userPoints = 0;
let currentLanguage = 'fr';
let currentUser = null;
let isAdmin = false;

// Initialize UI when DOM is loaded
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

    // Switch between auth pages
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

    // Login functionality
    loginBtn.addEventListener('click', () => {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        const isAdminLogin = document.getElementById('adminLogin').checked;

        if (!email || !password) {
            alert('Veuillez remplir tous les champs');
            return;
        }

        // For demo purposes - in real app, this would be server-side authentication
        // Check if it's the special admin email
        if (isAdminLogin && email === 'admin@eldjamila.com' && password === 'admin123') {
            // Admin login
            currentUser = {
                name: 'El Djamila',
                email: email,
                initials: 'ED',
                isAdmin: true
            };
            isAdmin = true;
            userBalance = 1000; // Admin has more balance for demo
            userPoints = 1000;
        } else if (!isAdminLogin) {
            // Regular user login
            currentUser = {
                name: email.split('@')[0],
                email: email,
                initials: email.charAt(0).toUpperCase(),
                isAdmin: false
            };
            isAdmin = false;
            userBalance = 150; // Regular user balance
            userPoints = 150;
        } else {
            alert('Identifiants administrateur incorrects');
            return;
        }

        // Save to localStorage
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        localStorage.setItem('userBalance', userBalance);
        localStorage.setItem('userPoints', userPoints);
        localStorage.setItem('isAdmin', isAdmin);

        // Switch to main app
        switchToMainApp();
    });

    // Register functionality
    registerBtn.addEventListener('click', () => {
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

        // For demo purposes
        currentUser = {
            name: name,
            email: email,
            initials: name.charAt(0).toUpperCase(),
            isAdmin: false
        };
        isAdmin = false;
        userBalance = 50; // New user gets 50€ bonus
        userPoints = 50;

        // Save to localStorage
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        localStorage.setItem('userBalance', userBalance);
        localStorage.setItem('userPoints', userPoints);
        localStorage.setItem('isAdmin', isAdmin);

        // Switch to main app
        switchToMainApp();
    });

    // Switch to main app after login
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

    // Update user info
    function updateUserInfo() {
        if (!currentUser) return;

        // Update avatar
        userAvatar.textContent = currentUser.initials;
        profileAvatar.textContent = currentUser.initials;

        // Update profile info
        profileName.textContent = currentUser.name;
        profileEmail.textContent = currentUser.email;
        profileNameInput.value = currentUser.name;
        profileEmailInput.value = currentUser.email;

        // Update balance and points
        profileBalance.textContent = `€${userBalance}`;
        profilePoints.textContent = userPoints;

        // Show admin badge if admin
        if (isAdmin) {
            adminBadgeContainer.innerHTML = '<span class="admin-badge">ADMINISTRATEUR</span>';
        } else {
            adminBadgeContainer.innerHTML = '';
        }

        // Update balance display
        updateBalanceDisplay();
    }

    // Check if user is already logged in
    function checkLoginStatus() {
        const savedUser = localStorage.getItem('currentUser');
        const savedBalance = localStorage.getItem('userBalance');
        const savedPoints = localStorage.getItem('userPoints');
        const savedIsAdmin = localStorage.getItem('isAdmin');

        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            userBalance = parseFloat(savedBalance) || 0;
            userPoints = parseInt(savedPoints) || 0;
            isAdmin = savedIsAdmin === 'true';

            switchToMainApp();
        }
    }

    // Call on page load
    checkLoginStatus();

    // Page Navigation
    function switchPage(pageId) {
        // Hide all pages
        pages.forEach(page => {
            page.classList.remove('active');
        });

        // Show selected page
        document.getElementById(pageId + 'Page').classList.add('active');

        // Update navigation
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-page') === pageId) {
                item.classList.add('active');
            }
        });

        // Close dropdown if open
        userDropdown.classList.remove('active');
    }

    // Make switchPage globally accessible
    window.switchPage = switchPage;

    // Navigation Click Handlers
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = item.getAttribute('data-page');
            switchPage(pageId);
        });
    });

    // User avatar click - toggle dropdown
    userAvatar.addEventListener('click', () => {
        userDropdown.classList.toggle('active');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!userAvatar.contains(e.target) && !userDropdown.contains(e.target)) {
            userDropdown.classList.remove('active');
        }
    });

    // Settings Menu Toggle
    settingsBtn.addEventListener('click', () => {
        settingsMenu.classList.toggle('active');
    });

    // Close settings when clicking outside
    document.addEventListener('click', (e) => {
        if (!settingsBtn.contains(e.target) && !settingsMenu.contains(e.target)) {
            settingsMenu.classList.remove('active');
        }
    });

    // Language Switching
    langBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang');

            // Update active language button
            langBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Change language (simplified for demo)
            currentLanguage = lang;
            alert(`Language changed to: ${lang === 'fr' ? 'French' : lang === 'en' ? 'English' : 'Arabic'}`);

            // In a real app, you would update all text content here
            // For demo, we'll just close the settings menu
            settingsMenu.classList.remove('active');
        });
    });

    // FAB Button - Quick Action for Offers Page
    if (fabBtn) {
        fabBtn.addEventListener('click', () => {
            addOfferModal.classList.add('active');
        });
    }

    // Tab Switching
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

    // Add Offer Modal
    if (addOfferBtn) {
        addOfferBtn.addEventListener('click', () => {
            addOfferModal.classList.add('active');
        });
    }

    cancelOfferBtn.addEventListener('click', () => {
        addOfferModal.classList.remove('active');
        clearOfferForm();
    });

    saveOfferBtn.addEventListener('click', () => {
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

        // Remove empty state if it exists
        const emptyState = offersContainer.querySelector('.empty-state');
        if (emptyState) {
            offersContainer.removeChild(emptyState);
        }

        // Calculate discount percentage if promo price exists
        let discountHtml = '';
        let priceHtml = '';
        let currentPrice = parseFloat(originalPrice);

        if (promoPrice && parseFloat(promoPrice) > 0) {
            currentPrice = parseFloat(promoPrice);
            const discountPercent = Math.round((1 - parseFloat(promoPrice) / parseFloat(originalPrice)) * 100);
            priceHtml = `
                <div class="price-info">
                    <div class="original-price">€${parseFloat(originalPrice).toFixed(2)}</div>
                    <div class="current-price">€${currentPrice.toFixed(2)}</div>
                </div>
                <div class="discount-percent">-${discountPercent}%</div>
            `;
        } else {
            priceHtml = `
                <div class="price-info">
                    <div class="current-price">€${currentPrice.toFixed(2)}</div>
                </div>
                <button class="book-now-btn">Réserver</button>
            `;
        }

        // Create new offer card with NEW LAYOUT
        const offerCard = document.createElement('div');
        offerCard.className = 'card hair-service-card';

        // Add promotion badge if selected
        let badgeHtml = '';
        if (promoBadge) {
            if (promoBadge === 'TOP') {
                badgeHtml = `<div class="salon-badge">${promoBadge}</div>`;
            } else {
                badgeHtml = `<div class="promotion-badge">${promoBadge}</div>`;
            }
        }

        // Default image if none provided
        const defaultImages = [
            'https://images.unsplash.com/photo-1560066984-138dadb4c035?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
            'https://images.unsplash.com/photo-1596703923338-48f1c07e4f2e?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
            'https://images.unsplash.com/photo-1556228578-9c360e1d8d34?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
            'https://images.unsplash.com/photo-1605497788044-5a32c7078486?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80'
        ];
        const randomImage = defaultImages[Math.floor(Math.random() * defaultImages.length)];
        const imageUrl = image || randomImage;

        offerCard.innerHTML = `
            ${badgeHtml}
            <div class="card-image">
                <img src="${imageUrl}" alt="${name}">
            </div>
            <div class="card-content">
                <span class="service-type">${type}</span>
                <h3 class="service-name">${name}</h3>
                <p class="card-subtitle" style="font-size: 12px; color: var(--gray); margin-bottom: 10px;">${description || 'Prestation professionnelle de haute qualité.'}</p>
                <div class="price-section">
                    ${priceHtml}
                </div>
            </div>
        `;

        // Add to offers container at the beginning
        offersContainer.prepend(offerCard);

        // Update admin stats
        updateAdminStats();

        // Close modal and clear form
        addOfferModal.classList.remove('active');
        clearOfferForm();

        // Show success message
        alert('Prestation ajoutée avec succès!');
    });

    function clearOfferForm() {
        document.getElementById('offerName').value = '';
        document.getElementById('offerType').selectedIndex = 0;
        document.getElementById('originalPrice').value = '';
        document.getElementById('offerPrice').value = '';
        document.getElementById('offerDescription').value = '';
        document.getElementById('offerImage').value = '';
        document.getElementById('promoBadge').selectedIndex = 0;
    }

    // Start Live Modal
    if (startLiveBtn) {
        startLiveBtn.addEventListener('click', () => {
            startLiveModal.classList.add('active');
        });
    }

    cancelLiveBtn.addEventListener('click', () => {
        startLiveModal.classList.remove('active');
        clearLiveForm();
    });

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

    function clearLiveForm() {
        document.getElementById('liveTitle').value = '';
        document.getElementById('liveDescription').value = '';
        document.getElementById('liveSchedule').value = '';
    }

    // Create Contest Modal
    if (createContestBtn) {
        createContestBtn.addEventListener('click', () => {
            createContestModal.classList.add('active');
        });
    }

    cancelContestBtn.addEventListener('click', () => {
        createContestModal.classList.remove('active');
        clearContestForm();
    });

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

    function clearContestForm() {
        document.getElementById('contestName').value = '';
        document.getElementById('contestDescription').value = '';
        document.getElementById('contestEndDate').value = '';
        document.getElementById('contestPrize').value = '';
    }

    // Payment System
    chargeBtn.addEventListener('click', () => {
        const amount = parseFloat(chargeAmount.value);

        if (!amount || amount <= 0) {
            alert('Veuillez saisir un montant valide');
            return;
        }

        // Update balance
        userBalance += amount;
        userPoints += Math.floor(amount);

        // Save to localStorage
        localStorage.setItem('userBalance', userBalance);
        localStorage.setItem('userPoints', userPoints);

        updateBalanceDisplay();
        updateUserInfo();

        // Clear input
        chargeAmount.value = '';

        // Show success message
        alert(`Rechargement de €${amount.toFixed(2)} effectué avec succès!`);
    });

    function updateBalanceDisplay() {
        balanceAmount.textContent = `€${userBalance.toFixed(2)}`;
        if (userBalanceEl) userBalanceEl.textContent = userBalance.toFixed(2);
        if (userPointsEl) userPointsEl.textContent = userPoints;
    }

    // Save Profile
    saveProfileBtn.addEventListener('click', () => {
        const newName = profileNameInput.value.trim();

        if (!newName) {
            alert('Veuillez entrer votre nom');
            return;
        }

        // Update current user
        currentUser.name = newName;
        currentUser.initials = newName.charAt(0).toUpperCase();

        // Save to localStorage
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        // Update UI
        updateUserInfo();

        alert('Profil mis à jour avec succès!');
    });

    // Logout functionality
    function logout() {
        // Clear localStorage
        localStorage.removeItem('currentUser');
        localStorage.removeItem('userBalance');
        localStorage.removeItem('userPoints');
        localStorage.removeItem('isAdmin');

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

    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });

    logoutSidebarBtn.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });

    // Admin Stats
    function updateAdminStats() {
        if (!isAdmin) return;

        // Count offers
        const offers = offersContainer.querySelectorAll('.card.hair-service-card');
        document.getElementById('totalOffers').textContent = offers.length;

        // For demo, just show some numbers
        document.getElementById('totalUsers').textContent = '15';
        document.getElementById('totalRevenue').textContent = '€2,450';
    }

    // Manage Users Button
    if (manageUsersBtn) {
        manageUsersBtn.addEventListener('click', () => {
            alert('Fonctionnalité de gestion des utilisateurs à venir!');
        });
    }

    // View Stats Button
    if (viewStatsBtn) {
        viewStatsBtn.addEventListener('click', () => {
            alert('Statistiques détaillées à venir!');
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

    // Initialize admin stats if admin
    if (isAdmin) {
        updateAdminStats();
    }
});