// --- Datos de Productos ---
const products = [
    { id: 1, name: "ConfortBook Pro X", price: 1499.00, oldPrice: 1699.00, category: "Computadores", rating: 4.9, reviews: 128, image: "assets/premium_laptop_1778531221300.png", badge: "new" },
    { id: 2, name: "Chrono Elite Gold", price: 399.00, oldPrice: null, category: "Accesorios", rating: 4.8, reviews: 85, image: "assets/premium_smartwatch_1778531397408.png", badge: null },
    { id: 3, name: "Aura Sound Max", price: 299.00, oldPrice: 349.00, category: "Audio", rating: 4.7, reviews: 210, image: "assets/premium_headphones_1778531409537.png", badge: "sale" },
    { id: 4, name: "Monitor Vision 4K", price: 450.00, oldPrice: null, category: "Computadores", rating: 4.6, reviews: 54, image: "https://picsum.photos/seed/monitor/500/500", badge: null },
    { id: 5, name: "Teclado Titan RGB", price: 120.00, oldPrice: 150.00, category: "Accesorios", rating: 4.8, reviews: 320, image: "https://picsum.photos/seed/keyboard/500/500", badge: "sale" },
    { id: 6, name: "Ratón Viper Pro", price: 85.00, oldPrice: null, category: "Accesorios", rating: 4.5, reviews: 112, image: "https://picsum.photos/seed/mouse/500/500", badge: null },
    { id: 7, name: "Silla Ergonomic Plus", price: 320.00, oldPrice: null, category: "Hogar", rating: 4.7, reviews: 89, image: "https://picsum.photos/seed/chair/500/500", badge: null },
    { id: 8, name: "Cámara Stream 4K", price: 150.00, oldPrice: null, category: "Accesorios", rating: 4.4, reviews: 67, image: "https://picsum.photos/seed/webcam/500/500", badge: null },
    { id: 9, name: "Micro Studio Voice", price: 190.00, oldPrice: 220.00, category: "Audio", rating: 4.9, reviews: 145, image: "https://picsum.photos/seed/mic/500/500", badge: "sale" },
    { id: 10, name: "Gafas Reality Max", price: 599.00, oldPrice: null, category: "Drones", rating: 4.6, reviews: 34, image: "https://picsum.photos/seed/vr/500/500", badge: "new" },
    { id: 11, name: "Drone SkyEye Pro", price: 899.00, oldPrice: 999.00, category: "Drones", rating: 4.8, reviews: 42, image: "https://picsum.photos/seed/drone/500/500", badge: "sale" },
    { id: 12, name: "Tablet ArtPad 12\"", price: 250.00, oldPrice: null, category: "Computadores", rating: 4.5, reviews: 76, image: "https://picsum.photos/seed/tablet/500/500", badge: null },
    { id: 13, name: "Altavoz Smart Echo", price: 99.00, oldPrice: null, category: "Hogar", rating: 4.3, reviews: 201, image: "https://picsum.photos/seed/speaker/500/500", badge: null }
];

// --- Estado Global ---
const ADMIN_SECRET_CODE = 'CONFORTADMIN2026';
let currentUser = JSON.parse(localStorage.getItem('confort_current_user')) || null;
let userCartKey = currentUser ? `confort_cart_${currentUser.email}` : 'confort_cart_guest';
let userWishlistKey = currentUser ? `confort_wishlist_${currentUser.email}` : 'confort_wishlist_guest';

let cart = JSON.parse(localStorage.getItem(userCartKey)) || [];
let wishlist = JSON.parse(localStorage.getItem(userWishlistKey)) || [];

// --- Funciones Utilitarias ---

// Formatear precio
const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
};

// Toasts
const showToast = (message, type = 'success') => {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? '<i class="fa-solid fa-circle-check" style="color:#2ed573; font-size:1.2rem;"></i>' : 
                 type === 'error' ? '<i class="fa-solid fa-circle-exclamation" style="color:#ff4757; font-size:1.2rem;"></i>' : 
                 '<i class="fa-solid fa-circle-info" style="color:#3498db; font-size:1.2rem;"></i>';

    toast.innerHTML = `
        ${icon}
        <div style="font-weight:500;">${message}</div>
        <div class="toast-progress"></div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease reverse forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// --- Navbar & UI Global ---
document.addEventListener('DOMContentLoaded', () => {
    // Loading Screen
    setTimeout(() => {
        const loader = document.getElementById('loading-screen');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 500);
        }
    }, 1000);

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
            authLinks.innerHTML = `
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
    
    // Inicializar páginas
    initIndexPage();
    initCheckoutPage();
    initDashboardPage();
    initAuthPages();

    // Forgot password link
    const forgotLink = document.getElementById('forgot-password-link');
    if (forgotLink) forgotLink.addEventListener('click', (e) => { e.preventDefault(); openForgotModal(); });

    // Modal close on backdrop click
    const forgotModal = document.getElementById('forgot-modal');
    if (forgotModal) forgotModal.addEventListener('click', (e) => { if (e.target === forgotModal) closeForgotModal(); });
});

window.logout = (e) => {
    if(e) e.preventDefault();
    localStorage.removeItem('confort_current_user');
    localStorage.removeItem('confort_user_logged_in');
    window.location.href = 'index.html';
};

// --- Forgot Password (Modal) ---
window.verifyForgotEmail = () => {
    const email = document.getElementById('forgot-email').value.trim();
    if (!email) { showToast('Ingresa un correo válido', 'error'); return; }
    const users = JSON.parse(localStorage.getItem('confort_users')) || [];
    const user = users.find(u => u.email === email);
    if (!user) { showToast('No existe una cuenta con ese correo', 'error'); return; }
    document.getElementById('forgot-step-1').style.display = 'none';
    document.getElementById('forgot-step-2').style.display = 'block';
};

window.resetPassword = () => {
    const email = document.getElementById('forgot-email').value.trim();
    const newPass = document.getElementById('forgot-new-password').value;
    const confirm = document.getElementById('forgot-confirm-password').value;
    if (newPass.length < 8) { showToast('La contraseña debe tener al menos 8 caracteres', 'error'); return; }
    if (newPass !== confirm) { showToast('Las contraseñas no coinciden', 'error'); return; }
    const users = JSON.parse(localStorage.getItem('confort_users')) || [];
    const idx = users.findIndex(u => u.email === email);
    if (idx === -1) { showToast('Error al actualizar', 'error'); return; }
    users[idx].password = newPass;
    localStorage.setItem('confort_users', JSON.stringify(users));
    showToast('¡Contraseña actualizada! Inicia sesión.');
    closeForgotModal();
};

window.closeForgotModal = () => {
    document.getElementById('forgot-modal').style.display = 'none';
    document.getElementById('forgot-step-1').style.display = 'block';
    document.getElementById('forgot-step-2').style.display = 'none';
    document.getElementById('forgot-email').value = '';
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
        
        // Animación pulse
        countEl.style.animation = 'none';
        countEl.offsetHeight; /* trigger reflow */
        countEl.style.animation = 'pulse 0.3s ease';
    }
};

const updateWishlistCount = () => {
    const countEl = document.getElementById('wishlist-count');
    if (countEl) countEl.textContent = wishlist.length;
};

const addToCart = (productId) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existing = cart.find(item => item.id === productId);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    
    localStorage.setItem(userCartKey, JSON.stringify(cart));
    updateCartCount();
    showToast(`${product.name} agregado al carrito`);
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
    renderProducts(); // Re-renderizar para actualizar el estado del botón
    if (typeof renderDashboardWishlist === 'function') renderDashboardWishlist();
};

// --- Lógica de la Página de Inicio (Index) ---

const initIndexPage = () => {
    const productsGrid = document.getElementById('products-grid');
    if (!productsGrid) return; // No estamos en index.html

    renderProducts();

    // Búsqueda
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderProducts(e.target.value, document.querySelector('.filter-chip.active').dataset.filter);
        });
    }

    // Filtros
    const filters = document.querySelectorAll('.filter-chip');
    filters.forEach(filter => {
        filter.addEventListener('click', (e) => {
            filters.forEach(f => f.classList.remove('active'));
            e.target.classList.add('active');
            
            const searchTerm = document.getElementById('search-input').value;
            renderProducts(searchTerm, e.target.dataset.filter);
        });
    });
};

const renderProducts = (search = '', category = 'all') => {
    const productsGrid = document.getElementById('products-grid');
    if (!productsGrid) return;

    productsGrid.innerHTML = '';

    let filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = category === 'all' || p.category === category;
        return matchesSearch && matchesCategory;
    });

    if (filtered.length === 0) {
        productsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 3rem; color: var(--text-secondary);">No se encontraron productos.</div>`;
        return;
    }

    filtered.forEach((p, index) => {
        const delay = (index % 4) * 0.1;
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
            <button class="wishlist-btn ${isWished ? 'active' : ''}" onclick="toggleWishlist(${p.id})">
                <i class="${isWished ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
            </button>
            <img src="${p.image}" alt="${p.name}" class="product-image">
            <div class="product-info">
                <span class="product-category">${p.category}</span>
                <h3 class="product-title">${p.name}</h3>
                <div class="product-rating">
                    <span class="stars"><i class="fa-solid fa-star"></i> ${p.rating}</span>
                    <span>(${p.reviews} reseñas)</span>
                </div>
                <div class="product-price-row">
                    <div>
                        <span class="product-price">${formatPrice(p.price)}</span>
                        ${oldPriceHtml}
                    </div>
                </div>
                <button class="btn btn-primary add-to-cart-btn" onclick="addToCart(${p.id})">
                    <i class="fa-solid fa-cart-plus"></i> Añadir
                </button>
            </div>
        `;
        productsGrid.appendChild(card);
    });
};

const renderDashboardWishlist = () => {
    const grid = document.getElementById('dashboard-wishlist-grid');
    const empty = document.getElementById('dashboard-no-wishlist');
    if (!grid || !empty) return;

    const wishedItems = products.filter(p => wishlist.includes(p.id));
    grid.innerHTML = '';

    if (wishedItems.length === 0) {
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    wishedItems.forEach((p, index) => {
        const delay = (index % 4) * 0.1;
        const card = document.createElement('div');
        card.className = 'glass-card product-card animate-fade-up';
        card.style.animationDelay = `${delay}s`;
        card.innerHTML = `
            <button class="wishlist-btn active" onclick="toggleWishlist(${p.id})">
                <i class="fa-solid fa-heart"></i>
            </button>
            <img src="${p.image}" alt="${p.name}" class="product-image">
            <div class="product-info">
                <span class="product-category">${p.category}</span>
                <h3 class="product-title">${p.name}</h3>
                <div class="product-price-row">
                    <div>
                        <span class="product-price">${formatPrice(p.price)}</span>
                    </div>
                </div>
                <button class="btn btn-primary add-to-cart-btn" onclick="addToCart(${p.id})">
                    <i class="fa-solid fa-cart-plus"></i> Añadir al carrito
                </button>
            </div>
        `;
        grid.appendChild(card);
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
        checkoutForm.addEventListener('submit', (e) => {
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

            // Save order
            const userOrdersKey = `confort_orders_${currentUser.email}`;
            const orders = JSON.parse(localStorage.getItem(userOrdersKey)) || [];
            
            const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            
            orders.unshift({
                id: 'ORD-' + Math.floor(Math.random() * 1000000),
                date: new Date().toISOString(),
                items: cart,
                total: total + (total * 0.19), // + tax
                status: 'Procesando'
            });
            
            localStorage.setItem(userOrdersKey, JSON.stringify(orders));
            
            // Clear cart
            cart = [];
            localStorage.setItem(userCartKey, JSON.stringify(cart));
            updateCartCount();

            // Show success and redirect
            showToast('¡Pedido realizado con éxito!');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);
        });
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
                    <h4>${item.name}</h4>
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

    const tax = subtotal * 0.19;
    const total = subtotal + tax;

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

// --- Lógica de Dashboard ---
const initDashboardPage = () => {
    if (!document.querySelector('.dashboard-main')) return;

    if (currentUser) {
        // Rellenar info del sidebar
        document.getElementById('user-name-display').textContent = currentUser.username || currentUser.email;
        document.getElementById('user-email-display').textContent = currentUser.email;
        document.getElementById('avatar-initial').textContent = (currentUser.username || currentUser.email).charAt(0).toUpperCase();

        // Rellenar form de configuración
        const settingsUsername = document.querySelector('#tab-settings input[type="text"]');
        const settingsEmail = document.querySelector('#tab-settings input[type="email"]');
        if (settingsUsername) settingsUsername.value = currentUser.username || '';
        if (settingsEmail) settingsEmail.value = currentUser.email || '';

        // Mostrar panel admin si corresponde
        if (currentUser.role === 'admin') {
            const adminLink = document.getElementById('admin-link');
            if (adminLink) adminLink.style.display = 'flex';
        }
    }

    // Tabs
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

    // Populate Data
    if (currentUser) {
        const userOrdersKey = `confort_orders_${currentUser.email}`;
        const orders = JSON.parse(localStorage.getItem(userOrdersKey)) || [];
        
        // Stats
        document.getElementById('stat-orders').textContent = orders.length;
        const totalSpent = orders.reduce((sum, order) => sum + order.total, 0);
        document.getElementById('stat-spent').textContent = formatPrice(totalSpent);
        document.getElementById('stat-wishlist').textContent = wishlist.length;

        // Orders Table
        const tbody = document.getElementById('orders-tbody');
        if (tbody) {
            if (orders.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-secondary); padding:2rem;">No tienes pedidos recientes. <a href="index.html#catalogo" style="color:var(--gold-primary);">Ir al catálogo</a></td></tr>';
            } else {
                orders.forEach(order => {
                    const tr = document.createElement('tr');
                    const statusClass = order.status === 'Procesando' ? 'status-processing' : 
                                        order.status === 'Enviado' ? 'status-shipped' : 'status-delivered';
                    tr.innerHTML = `
                        <td><strong>${order.id}</strong></td>
                        <td>${new Date(order.date).toLocaleDateString()}</td>
                        <td>${formatPrice(order.total)}</td>
                        <td><span class="status-badge ${statusClass}">${order.status}</span></td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        }

        // Wishlist Grid
        renderDashboardWishlist();

        // Admin panel
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
            <button class="wishlist-btn active" onclick="removeFromWishlistDashboard(${p.id})">
                <i class="fa-solid fa-heart"></i>
            </button>
            <img src="${p.image}" alt="${p.name}" class="product-image">
            <div class="product-info">
                <span class="product-category">${p.category}</span>
                <h3 class="product-title">${p.name}</h3>
                <div class="product-price-row">
                    <span class="product-price">${formatPrice(p.price)}</span>
                    ${oldPriceHtml}
                </div>
                <div style="display:flex; gap:0.5rem; margin-top:0.8rem;">
                    <button class="btn btn-primary" style="flex:1; font-size:0.85rem;" onclick="addToCart(${p.id})">
                        <i class="fa-solid fa-cart-plus"></i> Añadir
                    </button>
                    <button class="btn btn-outline" style="font-size:0.85rem;" onclick="removeFromWishlistDashboard(${p.id})">
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
    document.getElementById('stat-wishlist').textContent = wishlist.length;
    renderDashboardWishlist();
    showToast('Eliminado de la lista de deseos', 'info');
};

const renderAdminPanel = () => {
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;
    const allUsers = JSON.parse(localStorage.getItem('confort_users')) || [];
    if (allUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-secondary);">No hay usuarios registrados.</td></tr>';
        return;
    }
    allUsers.forEach(u => {
        const userOrders = JSON.parse(localStorage.getItem(`confort_orders_${u.email}`)) || [];
        const tr = document.createElement('tr');
        const roleHtml = u.role === 'admin'
            ? '<span class="status-badge" style="background:rgba(212,175,55,0.15); color:var(--gold-primary);"><i class="fa-solid fa-shield-halved"></i> Admin</span>'
            : '<span class="status-badge status-processing"><i class="fa-regular fa-user"></i> Cliente</span>';
        tr.innerHTML = `
            <td><strong>${u.username || 'N/A'}</strong></td>
            <td>${u.email}</td>
            <td>${roleHtml}</td>
            <td>${userOrders.length} pedido(s)</td>
        `;
        tbody.appendChild(tr);
    });
};

// --- Auth Forms Validation ---
const initAuthPages = () => {
    // Password Strength
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

    // Register Form
    const registerForm = document.getElementById('register-form');
    const roleSelect = document.getElementById('role');
    const adminCodeGroup = document.getElementById('admin-code-group');

    if (roleSelect && adminCodeGroup) {
        roleSelect.addEventListener('change', (e) => {
            adminCodeGroup.style.display = e.target.value === 'admin' ? 'block' : 'none';
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirm = document.getElementById('confirm-password').value;
            const adminCode = document.getElementById('admin-code') ? document.getElementById('admin-code').value : '';

            if (password !== confirm) {
                showToast('Las contraseñas no coinciden', 'error');
                return;
            }

            const users = JSON.parse(localStorage.getItem('confort_users')) || [];
            if (users.find(u => u.email === email)) {
                showToast('El email ya está registrado', 'error');
                return;
            }

            // Asignar rol: admin si el email contiene 'admin', sino cliente
            const role = email.toLowerCase().includes('admin') || adminCode === ADMIN_SECRET_CODE ? 'admin' : 'cliente';
            users.push({ username, email, password, role });
            localStorage.setItem('confort_users', JSON.stringify(users));
            showToast('Registro exitoso. Inicia sesión.');
            setTimeout(() => window.location.href = 'login.html', 1500);
        });
    }

    // Login Form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            const users = JSON.parse(localStorage.getItem('confort_users')) || [];
            const user = users.find(u => u.email === email && u.password === password);
            
            if (user) {
                localStorage.setItem('confort_current_user', JSON.stringify({ email: user.email, username: user.username, role: user.role || 'cliente' }));
                localStorage.setItem('confort_user_logged_in', 'true');
                showToast('Inicio de sesión exitoso');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
            } else {
                showToast('Credenciales incorrectas', 'error');
            }
        });
    }

    const forgotLink = document.getElementById('forgot-password-link');
    if (forgotLink) {
        forgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            const email = prompt('Ingresa tu correo electrónico para recuperar tu contraseña:');
            if (!email) return;

            const users = JSON.parse(localStorage.getItem('confort_users')) || [];
            const user = users.find(u => u.email === email);
            if (!user) {
                showToast('No se encontró ninguna cuenta con ese correo', 'error');
                return;
            }
            showToast('Revisa tu bandeja de entrada. Se ha enviado un enlace de recuperación.', 'success');
        });
    }

    // Toggle Password Visibility
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
