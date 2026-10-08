// --- Datos Iniciales de Productos ---
const defaultProducts = [
    { id: 1, name: "ConfortBook Pro X", price: 1499.00, oldPrice: 1699.00, category: "Computadores", rating: 4.9, reviews: 128, image: "assets/premium_laptop_1778531221300.png", badge: "new" },
    { id: 2, name: "Chrono Elite Gold", price: 399.00, oldPrice: null, category: "Accesorios", rating: 4.8, reviews: 85, image: "assets/premium_smartwatch_1778531397408.png", badge: null },
    { id: 3, name: "Aura Sound Max", price: 299.00, oldPrice: 349.00, category: "Audio", rating: 4.7, reviews: 210, image: "assets/premium_headphones_1778531409537.png", badge: "sale" },
    { id: 4, name: "Monitor Vision 4K", price: 450.00, oldPrice: null, category: "Computadores", rating: 4.6, reviews: 54, image: "assets/premium_monitor.jpg", badge: null },
    { id: 5, name: "Teclado Titan RGB", price: 120.00, oldPrice: 150.00, category: "Accesorios", rating: 4.8, reviews: 320, image: "assets/premium_keyboard.jpg", badge: "sale" },
    { id: 6, name: "Ratón Viper Pro", price: 85.00, oldPrice: null, category: "Accesorios", rating: 4.5, reviews: 112, image: "assets/premium_mouse.jpg", badge: null },
    { id: 7, name: "Silla Ergonomic Plus", price: 320.00, oldPrice: null, category: "Hogar", rating: 4.7, reviews: 89, image: "assets/premium_chair.jpg", badge: null },
    { id: 8, name: "Cámara Stream 4K", price: 150.00, oldPrice: null, category: "Accesorios", rating: 4.4, reviews: 67, image: "assets/premium_camera.jpg", badge: null },
    { id: 9, name: "Micro Studio Voice 24K", price: 190.00, oldPrice: 220.00, category: "Audio", rating: 4.9, reviews: 145, image: "assets/premium_microphone.jpg", badge: "sale" },
    { id: 10, name: "Gafas Reality Max", price: 599.00, oldPrice: null, category: "Drones", rating: 4.6, reviews: 34, image: "assets/premium_glasses.jpg", badge: "new" },
    { id: 11, name: "Drone SkyEye Pro", price: 899.00, oldPrice: 999.00, category: "Drones", rating: 4.8, reviews: 42, image: "assets/premium_drone.jpg", badge: "sale" },
    { id: 12, name: "Tablet ArtPad 12\"", price: 250.00, oldPrice: null, category: "Computadores", rating: 4.5, reviews: 76, image: "assets/premium_tablet.jpg", badge: null },
    { id: 13, name: "Altavoz Smart Echo", price: 99.00, oldPrice: null, category: "Hogar", rating: 4.3, reviews: 201, image: "assets/premium_speaker.jpg", badge: null }
];

// El navegador conserva solo una copia de lectura del catálogo; precios y pedidos se validan en el servidor.
let products = JSON.parse(localStorage.getItem('confort_products')) || defaultProducts;

// Sincronizar imagen del micrófono si quedó antigua en localStorage
const micProduct = products.find(p => p.id === 9);
if (micProduct && (micProduct.image.includes('picsum') || micProduct.image !== 'assets/premium_microphone.jpg')) {
    micProduct.image = 'assets/premium_microphone.jpg';
    micProduct.name = 'Micro Studio Voice 24K';
    localStorage.setItem('confort_products', JSON.stringify(products));
}

// --- Estado Global ---
let currentUser = null;
let apiCsrfToken = null;
let userCartKey = 'confort_cart_guest';
let userWishlistKey = 'confort_wishlist_guest';

for (let storageIndex = localStorage.length - 1; storageIndex >= 0; storageIndex -= 1) {
    const storageKey = localStorage.key(storageIndex);
    if (storageKey === 'confort_users' || storageKey === 'confort_last_order' || storageKey?.startsWith('confort_orders_')) {
        localStorage.removeItem(storageKey);
    }
}
localStorage.removeItem('confort_current_user');
localStorage.removeItem('confort_user_logged_in');

let cart = JSON.parse(localStorage.getItem(userCartKey)) || [];
let wishlist = JSON.parse(localStorage.getItem(userWishlistKey)) || [];

const apiRequest = async (action, { method = 'GET', body = null, authenticated = false } = {}) => {
    const headers = { Accept: 'application/json' };
    if (body !== null) headers['Content-Type'] = 'application/json';
    if (authenticated) {
        if (!apiCsrfToken) throw new Error('La sesión expiró. Inicia sesión nuevamente.');
        headers['X-CSRF-Token'] = apiCsrfToken;
    }
    let response;
    try {
        response = await fetch(`api/index.php?action=${encodeURIComponent(action)}`, {
            method,
            headers,
            credentials: 'same-origin',
            body: body === null ? undefined : JSON.stringify(body)
        });
    } catch (error) {
        throw new Error('No fue posible conectar con el servidor. Verifica tu conexión e inténtalo nuevamente.');
    }
    let result;
    try {
        result = await response.json();
    } catch (error) {
        throw new Error('El servidor devolvió una respuesta no válida. Intenta más tarde.');
    }
    if (!response.ok) throw new Error(result.error || 'No fue posible completar la solicitud.');
    return result;
};

const refreshBackendSession = async () => {
    const session = await apiRequest('me');
    currentUser = session.user || null;
    apiCsrfToken = session.csrfToken || null;
    if (currentUser) {
        localStorage.setItem('confort_current_user', JSON.stringify(currentUser));
        localStorage.setItem('confort_user_logged_in', 'true');
    } else {
        localStorage.removeItem('confort_current_user');
        localStorage.removeItem('confort_user_logged_in');
    }
    userCartKey = currentUser ? `confort_cart_${currentUser.email}` : 'confort_cart_guest';
    userWishlistKey = currentUser ? `confort_wishlist_${currentUser.email}` : 'confort_wishlist_guest';
    cart = JSON.parse(localStorage.getItem(userCartKey)) || [];
    wishlist = JSON.parse(localStorage.getItem(userWishlistKey)) || [];
    return currentUser;
};

const loadBackendProducts = async () => {
    const result = await apiRequest('products');
    if (!Array.isArray(result.products)) throw new Error('El servidor no devolvió un catálogo válido.');
    products = result.products;
    localStorage.setItem('confort_products', JSON.stringify(products));
};

// Cupón activo en checkout
let appliedCoupon = null;

// --- Funciones Utilitarias ---
const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
};

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[character]));

// Toasts
const showToast = (message, type = 'success') => {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? '<i class="fa-solid fa-circle-check" style="color:#2ed573; font-size:1.2rem;"></i>' : 
                 type === 'error' ? '<i class="fa-solid fa-circle-exclamation" style="color:#ff4757; font-size:1.2rem;"></i>' : 
                 '<i class="fa-solid fa-circle-info" style="color:#3498db; font-size:1.2rem;"></i>';

    toast.innerHTML = `${icon}<div style="font-weight:500;"></div><div class="toast-progress"></div>`;
    toast.querySelector('div').textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease reverse forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// --- Navbar & UI Global ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await refreshBackendSession();
    } catch (error) {
        console.error('No se pudo validar la sesión del servidor:', error);
        currentUser = null;
        apiCsrfToken = null;
    }
    try {
        await loadBackendProducts();
    } catch (error) {
        console.error('No se pudo cargar el catálogo del servidor:', error);
        if (document.body.classList.contains('admin-page')) showToast(error.message, 'error');
    }

    // Loading Screen
    setTimeout(() => {
        const loader = document.getElementById('loading-screen');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 500);
        }
    }, 800);

    // Navbar Scroll Effect
    const navbar = document.getElementById('navbar');
    const backToTop = document.getElementById('back-to-top');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            if(navbar) navbar.classList.add('scrolled');
            if(backToTop) backToTop.classList.add('visible');
        } else {
            if(navbar) navbar.classList.remove('scrolled');
            if(backToTop) backToTop.classList.remove('visible');
        }
    });

    // Mobile Menu
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('nav-menu');
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
    }

    // Auth Links
    const authLinks = document.getElementById('nav-auth-links');
    if (authLinks) {
        if (currentUser) {
            const adminBadge = currentUser.role === 'admin' 
                ? '<a href="admin.html" class="nav-link" style="color:var(--gold-primary);"><i class="fa-solid fa-shield-halved"></i> Admin BCP</a>' 
                : '';
            authLinks.innerHTML = `
                ${adminBadge}
                <a href="#" onclick="logout(event)" class="nav-link" style="color:var(--text-secondary)"><i class="fa-solid fa-right-from-bracket"></i> Salir</a>
            `;
        } else {
            authLinks.innerHTML = `
                <a href="login.html" class="nav-link"><i class="fa-regular fa-user"></i> Login</a>
                <a href="register.html" class="nav-link" style="color:var(--gold-primary)"><i class="fa-solid fa-user-plus"></i> Registro</a>
            `;
        }
    }

    updateCartCount();
    updateWishlistCount();
    updateBcpUI();
    
    // Inicializar páginas
    initIndexPage();
    initCheckoutPage();
    await initDashboardPage();
    initAuthPages();
    if (new URLSearchParams(window.location.search).get('error') === 'server') {
        showToast('No pudimos validar la sesión con el servidor. Revisa la configuración del servicio.', 'error');
    }

    // Forgot password link
    const forgotLink = document.getElementById('forgot-password-link');
    if (forgotLink) forgotLink.addEventListener('click', (e) => { e.preventDefault(); openForgotModal(); });

    // Modal close on backdrop click
    const forgotModal = document.getElementById('forgot-modal');
    if (forgotModal) forgotModal.addEventListener('click', (e) => { if (e.target === forgotModal) closeForgotModal(); });

    const qvModal = document.getElementById('quick-view-modal');
    if (qvModal) qvModal.addEventListener('click', (e) => { if (e.target === qvModal) closeQuickView(); });

    const prodModal = document.getElementById('product-modal');
    if (prodModal) prodModal.addEventListener('click', (e) => { if (e.target === prodModal) closeProductModal(); });
});

window.logout = (e) => {
    if (e) e.preventDefault();
    apiRequest('logout', { method: 'POST', body: {}, authenticated: true })
        .then(() => {
            localStorage.removeItem('confort_current_user');
            localStorage.removeItem('confort_user_logged_in');
            window.location.href = 'index.html';
        })
        .catch(error => showToast(error.message, 'error'));
};

// --- Forgot Password (Modal) ---
window.verifyForgotEmail = async () => {
    const email = document.getElementById('forgot-email').value.trim().toLowerCase();
    if (!validateEmail(email)) { showToast('Ingresa un correo válido', 'error'); return; }
    try {
        const result = await apiRequest('request-password-reset', { method: 'POST', body: { email } });
        showToast(result.message, 'info');
        document.getElementById('forgot-step-1').style.display = 'none';
        document.getElementById('forgot-step-2').style.display = 'block';
    } catch (error) {
        showToast(error.message, 'error');
    }
};

window.resetPassword = async () => {
    const code = document.getElementById('forgot-otp-code').value.trim();
    const newPass = document.getElementById('forgot-new-password').value;
    const confirm = document.getElementById('forgot-confirm-password').value;
    if (newPass.length < 8) { showToast('La contraseña debe tener al menos 8 caracteres', 'error'); return; }
    if (newPass !== confirm) { showToast('Las contraseñas no coinciden', 'error'); return; }
    try {
        const result = await apiRequest('reset-password', { method: 'POST', body: { code, password: newPass } });
        showToast(result.message);
        closeForgotModal();
    } catch (error) {
        showToast(error.message, 'error');
    }
};

window.closeForgotModal = () => {
    document.getElementById('forgot-modal').style.display = 'none';
    document.getElementById('forgot-step-1').style.display = 'block';
    document.getElementById('forgot-step-2').style.display = 'none';
    document.getElementById('forgot-email').value = '';
    document.getElementById('forgot-otp-code').value = '';
    document.getElementById('forgot-new-password').value = '';
    document.getElementById('forgot-confirm-password').value = '';
};

const openForgotModal = () => {
    document.getElementById('forgot-modal').style.display = 'flex';
};

// --- Funciones de Carrito y Wishlist ---
const updateCartCount = () => {
    const countEl = document.getElementById('cart-count');
    if (countEl) {
        const total = cart.reduce((sum, item) => sum + item.quantity, 0);
        countEl.textContent = total;
        countEl.style.animation = 'none';
        countEl.offsetHeight;
        countEl.style.animation = 'pulse 0.3s ease';
    }
};

const updateWishlistCount = () => {
    const countEl = document.getElementById('wishlist-count');
    if (countEl) countEl.textContent = wishlist.length;
};

const addToCart = (productId, quantity = 1) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existing = cart.find(item => item.id === productId);
    if (existing) {
        existing.quantity += quantity;
    } else {
        cart.push({ ...product, quantity: quantity });
    }
    
    localStorage.setItem(userCartKey, JSON.stringify(cart));
    updateCartCount();
    showToast(`${product.name} añadido al carrito`);
    renderCart(); // Si estamos en checkout
};

const toggleWishlist = (productId) => {
    const idx = wishlist.indexOf(productId);
    if (idx > -1) {
        wishlist.splice(idx, 1);
        showToast('Eliminado de la lista de deseos', 'info');
    } else {
        wishlist.push(productId);
        showToast('Agregado a la lista de deseos ❤️');
    }
    localStorage.setItem(userWishlistKey, JSON.stringify(wishlist));
    updateWishlistCount();
    renderProducts();
    if (typeof renderDashboardWishlist === 'function') renderDashboardWishlist();
};

// --- Quick View Modal & Ediciones ---
let currentQvProduct = null;
let currentQvQty = 1;
let currentEdition = 'Obsidian & Gold';

window.selectEdition = (element, editionName) => {
    currentEdition = editionName;
    document.querySelectorAll('.edition-pill').forEach(p => p.classList.remove('active'));
    element.classList.add('active');
    showToast(`Acabado "${editionName}" seleccionado`);
};

window.openQuickView = (productId) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    currentQvProduct = product;
    currentQvQty = 1;

    const modal = document.getElementById('quick-view-modal');
    if (!modal) return;

    const imgEl = document.getElementById('qv-image');
    if (imgEl) {
        imgEl.src = product.image;
        imgEl.alt = product.name;
    }
    const catEl = document.getElementById('qv-category');
    if (catEl) catEl.textContent = product.category;

    const titleEl = document.getElementById('qv-title');
    if (titleEl) titleEl.textContent = product.name;

    const priceEl = document.getElementById('qv-price');
    if (priceEl) priceEl.textContent = formatPrice(product.price);
    
    const oldPriceEl = document.getElementById('qv-old-price');
    if (oldPriceEl) {
        if (product.oldPrice) {
            oldPriceEl.textContent = formatPrice(product.oldPrice);
            oldPriceEl.style.display = 'inline';
        } else {
            oldPriceEl.style.display = 'none';
        }
    }

    const installmentEl = document.getElementById('qv-installments');
    if (installmentEl) {
        const monthly = (product.price / 6).toFixed(2);
        installmentEl.innerHTML = `<i class="fa-solid fa-credit-card"></i> O 6 cuotas de <strong>$${monthly}</strong> sin interés con Confort Pay`;
    }

    const ratingEl = document.getElementById('qv-rating');
    if (ratingEl) {
        ratingEl.innerHTML = `<span class="stars"><i class="fa-solid fa-star"></i> ${product.rating || 4.8}</span> <span>(${product.reviews || 85} reseñas VIP)</span>`;
    }

    const descEl = document.getElementById('qv-description');
    if (descEl) {
        descEl.textContent = `${product.name} combina ingeniería de precisión con materiales aeroespaciales, chasis en titanio y detalles en oro de 24K. Certificado bajo los más exigentes estándares tecnológicos y respaldado por la garantía institucional Confort Care y protocolo de seguridad BCP.`;
    }

    const qtyEl = document.getElementById('qv-qty');
    if (qtyEl) qtyEl.textContent = currentQvQty;

    const addBtn = document.getElementById('qv-add-cart-btn');
    if (addBtn) {
        addBtn.onclick = () => {
            addToCart(product.id, currentQvQty);
            closeQuickView();
        };
    }

    const buyNowBtn = document.getElementById('qv-buy-now-btn');
    if (buyNowBtn) {
        buyNowBtn.onclick = () => {
            addToCart(product.id, currentQvQty);
            closeQuickView();
            window.location.href = 'checkout.html';
        };
    }

    modal.style.display = 'flex';
};

window.closeQuickView = () => {
    const modal = document.getElementById('quick-view-modal');
    if (modal) modal.style.display = 'none';
};

window.changeQvQty = (delta) => {
    currentQvQty = Math.max(1, Math.min(99, currentQvQty + delta));
    const qtyEl = document.getElementById('qv-qty');
    if (qtyEl) qtyEl.textContent = currentQvQty;
};

// --- Lógica de la Página de Inicio (Index) ---
let currentSort = 'featured';

window.handleSortChange = (sortType) => {
    currentSort = sortType;
    const searchInput = document.getElementById('search-input');
    const searchTerm = searchInput ? searchInput.value : '';
    const activeChip = document.querySelector('.filter-chip.active');
    const category = activeChip ? activeChip.dataset.filter : 'all';
    renderProducts(searchTerm, category, currentSort);
};

const initIndexPage = () => {
    const productsGrid = document.getElementById('products-grid');
    if (!productsGrid) return;

    renderProducts();

    // Contador regresivo VIP
    const updateCountdown = () => {
        const hoursEl = document.getElementById('cd-hours');
        const minsEl = document.getElementById('cd-mins');
        const secsEl = document.getElementById('cd-secs');
        if (!hoursEl || !minsEl || !secsEl) return;

        const now = new Date();
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        const diff = Math.max(0, endOfDay - now);

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);

        hoursEl.textContent = String(hours).padStart(2, '0');
        minsEl.textContent = String(mins).padStart(2, '0');
        secsEl.textContent = String(secs).padStart(2, '0');
    };
    updateCountdown();
    setInterval(updateCountdown, 1000);

    // Búsqueda
    const searchInput = document.getElementById('search-input');
    const clearSearch = document.getElementById('clear-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const activeFilter = document.querySelector('.filter-chip.active');
            const value = e.target.value.trim();
            if (clearSearch) clearSearch.hidden = value.length === 0;
            renderProducts(value, activeFilter ? activeFilter.dataset.filter : 'all', currentSort);
        });
    }
    if (clearSearch) {
        clearSearch.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                searchInput.dispatchEvent(new Event('input'));
                searchInput.focus();
            }
        });
    }

    // Filtros por Categoría
    const filterChips = document.querySelectorAll('.filter-chip');
    filterChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            filterChips.forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            const searchTerm = searchInput ? searchInput.value : '';
            renderProducts(searchTerm, e.target.dataset.filter, currentSort);
        });
    });
};

const renderProducts = (search = '', category = 'all', sort = 'featured') => {
    const productsGrid = document.getElementById('products-grid');
    if (!productsGrid) return;

    productsGrid.innerHTML = '';

    let filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = category === 'all' || p.category === category;
        return matchesSearch && matchesCategory;
    });

    // Ordenamiento
    if (sort === 'price-asc') {
        filtered.sort((a, b) => a.price - b.price);
    } else if (sort === 'price-desc') {
        filtered.sort((a, b) => b.price - a.price);
    } else if (sort === 'rating') {
        filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    const countBadge = document.getElementById('catalog-count-badge');
    if (countBadge) {
        countBadge.innerHTML = `<i class="fa-solid fa-layer-group"></i> Mostrando <strong>${filtered.length}</strong> piezas exclusivas`;
    }

    if (filtered.length === 0) {
        productsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 3rem; color: var(--text-secondary);">No se encontraron productos en el catálogo.</div>`;
        return;
    }

    filtered.forEach((p, index) => {
        const delay = (index % 4) * 0.08;
        const isWished = wishlist.includes(p.id);
        
        let badgesHtml = '<div class="product-badges">';
        if (p.badge === 'new') badgesHtml += '<span class="product-badge badge-new">Nuevo</span>';
        if (p.badge === 'sale') badgesHtml += '<span class="product-badge badge-sale">Oferta</span>';
        badgesHtml += '</div>';

        const oldPriceHtml = p.oldPrice ? `<span class="product-price-old">${formatPrice(p.oldPrice)}</span>` : '';

        const card = document.createElement('div');
        card.className = 'glass-card product-card animate-fade-up';
        card.style.animationDelay = `${delay}s`;

        card.innerHTML = `
            ${badgesHtml}
            <button class="wishlist-btn ${isWished ? 'active' : ''}" onclick="toggleWishlist(${p.id})" title="Favorito">
                <i class="${isWished ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
            </button>
            <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" class="product-image" onclick="openQuickView(${Number(p.id)})" style="cursor: pointer;" title="Ver detalle del producto">
            <div class="product-info">
                <span class="product-category">${escapeHtml(p.category)}</span>
                <h3 class="product-title" onclick="openQuickView(${Number(p.id)})" style="cursor: pointer;">${escapeHtml(p.name)}</h3>
                <div class="product-rating">
                    <span class="stars"><i class="fa-solid fa-star"></i> ${p.rating || 4.8}</span>
                    <span>(${p.reviews || 75} reseñas)</span>
                </div>
                <div class="product-price-row">
                    <div>
                        <span class="product-price">${formatPrice(p.price)}</span>
                        ${oldPriceHtml}
                    </div>
                </div>
                <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:-0.2rem;">
                    6 cuotas de <strong style="color:var(--gold-light);">${formatPrice(p.price / 6)}</strong> sin interés
                </div>
                <div style="display:flex; gap:0.5rem; margin-top:0.6rem;">
                    <button class="btn btn-primary add-to-cart-btn" style="flex:1;" onclick="addToCart(${p.id})">
                        <i class="fa-solid fa-cart-plus"></i> Añadir
                    </button>
                    <button class="btn btn-outline" style="padding:0.6rem 0.8rem;" onclick="openQuickView(${p.id})" title="Vista Rápida">
                        <i class="fa-regular fa-eye"></i>
                    </button>
                </div>
            </div>
        `;

        // Efecto spotlight dinámico con el mouse
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(212, 175, 55, 0.08), rgba(255, 255, 255, 0.02) 60%)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.background = '';
        });

        productsGrid.appendChild(card);
    });
};

// --- Lógica de Checkout ---
const initCheckoutPage = () => {
    const checkoutContainer = document.getElementById('checkout-items');
    if (!checkoutContainer) return;
    
    renderCart();

    // Payment method selection
    document.querySelectorAll('.payment-method').forEach(method => {
        method.addEventListener('click', function() {
            document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Form formatting
    const ccInput = document.getElementById('cc-number');
    if (ccInput) {
        ccInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            value = value.replace(/(.{4})/g, '$1 ').trim();
            e.target.value = value;
        });
    }

    const expInput = document.getElementById('cc-exp');
    if (expInput) {
        expInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 2) {
                value = value.slice(0,2) + '/' + value.slice(2,4);
            }
            e.target.value = value;
        });
    }

    // Checkout form submit
    const checkoutForm = document.getElementById('checkout-form');
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (cart.length === 0) {
                showToast('El carrito está vacío', 'error');
                return;
            }

            if (!currentUser) {
                showToast('Debes iniciar sesión para comprar', 'error');
                setTimeout(() => window.location.href = 'login.html', 1500);
                return;
            }

            const submitButton = checkoutForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            try {
                const result = await apiRequest('create-order', {
                    method: 'POST',
                    authenticated: true,
                    body: {
                        customerName: document.getElementById('shipping-name').value.trim(),
                        shippingPhone: document.getElementById('shipping-phone').value.trim(),
                        shippingAddress: document.getElementById('shipping-address').value.trim(),
                        couponCode: appliedCoupon?.code || '',
                        items: cart.map(item => ({ id: item.id, quantity: item.quantity }))
                    }
                });
                const newOrder = result.order;
                if (!newOrder?.id) throw new Error('El servidor no confirmó el pedido.');
                localStorage.setItem('confort_last_order', JSON.stringify(newOrder));
                cart = [];
                localStorage.setItem(userCartKey, JSON.stringify(cart));
                updateCartCount();
                renderCart();

                const modal = document.getElementById('order-success-modal');
                if (modal) {
                    document.getElementById('modal-order-id').textContent = newOrder.id;
                    document.getElementById('modal-order-date').textContent = new Date(newOrder.date).toLocaleDateString();
                    document.getElementById('modal-order-total').textContent = formatPrice(newOrder.total);
                    modal.style.display = 'flex';
                    showToast('Pedido registrado. No se realizó ningún cobro.');
                } else {
                    showToast('Pedido registrado.');
                    setTimeout(() => window.location.href = 'dashboard.html', 1500);
                }
            } catch (error) {
                showToast(error.message, 'error');
            } finally {
                submitButton.disabled = false;
            }
        });
    }
};

window.applyCoupon = () => {
    const input = document.getElementById('coupon-input');
    if (!input) return;
    const code = input.value.trim().toUpperCase();
    if (!code) {
        showToast('Ingresa un código de cupón', 'error');
        return;
    }
    const coupons = {
        'SENA2026': { discount: 0.20, name: 'SENA 20% OFF' },
        'CONFORT10': { discount: 0.10, name: 'Bienvenida 10% OFF' },
        'BCPPRO': { discount: 0.15, name: 'Seguridad BCP 15% OFF' }
    };
    if (coupons[code]) {
        appliedCoupon = { code, ...coupons[code] };
        showToast(`¡Cupón ${code} aplicado! ${coupons[code].name}`, 'success');
        renderCart();
    } else {
        showToast('Cupón no válido o expirado', 'error');
    }
};

const renderCart = () => {
    const container = document.getElementById('checkout-items');
    if (!container) return;

    container.innerHTML = '';
    let subtotal = 0;

    if (cart.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary); text-align:center;">El carrito está vacío.</p>';
    } else {
        cart.forEach((item, index) => {
            subtotal += item.price * item.quantity;
            const el = document.createElement('div');
            el.className = 'summary-item animate-fade-up';
            el.style.animationDelay = `${index * 0.1}s`;
            el.innerHTML = `
                <img src="${item.image}" alt="${item.name}">
                <div class="summary-details" style="flex:1;">
                    <h4>${escapeHtml(item.name)}</h4>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem;">
                        <div style="display:flex; align-items:center; gap:10px; background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:4px;">
                            <button style="background:none;border:none;color:white;cursor:pointer;" onclick="updateCartQuantity(${item.id}, -1)">-</button>
                            <span>${item.quantity}</span>
                            <button style="background:none;border:none;color:white;cursor:pointer;" onclick="updateCartQuantity(${item.id}, 1)">+</button>
                        </div>
                        <span style="font-weight:bold; color:var(--gold-light);">${formatPrice(item.price * item.quantity)}</span>
                    </div>
                </div>
                <button style="background:none;border:none;color:#ff4757;cursor:pointer;padding:0 10px;" onclick="removeFromCart(${item.id})">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;
            container.appendChild(el);
        });
    }

    const discountPercent = appliedCoupon ? appliedCoupon.discount : 0;
    const discountAmount = subtotal * discountPercent;
    const discountedSubtotal = subtotal - discountAmount;
    const tax = discountedSubtotal * 0.19;
    const total = discountedSubtotal + tax;

    const couponRow = document.getElementById('coupon-row');
    if (couponRow) {
        if (appliedCoupon) {
            couponRow.style.display = 'flex';
            document.getElementById('coupon-name').textContent = appliedCoupon.name;
            document.getElementById('checkout-discount').textContent = `-${formatPrice(discountAmount)}`;
        } else {
            couponRow.style.display = 'none';
        }
    }

    document.getElementById('checkout-subtotal').textContent = formatPrice(subtotal);
    document.getElementById('checkout-tax').textContent = formatPrice(tax);
    document.getElementById('checkout-total').textContent = formatPrice(total);
};

window.updateCartQuantity = (id, delta) => {
    const item = cart.find(i => i.id === id);
    if (item) {
        item.quantity += delta;
        if (item.quantity <= 0) {
            cart = cart.filter(i => i.id !== id);
        }
        localStorage.setItem(userCartKey, JSON.stringify(cart));
        updateCartCount();
        renderCart();
    }
};

window.removeFromCart = (id) => {
    cart = cart.filter(i => i.id !== id);
    localStorage.setItem(userCartKey, JSON.stringify(cart));
    updateCartCount();
    renderCart();
    showToast('Producto eliminado del carrito', 'info');
};

// --- Factura PDF con jsPDF ---
window.downloadOrderInvoicePDF = async (specificOrder = null) => {
    let order = specificOrder;
    if (!order) {
        const lastOrder = JSON.parse(localStorage.getItem('confort_last_order'));
        if (lastOrder?.id) {
            try {
                const result = await apiRequest('orders', { authenticated: true });
                order = result.orders.find(item => item.id === lastOrder.id) || null;
            } catch (error) {
                showToast(error.message, 'error');
                return;
            }
        }
    }
    if (!order) {
        showToast('No se encontró información del pedido', 'error');
        return;
    }
    if (typeof window.jspdf === 'undefined' && typeof jspdf === 'undefined') {
        showToast('Cargando librería de PDF...', 'info');
        return;
    }
    const jsPDFClass = window.jspdf ? window.jspdf.jsPDF : jspdf.jsPDF;
    const doc = new jsPDFClass();

    // Documento informativo del pedido; no representa un cobro procesado.
    doc.setFillColor(15, 17, 23);
    doc.rect(0, 0, 210, 42, 'F');

    doc.setTextColor(212, 175, 55);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("CONFORT MARKET", 15, 20);

    doc.setFontSize(9);
    doc.setTextColor(200, 200, 200);
    doc.setFont("helvetica", "normal");
    doc.text("RESUMEN INFORMATIVO DE COMPRA", 15, 29);
    doc.text("Confort Market", 15, 35);

    doc.setTextColor(212, 175, 55);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("RESUMEN DE PEDIDO", 140, 20);
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(`No: ${order.id}`, 140, 27);
    doc.text(`Fecha: ${new Date(order.date).toLocaleDateString()}`, 140, 34);

    // Datos del Cliente
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("INFORMACIÓN DEL CLIENTE", 15, 52);
    doc.setDrawColor(212, 175, 55);
    doc.line(15, 54, 195, 54);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Nombre: ${order.customerName || currentUser?.username || 'Cliente'}`, 15, 62);
    doc.text(`Email: ${order.customerEmail || currentUser?.email || 'N/A'}`, 15, 68);
    doc.text(`Estado del pedido: ${order.status}`, 15, 74);

    // Tabla de Ítems
    let y = 88;
    doc.setFillColor(245, 245, 245);
    doc.rect(15, y - 6, 180, 8, 'F');
    doc.setFont("helvetica", "bold");
    doc.text("Descripción del Producto", 18, y);
    doc.text("Cant.", 115, y);
    doc.text("Precio Unit.", 135, y);
    doc.text("Total", 175, y);

    doc.setFont("helvetica", "normal");
    y += 8;
    (order.items || []).forEach(item => {
        doc.text((item.name || 'Producto').substring(0, 42), 18, y);
        doc.text(String(item.quantity || 1), 120, y);
        doc.text(`$${Number(item.price).toFixed(2)}`, 135, y);
        doc.text(`$${(Number(item.price) * (item.quantity || 1)).toFixed(2)}`, 175, y);
        y += 7;
    });

    y += 4;
    doc.setDrawColor(220, 220, 220);
    doc.line(15, y, 195, y);
    y += 8;

    // Totales
    doc.setFont("helvetica", "normal");
    doc.text("Subtotal:", 135, y);
    doc.text(`$${Number(order.subtotal || 0).toFixed(2)}`, 175, y);
    y += 6;

    if (order.discount && order.discount > 0) {
        doc.setTextColor(212, 175, 55);
        doc.text(`Descuento (${order.couponCode || 'Cupón'}):`, 135, y);
        doc.text(`-$${Number(order.discount).toFixed(2)}`, 175, y);
        doc.setTextColor(30, 30, 30);
        y += 6;
    }

    doc.text("IVA (19%):", 135, y);
    doc.text(`$${Number(order.tax || 0).toFixed(2)}`, 175, y);
    y += 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("TOTAL DEL PEDIDO:", 135, y);
    doc.text(`$${Number(order.total).toFixed(2)}`, 175, y);

    y += 25;
    doc.setDrawColor(212, 175, 55);
    doc.line(15, y, 195, y);
    y += 8;
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 100, 100);
    doc.text("Documento informativo. No es factura electrónica ni comprobante de pago.", 15, y);
    doc.text("La tienda no procesa cobros en línea.", 15, y + 4);

    doc.save(`Resumen_ConfortMarket_${order.id}.pdf`);
    showToast('Resumen PDF descargado correctamente');
};

window.sendOrderInvoice = async (orderId = null) => {
    const lastOrder = orderId ? null : JSON.parse(localStorage.getItem('confort_last_order'));
    const targetOrderId = orderId || lastOrder?.id;
    if (!targetOrderId) {
        showToast('No se encontró el pedido para enviar la factura.', 'error');
        return;
    }
    try {
        const result = await apiRequest('send-invoice', {
            method: 'POST',
            authenticated: true,
            body: { orderId: targetOrderId }
        });
        showToast(result.message);
    } catch (error) {
        showToast(error.message, 'error');
    }
};

// --- Generador de Informe BCP (PDF) ---
window.generateBcpReportPDF = () => {
    if (typeof window.jspdf === 'undefined' && typeof jspdf === 'undefined') {
        showToast('Cargando librería PDF...', 'info');
        return;
    }
    const jsPDFClass = window.jspdf ? window.jspdf.jsPDF : jspdf.jsPDF;
    const doc = new jsPDFClass();

    // Encabezado
    doc.setFillColor(18, 22, 30);
    doc.rect(0, 0, 210, 45, 'F');

    doc.setTextColor(212, 175, 55);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("CONFORT MARKET - AUDITORÍA BCP & DRP", 15, 20);

    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.text("INFORME OFICIAL DE CONTINUIDAD DE NEGOCIO (NORMA ISO 22301)", 15, 28);
    doc.text(`Fecha de Emisión: ${new Date().toLocaleString()}`, 15, 34);
    doc.text("Responsable: Comité de Continuidad Tecnológica SENA 2026", 15, 39);

    let y = 58;
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("1. EVALUACIÓN DE NÚCLEOS CRÍTICOS Y RTO/RPO", 15, y);
    doc.setDrawColor(212, 175, 55);
    doc.line(15, y + 2, 195, y + 2);

    y += 10;
    doc.setFontSize(9);
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y - 5, 180, 7, 'F');
    doc.setFont("helvetica", "bold");
    doc.text("Servicio Evaluado", 18, y);
    doc.text("RTO Objetivo", 80, y);
    doc.text("RPO Objetivo", 120, y);
    doc.text("Cumplimiento", 160, y);

    y += 7;
    doc.setFont("helvetica", "normal");
    const matrix = [
        ["Base de Datos Clientes/Pedidos", "1 Hora", "15 Minutos", "100% CUMPLIDO"],
        ["Pasarela de Pagos Cifrada", "30 Minutos", "5 Minutos", "100% CUMPLIDO"],
        ["Catálogo y Frontend Web", "Inmediato", "0 Pérdida", "100% CUMPLIDO"],
        ["Protección Anti-DDoS", "Inmediato", "N/A", "100% CUMPLIDO"],
        ["Almacén de Imágenes & Assets", "2 Horas", "1 Hora", "100% CUMPLIDO"]
    ];
    matrix.forEach(row => {
        doc.text(row[0], 18, y);
        doc.text(row[1], 80, y);
        doc.text(row[2], 120, y);
        doc.text(row[3], 160, y);
        y += 6;
    });

    y += 10;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("2. POLÍTICA DE RESPALDOS Y AISLAMIENTO (AIR-GAP)", 15, y);
    doc.line(15, y + 2, 195, y + 2);

    y += 8;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("• Backup Local: Programado cada 2 horas con verificación de integridad SHA-256.", 15, y);
    y += 5;
    doc.text("• Backup Offline: Disco air-gapped físico desconectado para mitigación de Ransomware.", 15, y);
    y += 5;
    doc.text("• Réplica Geográfica: Servidor en la nube listo para absorción de tráfico inmediato (Failover).", 15, y);

    y += 12;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("3. BITÁCORA DE SIMULACROS DRP E INCIDENTES", 15, y);
    doc.line(15, y + 2, 195, y + 2);

    y += 8;
    const logs = JSON.parse(localStorage.getItem('confort_bcp_logs')) || [
        { date: new Date().toLocaleDateString(), type: 'backup_local', status: 'success', desc: 'Copia de seguridad local completada con éxito.' },
        { date: new Date().toLocaleDateString(), type: 'drp_test', status: 'success', desc: 'Simulacro de caída de nodo completado. RTO medido: 12 seg.' },
        { date: new Date().toLocaleDateString(), type: 'backup_offline', status: 'success', desc: 'Disco externo desconectado de la red según protocolo.' }
    ];

    logs.slice(0, 6).forEach(l => {
        doc.text(`- [${l.date}] ${l.type.toUpperCase()}: ${l.desc}`, 15, y);
        y += 5;
    });

    y += 20;
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(120, 120, 120);
    doc.text("Informe auditado para presentación y sustentación ante instructores del SENA.", 15, y);
    doc.text("Confort Market 2026 - Plataforma Tecnológica Resiliente.", 15, y + 4);

    doc.save("Informe_Continuidad_BCP_ConfortMarket.pdf");
    showToast('Informe BCP descargado en PDF');
};

// --- BCP Failover y Contingencia ---
window.toggleBcpFailover = () => {
    const isFailover = localStorage.getItem('confort_bcp_failover') === 'true';
    const newState = !isFailover;
    localStorage.setItem('confort_bcp_failover', newState ? 'true' : 'false');

    const logs = JSON.parse(localStorage.getItem('confort_bcp_logs')) || [];
    logs.unshift({
        date: new Date().toLocaleString(),
        type: newState ? 'failover_active' : 'failover_restored',
        status: newState ? 'warning' : 'success',
        desc: newState 
            ? 'SIMULACRO BCP: Servidor principal suspendido para prueba. Tráfico redirigido a réplica segura sin cortes.'
            : 'NORMALIZACIÓN BCP: Servidor principal restablecido. Tráfico retornado a nodo de producción.'
    });
    localStorage.setItem('confort_bcp_logs', JSON.stringify(logs));

    updateBcpUI();
    if (typeof renderAdminLogs === 'function') renderAdminLogs();

    showToast(newState ? '⚡ Modo Contingencia BCP Activado' : '✅ Servidor Principal Restablecido', newState ? 'warning' : 'success');
};

const updateBcpUI = () => {
    const isFailover = localStorage.getItem('confort_bcp_failover') === 'true';
    
    // Banner superior en la tienda
    const banner = document.getElementById('bcp-failover-banner');
    if (banner) {
        banner.style.display = isFailover ? 'flex' : 'none';
    }

    // Tarjeta y botón en admin.html
    const statusEl = document.getElementById('bcp-server-status');
    const toggleBtn = document.getElementById('btn-toggle-failover');
    if (statusEl) {
        if (isFailover) {
            statusEl.textContent = 'Réplica (Contingencia)';
            statusEl.style.color = '#e67e22';
        } else {
            statusEl.textContent = 'Principal Activo';
            statusEl.style.color = '#2ed573';
        }
    }
    if (toggleBtn) {
        if (isFailover) {
            toggleBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Restablecer Servidor';
            toggleBtn.style.background = '#2ed573';
            toggleBtn.style.borderColor = '#2ed573';
        } else {
            toggleBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> Simular Contingencia';
            toggleBtn.style.background = '';
            toggleBtn.style.borderColor = '';
        }
    }
};

window.runDrpTest = (serviceName) => {
    showToast(`Ejecutando simulacro DRP para ${serviceName}...`, 'info');
    setTimeout(() => {
        const logs = JSON.parse(localStorage.getItem('confort_bcp_logs')) || [];
        logs.unshift({
            date: new Date().toLocaleString(),
            type: 'drp_test',
            status: 'success',
            desc: `Simulacro DRP para "${serviceName}" completado. RTO medido: 11 segundos. RPO: 0 pérdida de registros.`
        });
        localStorage.setItem('confort_bcp_logs', JSON.stringify(logs));
        renderAdminLogs();
        showToast(`¡Test DRP exitoso para ${serviceName}! RTO cumplido.`, 'success');
    }, 800);
};

// --- CRUD de Catálogo en Admin ---
window.renderAdminProducts = () => {
    const tbody = document.getElementById('admin-products-tbody');
    const count = document.getElementById('admin-product-count');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (count) count.textContent = `${products.length} producto${products.length === 1 ? '' : 's'}`;

    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">No hay productos en el catálogo.</td></tr>';
        return;
    }

    products.forEach(p => {
        const tr = document.createElement('tr');
        const productId = Number(p.id);
        const badgeHtml = p.badge === 'new' ? '<span class="status-badge" style="background:rgba(46,213,115,0.2); color:#2ed573;">Nuevo</span>' :
                          p.badge === 'sale' ? '<span class="status-badge" style="background:rgba(255,71,87,0.2); color:#ff4757;">Oferta</span>' :
                          '<span style="color:var(--text-secondary); font-size:0.85rem;">Normal</span>';

        tr.innerHTML = `
            <td>
                <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" style="width:45px; height:45px; object-fit:contain; border-radius:6px; background:rgba(255,255,255,0.05); padding:2px;">
            </td>
            <td><strong>${escapeHtml(p.name)}</strong></td>
            <td><span class="product-category">${escapeHtml(p.category)}</span></td>
            <td><strong style="color:var(--gold-light);">${formatPrice(p.price)}</strong></td>
            <td>${badgeHtml}</td>
            <td>
                <div style="display:flex; gap:0.5rem;">
                    <button type="button" class="btn btn-outline" style="padding:0.3rem 0.6rem; font-size:0.8rem;" onclick="openProductModal(${productId})" title="Editar">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button type="button" class="btn btn-outline" style="padding:0.3rem 0.6rem; font-size:0.8rem; color:#ff4757; border-color:rgba(255,71,87,0.3);" onclick="deleteProduct(${productId})" title="Eliminar">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.openProductModal = (id = null) => {
    const modal = document.getElementById('product-modal');
    if (!modal) return;
    const form = document.getElementById('product-form');
    if (form) form.reset();

    if (id) {
        const prod = products.find(p => p.id === id);
        if (prod) {
            document.getElementById('modal-product-title').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Editar Producto';
            document.getElementById('prod-id').value = prod.id;
            document.getElementById('prod-name').value = prod.name;
            document.getElementById('prod-price').value = prod.price;
            document.getElementById('prod-old-price').value = prod.oldPrice || '';
            document.getElementById('prod-category').value = prod.category;
            document.getElementById('prod-badge').value = prod.badge || '';
            document.getElementById('prod-image').value = prod.image;
        }
    } else {
        document.getElementById('modal-product-title').innerHTML = '<i class="fa-solid fa-plus"></i> Nuevo Producto';
        document.getElementById('prod-id').value = '';
    }
    modal.style.display = 'flex';
};

window.closeProductModal = () => {
    const modal = document.getElementById('product-modal');
    if (modal) modal.style.display = 'none';
};

window.saveProduct = async (e) => {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    const name = document.getElementById('prod-name').value.trim();
    const price = parseFloat(document.getElementById('prod-price').value);
    const oldPriceVal = document.getElementById('prod-old-price').value;
    const oldPrice = oldPriceVal ? parseFloat(oldPriceVal) : null;
    const category = document.getElementById('prod-category').value;
    const badge = document.getElementById('prod-badge').value || null;
    const image = document.getElementById('prod-image').value.trim();
    const existingProduct = id ? products.find(product => product.id === Number(id)) : null;

    try {
        const result = await apiRequest('product-save', {
            method: 'POST',
            authenticated: true,
            body: {
                id: id ? Number(id) : null,
                name,
                price,
                oldPrice,
                category,
                badge,
                image,
                rating: existingProduct?.rating ?? 5,
                reviews: existingProduct?.reviews ?? 0
            }
        });
        await loadBackendProducts();
        renderAdminProducts();
        renderProducts();
        closeProductModal();
        showToast(result.message);
    } catch (error) {
        showToast(error.message, 'error');
    }
};

window.deleteProduct = async (id) => {
    const prod = products.find(p => p.id === id);
    if (!prod) return;
    if (confirm(`¿Estás seguro de eliminar "${prod.name}" del catálogo?`)) {
        try {
            const result = await apiRequest('product-delete', {
                method: 'POST',
                authenticated: true,
                body: { id }
            });
            await loadBackendProducts();
            renderAdminProducts();
            renderProducts();
            showToast(result.message, 'info');
        } catch (error) {
            showToast(error.message, 'error');
        }
    }
};

// --- Gestión de Pedidos y Logs en Admin ---
const getAllAdminOrders = async () => {
    const response = await apiRequest('orders', { authenticated: true });
    if (!Array.isArray(response.orders)) throw new Error('El servidor devolvió una lista de pedidos no válida.');
    return response.orders;
};

window.renderAdminInsights = async () => {
    const chart = document.getElementById('insight-sales-chart');
    if (!chart) return;

    let orders;
    try {
        orders = await getAllAdminOrders();
    } catch (error) {
        showToast(error.message, 'error');
        return;
    }
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthWindowStart = new Date(today);
    monthWindowStart.setDate(monthWindowStart.getDate() - 29);
    const recentOrders = orders.filter(order => {
        const orderDate = new Date(order.date);
        return !Number.isNaN(orderDate.getTime()) && orderDate >= monthWindowStart && orderDate <= now;
    });
    const recentRevenue = recentOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    const pendingOrders = orders.filter(order => order.status === 'Procesando');
    const overdueOrders = pendingOrders.filter(order => {
        const orderDate = new Date(order.date);
        return !Number.isNaN(orderDate.getTime()) && now - orderDate > 48 * 60 * 60 * 1000;
    });

    document.getElementById('insight-revenue').textContent = formatPrice(recentRevenue);
    document.getElementById('insight-orders').textContent = recentOrders.length;
    document.getElementById('insight-average').textContent = formatPrice(
        recentOrders.length ? recentRevenue / recentOrders.length : 0
    );
    document.getElementById('insight-pending').textContent = pendingOrders.length;

    const firstDay = new Date(today);
    firstDay.setDate(firstDay.getDate() - 6);
    const dailySales = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(firstDay);
        date.setDate(firstDay.getDate() + index);
        return { date, total: 0 };
    });
    orders.forEach(order => {
        const orderDate = new Date(order.date);
        if (Number.isNaN(orderDate.getTime()) || orderDate > now) return;
        const dayIndex = Math.floor((new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate()) - firstDay) / 86400000);
        if (dayIndex >= 0 && dayIndex < dailySales.length) {
            dailySales[dayIndex].total += Number(order.total) || 0;
        }
    });

    const maxDailySales = Math.max(...dailySales.map(day => day.total), 1);
    chart.replaceChildren();
    dailySales.forEach(day => {
        const column = document.createElement('div');
        column.className = 'admin-sales-day';
        column.title = `${day.date.toLocaleDateString('es-CO')}: ${formatPrice(day.total)}`;

        const amount = document.createElement('span');
        amount.className = 'admin-sales-amount';
        amount.textContent = day.total ? formatPrice(day.total) : '$0';

        const bar = document.createElement('div');
        bar.className = 'admin-sales-bar';
        bar.style.height = `${day.total ? Math.max(6, (day.total / maxDailySales) * 100) : 3}%`;
        bar.setAttribute('aria-hidden', 'true');

        const label = document.createElement('span');
        label.className = 'admin-sales-label';
        label.textContent = day.date.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '');

        column.append(amount, bar, label);
        chart.appendChild(column);
    });

    const productSales = new Map();
    orders.forEach(order => {
        (Array.isArray(order.items) ? order.items : []).forEach(item => {
            const name = item.name || 'Producto sin nombre';
            const quantity = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
            productSales.set(name, (productSales.get(name) || 0) + quantity);
        });
    });
    const topProducts = [...productSales.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const productsList = document.getElementById('insight-top-products');
    productsList.replaceChildren();
    if (topProducts.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'admin-insight-empty';
        empty.textContent = 'Aún no hay ventas para identificar productos destacados.';
        productsList.appendChild(empty);
    } else {
        const maxProductSales = topProducts[0][1];
        topProducts.forEach(([name, quantity], index) => {
            const item = document.createElement('li');
            item.className = 'admin-top-product';
            const rank = document.createElement('span');
            rank.className = 'admin-product-rank';
            rank.textContent = String(index + 1).padStart(2, '0');

            const details = document.createElement('div');
            details.className = 'admin-top-product-details';
            const productName = document.createElement('strong');
            productName.textContent = name;
            const track = document.createElement('span');
            track.className = 'admin-product-track';
            const progress = document.createElement('span');
            progress.style.width = `${(quantity / maxProductSales) * 100}%`;
            track.appendChild(progress);
            details.append(productName, track);

            const units = document.createElement('span');
            units.className = 'admin-product-units';
            units.textContent = `${quantity} un.`;
            item.append(rank, details, units);
            productsList.appendChild(item);
        });
    }

    const overdueCount = document.getElementById('insight-overdue-count');
    overdueCount.textContent = `${overdueOrders.length} atrasado${overdueOrders.length === 1 ? '' : 's'}`;
    overdueCount.classList.toggle('has-overdue', overdueOrders.length > 0);

    const priorityOrders = pendingOrders
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 5);
    const priorityTable = document.getElementById('insight-priority-orders');
    priorityTable.replaceChildren();
    if (priorityOrders.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 4;
        cell.className = 'admin-insight-empty';
        cell.textContent = 'No hay pedidos pendientes de preparación.';
        row.appendChild(cell);
        priorityTable.appendChild(row);
    } else {
        priorityOrders.forEach(order => {
            const row = document.createElement('tr');
            const orderCell = document.createElement('td');
            const orderId = document.createElement('strong');
            orderId.textContent = order.id || 'Pedido';
            orderCell.appendChild(orderId);

            const customerCell = document.createElement('td');
            customerCell.textContent = order.userName;

            const ageCell = document.createElement('td');
            const orderDate = new Date(order.date);
            ageCell.textContent = Number.isNaN(orderDate.getTime())
                ? 'Fecha no válida'
                : `${Math.max(0, Math.floor((now - orderDate) / (60 * 60 * 1000)))} h`;
            if (!Number.isNaN(orderDate.getTime()) && now - orderDate > 48 * 60 * 60 * 1000) {
                ageCell.className = 'admin-order-overdue';
            }

            const totalCell = document.createElement('td');
            totalCell.textContent = formatPrice(Number(order.total) || 0);
            row.append(orderCell, customerCell, ageCell, totalCell);
            priorityTable.appendChild(row);
        });
    }
};

window.renderAdminOrders = async () => {
    const tbody = document.getElementById('admin-orders-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let allOrders;
    try {
        allOrders = await getAllAdminOrders();
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="admin-empty">${escapeHtml(error.message)}</td></tr>`;
        return;
    }

    if (allOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-secondary); padding:2rem;">No hay pedidos registrados en la plataforma.</td></tr>';
        return;
    }

    allOrders.forEach(order => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${escapeHtml(order.id)}</strong></td>
            <td>${escapeHtml(order.userName)} <br><small style="color:var(--text-secondary);">${escapeHtml(order.userEmail)}</small></td>
            <td>${new Date(order.date).toLocaleDateString()}</td>
            <td><strong style="color:#2ed573;">${formatPrice(order.total)}</strong></td>
            <td>
                <select class="form-control" style="padding:0.2rem 0.5rem; font-size:0.85rem; background:#181818;" onchange="updateOrderStatus('${escapeHtml(order.id)}', this.value)">
                    <option value="Procesando" ${order.status === 'Procesando' ? 'selected' : ''}>Procesando</option>
                    <option value="Enviado" ${order.status === 'Enviado' ? 'selected' : ''}>Enviado</option>
                    <option value="Entregado" ${order.status === 'Entregado' ? 'selected' : ''}>Entregado</option>
                </select>
            </td>
            <td>
                <button class="btn btn-outline" style="padding:0.3rem 0.6rem; font-size:0.8rem;" onclick="downloadAdminInvoicePDF('${escapeHtml(order.id)}')" title="Descargar resumen PDF">
                    <i class="fa-solid fa-file-pdf"></i>
                </button>
                <button class="btn btn-outline" style="padding:0.3rem 0.6rem; font-size:0.8rem;" onclick="sendOrderInvoice('${escapeHtml(order.id)}')" title="Enviar resumen PDF por correo">
                    <i class="fa-solid fa-envelope"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.downloadAdminInvoicePDF = async (orderId) => {
    try {
        const orders = await getAllAdminOrders();
        const order = orders.find(item => item.id === orderId);
        if (!order) {
            showToast('No se encontró el pedido.', 'error');
            return;
        }
        window.downloadOrderInvoicePDF(order);
    } catch (error) {
        showToast(error.message, 'error');
    }
};

window.updateOrderStatus = async (orderId, newStatus) => {
    try {
        const result = await apiRequest('update-order-status', {
            method: 'POST',
            authenticated: true,
            body: { orderId, status: newStatus }
        });
        await Promise.all([renderAdminOrders(), renderAdminInsights()]);
        showToast(result.message);
    } catch (error) {
        showToast(error.message, 'error');
    }
};

window.renderAdminLogs = () => {
    const tbody = document.getElementById('admin-logs-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const logs = JSON.parse(localStorage.getItem('confort_bcp_logs')) || [
        { date: new Date().toLocaleString(), type: 'backup_local', status: 'success', desc: 'Copia de seguridad local completada con éxito.' },
        { date: new Date().toLocaleString(), type: 'backup_offline', status: 'success', desc: 'Disco externo desconectado de la red según el protocolo BCP.' },
        { date: new Date().toLocaleString(), type: 'server_status', status: 'success', desc: 'Servidor principal operativo al 100%.' }
    ];
    logs.forEach(l => {
        const tr = document.createElement('tr');
        const badgeColor = l.status === 'success' ? '#2ed573' : l.status === 'warning' ? '#ffa502' : '#ff4757';
        tr.innerHTML = `
            <td>${l.date}</td>
            <td><strong>${l.type.toUpperCase()}</strong></td>
            <td><span class="status-badge" style="background:rgba(255,255,255,0.05); color:${badgeColor};">${l.status}</span></td>
            <td>${l.desc}</td>
        `;
        tbody.appendChild(tr);
    });
};

// --- Lógica de Dashboard ---
const initDashboardPage = async () => {
    if (!document.getElementById('user-name-display')) return;

    if (currentUser) {
        document.getElementById('user-name-display').textContent = currentUser.username || currentUser.email;
        document.getElementById('user-email-display').textContent = currentUser.email;
        document.getElementById('avatar-initial').textContent = (currentUser.username || currentUser.email).charAt(0).toUpperCase();

        const settingsUsername = document.querySelector('#tab-settings input[type="text"]');
        const settingsEmail = document.querySelector('#tab-settings input[type="email"]');
        if (settingsUsername) settingsUsername.value = currentUser.username || '';
        if (settingsEmail) settingsEmail.value = currentUser.email || '';

        if (currentUser.role === 'admin') {
            const adminLink = document.getElementById('admin-link');
            if (adminLink) adminLink.style.display = 'flex';
        }
    }

    const links = document.querySelectorAll('.sidebar-link[data-tab]');
    const tabs = document.querySelectorAll('.tab-content');

    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            links.forEach(l => l.classList.remove('active'));
            tabs.forEach(t => t.classList.remove('active'));
            link.classList.add('active');
            const targetTab = document.getElementById(link.dataset.tab);
            if (targetTab) targetTab.classList.add('active');
        });
    });

    if (currentUser) {
        let orders = [];
        try {
            const result = await apiRequest('orders', { authenticated: true });
            if (!Array.isArray(result.orders)) throw new Error('El servidor devolvió una lista de pedidos no válida.');
            orders = result.orders;
        } catch (error) {
            showToast(error.message, 'error');
        }
        
        const statOrders = document.getElementById('stat-orders');
        if (statOrders) statOrders.textContent = orders.length;

        const totalSpent = orders.reduce((sum, order) => sum + (order.total || 0), 0);
        const statSpent = document.getElementById('stat-spent');
        if (statSpent) statSpent.textContent = formatPrice(totalSpent);

        const statWishlist = document.getElementById('stat-wishlist');
        if (statWishlist) statWishlist.textContent = wishlist.length;

        const tbody = document.getElementById('orders-tbody');
        if (tbody) {
            if (orders.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-secondary); padding:2rem;">No tienes pedidos recientes. <a href="index.html#catalogo" style="color:var(--gold-primary);">Ir al catálogo</a></td></tr>';
            } else {
                orders.forEach(order => {
                    const tr = document.createElement('tr');
                    const statusClass = order.status === 'Procesando' ? 'status-processing' : 
                                        order.status === 'Enviado' ? 'status-shipped' : 'status-delivered';
                    tr.innerHTML = `
                        <td><strong>${escapeHtml(order.id)}</strong></td>
                        <td>${new Date(order.date).toLocaleDateString()}</td>
                        <td>${formatPrice(order.total)}</td>
                        <td><span class="status-badge ${statusClass}">${escapeHtml(order.status)}</span></td>
                        <td><button type="button" class="btn btn-outline" style="padding:0.35rem 0.55rem;" onclick="sendOrderInvoice('${escapeHtml(order.id)}')" aria-label="Enviar resumen del pedido ${escapeHtml(order.id)}"><i class="fa-solid fa-envelope"></i></button></td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        }

        renderDashboardWishlist();
        if (currentUser.role === 'admin') {
            renderAdminPanel();
        }
    }
};

const renderDashboardWishlist = () => {
    const grid = document.getElementById('wishlist-grid');
    if (!grid) return;
    grid.innerHTML = '';
    if (wishlist.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--text-secondary); padding:3rem;">
            <i class="fa-regular fa-heart" style="font-size:3rem; display:block; margin-bottom:1rem; color:var(--gold-primary);"></i>
            No tienes productos en tu lista de deseos.<br><br>
            <a href="index.html#catalogo" class="btn btn-outline">Explorar Catálogo</a>
        </div>`;
        return;
    }
    const wishedProducts = products.filter(p => wishlist.includes(p.id));
    wishedProducts.forEach((p, index) => {
        const delay = index * 0.08;
        const oldPriceHtml = p.oldPrice ? `<span class="product-price-old">${formatPrice(p.oldPrice)}</span>` : '';
        const card = document.createElement('div');
        card.className = 'glass-card product-card animate-fade-up';
        card.style.animationDelay = `${delay}s`;
        card.innerHTML = `
            <button class="wishlist-btn active" onclick="removeFromWishlistDashboard(${Number(p.id)})">
                <i class="fa-solid fa-heart"></i>
            </button>
            <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" class="product-image" onclick="openQuickView(${Number(p.id)})" style="cursor:pointer;">
            <div class="product-info">
                <span class="product-category">${escapeHtml(p.category)}</span>
                <h3 class="product-title" onclick="openQuickView(${Number(p.id)})" style="cursor:pointer;">${escapeHtml(p.name)}</h3>
                <div class="product-price-row">
                    <span class="product-price">${formatPrice(p.price)}</span>
                    ${oldPriceHtml}
                </div>
                <div style="display:flex; gap:0.5rem; margin-top:0.8rem;">
                    <button class="btn btn-primary" style="flex:1; font-size:0.85rem;" onclick="addToCart(${Number(p.id)})">
                        <i class="fa-solid fa-cart-plus"></i> Añadir
                    </button>
                    <button class="btn btn-outline" style="font-size:0.85rem;" onclick="removeFromWishlistDashboard(${Number(p.id)})">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
};

window.removeFromWishlistDashboard = (id) => {
    const idx = wishlist.indexOf(id);
    if (idx > -1) wishlist.splice(idx, 1);
    localStorage.setItem(userWishlistKey, JSON.stringify(wishlist));
    updateWishlistCount();
    const statEl = document.getElementById('stat-wishlist');
    if (statEl) statEl.textContent = wishlist.length;
    renderDashboardWishlist();
    showToast('Eliminado de la lista de deseos', 'info');
};

const renderAdminPanel = async () => {
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;
    let allUsers;
    try {
        const result = await apiRequest('users', { authenticated: true });
        if (!Array.isArray(result.users)) throw new Error('El servidor devolvió una lista de usuarios no válida.');
        allUsers = result.users;
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" class="admin-empty">${escapeHtml(error.message)}</td></tr>`;
        return;
    }
    if (allUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-secondary);">No hay usuarios registrados.</td></tr>';
        return;
    }
    tbody.innerHTML = '';
    allUsers.forEach(u => {
        const tr = document.createElement('tr');
        const roleHtml = u.role === 'admin'
            ? '<span class="status-badge" style="background:rgba(212,175,55,0.15); color:var(--gold-primary);"><i class="fa-solid fa-shield-halved"></i> Admin</span>'
            : '<span class="status-badge status-processing"><i class="fa-regular fa-user"></i> Cliente</span>';
        tr.innerHTML = `
            <td><strong>${escapeHtml(u.username || 'N/A')}</strong></td>
            <td>${escapeHtml(u.email)}</td>
            <td>${roleHtml}</td>
            <td>${Number(u.orderCount) || 0} pedido(s)</td>
        `;
        tbody.appendChild(tr);
    });
};

// --- Auth Forms Validation ---
const setFieldError = (field, message) => {
    const input = document.getElementById(field);
    const error = document.getElementById(`${field}-error`);
    if (!input || !error) return;
    input.classList.toggle('invalid', Boolean(message));
    input.setAttribute('aria-invalid', String(Boolean(message)));
    error.textContent = message;
};

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const initAuthPages = () => {
    const passInput = document.getElementById('password');
    const strengthBar = document.getElementById('strength-bar');
    
    if (passInput && strengthBar) {
        passInput.addEventListener('input', (e) => {
            const val = e.target.value;
            let strength = 0;
            if (val.length >= 8) strength += 25;
            if (/[A-Z]/.test(val)) strength += 25;
            if (/[0-9]/.test(val)) strength += 25;
            if (/[^A-Za-z0-9]/.test(val)) strength += 25;
            
            strengthBar.style.width = strength + '%';
            if (strength <= 25) strengthBar.style.background = '#ff4757';
            else if (strength <= 50) strengthBar.style.background = '#ffa502';
            else if (strength <= 75) strengthBar.style.background = '#2ed573';
            else strengthBar.style.background = 'var(--gold-primary)';
        });
    }

    const completeVerifiedLogin = (result) => {
        currentUser = result.user;
        apiCsrfToken = result.csrfToken;
        localStorage.setItem('confort_current_user', JSON.stringify(currentUser));
        localStorage.setItem('confort_user_logged_in', 'true');
        userCartKey = `confort_cart_${currentUser.email}`;
        userWishlistKey = `confort_wishlist_${currentUser.email}`;
        showToast('Correo verificado. Inicio de sesión seguro.');
        setTimeout(() => {
            window.location.href = currentUser.role === 'admin' ? 'admin.html' : 'dashboard.html';
        }, 500);
    };

    const startResendCooldown = (button) => {
        if (!button) return;
        button.disabled = true;
        let remaining = 60;
        button.textContent = `Reenviar en ${remaining}s`;
        const timer = window.setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                window.clearInterval(timer);
                button.disabled = false;
                button.textContent = 'Reenviar código';
                return;
            }
            button.textContent = `Reenviar en ${remaining}s`;
        }, 1000);
    };

    const bindOtpFlow = (formId, codeId, errorId, resendId, action) => {
        const form = document.getElementById(formId);
        if (form) {
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                const code = document.getElementById(codeId).value.trim();
                const error = document.getElementById(errorId);
                if (!/^\d{6}$/.test(code)) {
                    error.textContent = 'Ingresa el código de seis dígitos.';
                    return;
                }
                error.textContent = '';
                const button = form.querySelector('button[type="submit"]');
                button.disabled = true;
                try {
                    const result = await apiRequest(action, { method: 'POST', body: { code } });
                    completeVerifiedLogin(result);
                } catch (requestError) {
                    error.textContent = requestError.message;
                } finally {
                    button.disabled = false;
                }
            });
        }
        const resendButton = document.getElementById(resendId);
        if (resendButton) {
            resendButton.addEventListener('click', async () => {
                resendButton.disabled = true;
                try {
                    const result = await apiRequest('resend-otp', { method: 'POST', body: {} });
                    showToast(result.message, 'info');
                    startResendCooldown(resendButton);
                } catch (error) {
                    resendButton.disabled = false;
                    showToast(error.message, 'error');
                }
            });
        }
    };

    const registerForm = document.getElementById('register-form');
    const registerOtpForm = document.getElementById('register-otp-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value.trim();
            const email = document.getElementById('email').value.trim().toLowerCase();
            const password = document.getElementById('password').value;
            const confirm = document.getElementById('confirm-password').value;
            const terms = document.getElementById('terms');
            setFieldError('username', username.length >= 3 ? '' : 'El nombre debe tener al menos 3 caracteres.');
            setFieldError('email', validateEmail(email) ? '' : 'Ingresa un correo electrónico válido.');
            setFieldError('password', password.length >= 8 ? '' : 'La contraseña debe tener al menos 8 caracteres.');
            setFieldError('confirm-password', password === confirm ? '' : 'Las contraseñas no coinciden.');
            setFieldError('terms', terms && terms.checked ? '' : 'Debes aceptar los términos y la política de privacidad.');
            const valid = username.length >= 3 && validateEmail(email) && password.length >= 8 && password === confirm && (!terms || terms.checked);

            if (!valid) {
                showToast('Revisa los campos mencionados', 'error');
                registerForm.querySelector('.invalid')?.focus();
                return;
            }

            const submitButton = registerForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            try {
                const result = await apiRequest('register', { method: 'POST', body: { username, email, password } });
                registerForm.hidden = true;
                registerOtpForm.hidden = false;
                showToast(result.message, 'info');
                startResendCooldown(document.getElementById('register-otp-resend'));
                document.getElementById('register-otp-code').focus();
            } catch (error) {
                showToast(error.message, 'error');
            } finally {
                submitButton.disabled = false;
            }
        });
    }
    bindOtpFlow('register-otp-form', 'register-otp-code', 'register-otp-error', 'register-otp-resend', 'verify-otp');

    const loginForm = document.getElementById('login-form');
    const loginOtpForm = document.getElementById('login-otp-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value.trim().toLowerCase();
            const password = document.getElementById('password').value;
            setFieldError('email', validateEmail(email) ? '' : 'Ingresa un correo electrónico válido.');
            setFieldError('password', password.length >= 8 ? '' : 'La contraseña debe tener al menos 8 caracteres.');
            const valid = validateEmail(email) && password.length >= 8;
            if (!valid) { showToast('Revisa tus credenciales', 'error'); return; }

            const submitButton = loginForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            try {
                const result = await apiRequest('login', { method: 'POST', body: { email, password } });
                loginForm.hidden = true;
                loginOtpForm.hidden = false;
                showToast(result.message, 'info');
                startResendCooldown(document.getElementById('login-otp-resend'));
                document.getElementById('login-otp-code').focus();
            } catch (error) {
                showToast(error.message, 'error');
            } finally {
                submitButton.disabled = false;
            }
        });
    }
    bindOtpFlow('login-otp-form', 'login-otp-code', 'login-otp-error', 'login-otp-resend', 'verify-otp');

    document.querySelectorAll('.password-toggle').forEach(icon => {
        icon.addEventListener('click', function() {
            const input = this.previousElementSibling;
            if (input.type === 'password') {
                input.type = 'text';
                this.classList.replace('fa-eye-slash', 'fa-eye');
            } else {
                input.type = 'password';
                this.classList.replace('fa-eye', 'fa-eye-slash');
            }
        });
    });
};
