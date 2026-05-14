document.addEventListener('DOMContentLoaded', () => {
    // --- AUTH GUARD LOGIC ---
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const isAuthPage = currentPage === 'login.html' || currentPage === 'register.html';
    const isLoggedIn = localStorage.getItem('confort_user_logged_in') === 'true';

    // 1. Redirigir a login si no está logueado y no está en una página de auth
    if (!isLoggedIn && !isAuthPage) {
        window.location.href = 'login.html';
        return; // Detiene la ejecución del resto de scripts
    }

    // 2. Lógica para el formulario de Login
    if (currentPage === 'login.html') {
        const loginForm = document.querySelector('form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                localStorage.setItem('confort_user_logged_in', 'true');
                window.location.href = 'index.html';
            });
        }
    }

    // 3. Lógica para el formulario de Registro
    if (currentPage === 'register.html') {
        const registerForm = document.querySelector('form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault(); // Evitamos que el formulario haga submit normal
                localStorage.setItem('confort_user_logged_in', 'true');
                window.location.href = 'index.html';
            });
        }
    }

    // 4. Lógica de Cerrar Sesión y Ocultar "Registro" si ya está logueado
    if (isLoggedIn) {
        document.querySelectorAll('a[href="login.html"]').forEach(btn => {
            btn.textContent = 'Cerrar Sesión';
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('confort_user_logged_in');
                window.location.href = 'login.html';
            });
        });
        
        document.querySelectorAll('a[href="register.html"]').forEach(btn => {
            btn.style.display = 'none';
        });
    }

    // Smooth scrolling for the explore button
    const exploreBtn = document.getElementById('explore-btn');
    const planSection = document.getElementById('plan-section');

    exploreBtn.addEventListener('click', () => {
        planSection.scrollIntoView({ behavior: 'smooth' });
    });

    // Intersection Observer for scroll animations
    const cards = document.querySelectorAll('.card');
    
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // Stop observing once visible
            }
        });
    }, observerOptions);

    cards.forEach(card => {
        observer.observe(card);
    });

    // Dynamic mouse glow effect
    document.addEventListener('mousemove', (e) => {
        const glowOrb = document.querySelector('.glow-orb');
        if (glowOrb) {
            const x = e.clientX / window.innerWidth;
            const y = e.clientY / window.innerHeight;
            
            // Move orb slightly based on mouse position
            glowOrb.style.transform = `translate(calc(-50% + ${x * 40}px), calc(-50% + ${y * 40}px))`;
        }
    });

    // --- CART LOGIC ---
    let cart = JSON.parse(localStorage.getItem('confort_cart')) || [];
    
    function updateCartUI() {
        const cartCounts = document.querySelectorAll('#cart-count');
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCounts.forEach(el => el.textContent = totalItems);

        // Update checkout page if we are on it
        const cartItemsContainer = document.getElementById('cart-items');
        const cartTotalEl = document.getElementById('cart-total');
        
        if (cartItemsContainer && cartTotalEl) {
            cartItemsContainer.innerHTML = '';
            let total = 0;
            
            if (cart.length === 0) {
                cartItemsContainer.innerHTML = '<p style="color:var(--text-secondary);">El carrito está vacío.</p>';
            } else {
                cart.forEach((item, index) => {
                    total += item.price * item.quantity;
                    const itemEl = document.createElement('div');
                    itemEl.style.display = 'flex';
                    itemEl.style.justifyContent = 'space-between';
                    itemEl.style.marginBottom = '1rem';
                    itemEl.style.paddingBottom = '1rem';
                    itemEl.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                    
                    itemEl.innerHTML = `
                        <div>
                            <h4 style="margin:0;">${item.name}</h4>
                            <small style="color:var(--text-secondary);">Cantidad: ${item.quantity}</small>
                        </div>
                        <div style="text-align:right;">
                            <div class="gold-text">$${(item.price * item.quantity).toFixed(2)}</div>
                            <button class="remove-item-btn" data-index="${index}" style="background:none; border:none; color:#ff4d4d; cursor:pointer; font-size:0.8rem; margin-top:5px;">Eliminar</button>
                        </div>
                    `;
                    cartItemsContainer.appendChild(itemEl);
                });
            }
            cartTotalEl.textContent = `$${total.toFixed(2)}`;

            // Add remove event listeners
            document.querySelectorAll('.remove-item-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = e.target.getAttribute('data-index');
                    cart.splice(idx, 1);
                    localStorage.setItem('confort_cart', JSON.stringify(cart));
                    updateCartUI();
                });
            });
        }
    }

    // Add to cart buttons
    const addToCartBtns = document.querySelectorAll('.add-to-cart-btn');
    addToCartBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = btn.getAttribute('data-id');
            const name = btn.getAttribute('data-name');
            const price = parseFloat(btn.getAttribute('data-price'));
            
            const existingItem = cart.find(item => item.id === id);
            if (existingItem) {
                existingItem.quantity += 1;
            } else {
                cart.push({ id, name, price, quantity: 1 });
            }
            
            localStorage.setItem('confort_cart', JSON.stringify(cart));
            updateCartUI();
            
            // Visual feedback
            const originalText = btn.textContent;
            btn.textContent = '¡Añadido!';
            btn.style.background = 'var(--gold-primary)';
            btn.style.color = '#000';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = 'transparent';
                btn.style.color = 'var(--gold-primary)';
            }, 1000);
        });
    });

    // Initialize cart UI
    updateCartUI();

    // Checkout Form Submission
    const checkoutForm = document.getElementById('checkout-form');
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (cart.length === 0) {
                alert('Tu carrito está vacío. Agrega productos antes de pagar.');
                return;
            }
            
            // Show success modal
            const successModal = document.getElementById('success-modal');
            successModal.style.display = 'flex';
            
            // Clear cart
            cart = [];
            localStorage.setItem('confort_cart', JSON.stringify(cart));
            updateCartUI();
        });
    }
});
