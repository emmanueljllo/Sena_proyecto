document.addEventListener('DOMContentLoaded', () => {
    // 1. (Lógica de redirección movida a auth-guard.js)
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const isLoggedIn = localStorage.getItem('confort_user_logged_in') === 'true';

    // 2. Lógica para el formulario de Login
    if (currentPage === 'login.html') {
        const loginForm = document.querySelector('form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                
                let users = JSON.parse(localStorage.getItem('confort_users')) || [];
                const userExists = users.find(u => u.email === email && u.password === password);
                
                if (userExists) {
                    localStorage.setItem('confort_user_logged_in', 'true');
                    localStorage.setItem('confort_current_user', JSON.stringify({ name: userExists.name, email: userExists.email }));
                    window.location.href = 'index.html';
                } else {
                    alert('Credenciales incorrectas. Verifica tu correo o contraseña. Si no tienes cuenta, por favor regístrate.');
                }
            });
        }
    }

    // 3. Lógica para el formulario de Registro
    if (currentPage === 'register.html') {
        const registerForm = document.querySelector('form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault(); // Evitamos que el formulario haga submit normal
                const name = document.getElementById('name').value;
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                
                let users = JSON.parse(localStorage.getItem('confort_users')) || [];
                const emailExists = users.find(u => u.email === email);
                
                if (emailExists) {
                    alert('Este correo electrónico ya está registrado. Por favor, inicia sesión.');
                    return;
                }
                
                users.push({ name, email, password });
                localStorage.setItem('confort_users', JSON.stringify(users));
                
                localStorage.setItem('confort_user_logged_in', 'true');
                localStorage.setItem('confort_current_user', JSON.stringify({ name, email }));
                
                alert('¡Registro exitoso! Bienvenido a Confort Market.');
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
    const productsSection = document.getElementById('products');

    if (exploreBtn && productsSection) {
        exploreBtn.addEventListener('click', () => {
            productsSection.scrollIntoView({ behavior: 'smooth' });
        });
    }

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
            
            // Create Order
            let orders = JSON.parse(localStorage.getItem('confort_orders')) || [];
            const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            
            const newOrder = {
                id: '#' + Math.floor(10000 + Math.random() * 90000), // Random 5 digit ID
                date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
                product: cart.length === 1 ? cart[0].name : `${cart.length} Productos`,
                status: 'Procesando',
                total: `$${totalPrice.toFixed(2)}`
            };
            
            orders.unshift(newOrder); // Add to beginning
            localStorage.setItem('confort_orders', JSON.stringify(orders));

            // Show success modal
            const successModal = document.getElementById('success-modal');
            successModal.style.display = 'flex';
            
            // Clear cart
            cart = [];
            localStorage.setItem('confort_cart', JSON.stringify(cart));
            updateCartUI();
        });
    }

    // Dashboard Logic
    if (currentPage === 'dashboard.html') {
        // --- Tabs Logic ---
        const tabLinks = document.querySelectorAll('.tab-link');
        const sections = document.querySelectorAll('.dashboard-section');

        tabLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                tabLinks.forEach(t => t.classList.remove('active'));
                sections.forEach(s => s.style.display = 'none');
                link.classList.add('active');
                const targetId = link.getAttribute('data-target');
                const targetSection = document.getElementById(targetId);
                if (targetSection) targetSection.style.display = 'block';
            });
        });

        // --- Render Orders ---
        const ordersList = document.getElementById('orders-list');
        if (ordersList) {
            let orders = JSON.parse(localStorage.getItem('confort_orders')) || [];
            if (orders.length === 0) {
                ordersList.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-secondary);">No tienes pedidos recientes.</td></tr>';
            } else {
                ordersList.innerHTML = '';
                orders.forEach(order => {
                    ordersList.innerHTML += `
                        <tr>
                            <td>${order.id}</td>
                            <td>${order.date}</td>
                            <td>${order.product}</td>
                            <td style="color: #ffa64d;">${order.status}</td>
                            <td>${order.total}</td>
                        </tr>
                    `;
                });
            }
        }

        // --- Render and Add Cards ---
        const cardsList = document.getElementById('cards-list');
        
        function renderCards() {
            if (!cardsList) return;
            let cards = JSON.parse(localStorage.getItem('confort_cards')) || [
                // Default test card
                { brand: 'VISA', default: true, last4: '4242', name: 'Usuario Confort', exp: '12/28' }
            ];
            
            const addBtnHtml = `
                <div id="add-card-btn" style="background: rgba(255,255,255,0.02); padding: 1.5rem; border-radius: 10px; border: 1px dashed rgba(255,255,255,0.2); width: 250px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                    <span style="color: var(--gold-primary); font-weight: bold;">+ Añadir Tarjeta</span>
                </div>
            `;
            
            cardsList.innerHTML = '';
            cards.forEach(card => {
                cardsList.innerHTML += `
                    <div style="background: linear-gradient(135deg, #2b2b2b, #1a1a1a); padding: 1.5rem; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); width: 250px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                            <span style="font-weight: bold; color: var(--gold-primary);">${card.brand}</span>
                            ${card.default ? '<span style="font-size: 0.8rem; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">Predeterminada</span>' : ''}
                        </div>
                        <div style="font-family: monospace; font-size: 1.2rem; letter-spacing: 2px; margin-bottom: 1rem;">**** **** **** ${card.last4}</div>
                        <div style="display: flex; justify-content: space-between; color: var(--text-secondary); font-size: 0.9rem;">
                            <span>${card.name}</span>
                            <span>${card.exp}</span>
                        </div>
                    </div>
                `;
            });
            
            cardsList.innerHTML += addBtnHtml;
            
            // Bind click to the newly rendered button
            const newAddBtn = document.getElementById('add-card-btn');
            if (newAddBtn) {
                newAddBtn.addEventListener('click', () => {
                    const cardNum = prompt('Introduce los últimos 4 dígitos de tu nueva tarjeta (Ej: 1234):');
                    if (cardNum && cardNum.trim().length === 4) {
                        cards.push({ brand: 'MASTERCARD', default: false, last4: cardNum, name: 'Usuario Confort', exp: '05/30' });
                        localStorage.setItem('confort_cards', JSON.stringify(cards));
                        renderCards();
                    } else if (cardNum !== null) {
                        alert('Debes introducir exactamente 4 dígitos.');
                    }
                });
            }
        }
        
        renderCards();
    }
});
