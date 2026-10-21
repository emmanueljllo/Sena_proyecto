/**
 * Confort Market - Conexión Firebase Realtime Database (Google Cloud)
 * Permite sincronización en tiempo real entre múltiples dispositivos por Internet
 */

const firebaseConfig = {
    apiKey: "AIzaSyCq_DineAfiHzzCAzPOatJej4eTMaIMvps",
    authDomain: "confort-market.firebaseapp.com",
    databaseURL: "https://confort-market-default-rtdb.firebaseio.com",
    projectId: "confort-market",
    storageBucket: "confort-market.firebasestorage.app",
    messagingSenderId: "139175002385",
    appId: "1:139175002385:web:c9028ec2a3734edf4f8cb0"
};

// Inicializar Firebase Compat
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    try {
        firebase.initializeApp(firebaseConfig);
        console.log('✅ Firebase Realtime Database conectado exitosamente');
    } catch (e) {
        console.warn('Advertencia al inicializar Firebase:', e);
    }
}

const getFbDb = () => {
    if (typeof firebase !== 'undefined' && firebase.apps.length) {
        return firebase.database();
    }
    return null;
};

// Sanitizar claves para Firebase (no permite puntos ni caracteres especiales)
const sanitizeKey = (key) => (key || '').replace(/[.#$\[\]\/]/g, '_').toLowerCase();

/**
 * Guarda un usuario en la nube de Firebase y en localStorage
 */
window.cloudSaveUser = async (user) => {
    // 1. Guardar local
    const users = JSON.parse(localStorage.getItem('confort_users')) || [];
    const idx = users.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
    if (idx !== -1) {
        users[idx] = { ...users[idx], ...user };
    } else {
        users.push(user);
    }
    localStorage.setItem('confort_users', JSON.stringify(users));

    // 2. Guardar en Firebase Realtime Database
    const db = getFbDb();
    if (db) {
        try {
            const key = sanitizeKey(user.email);
            await db.ref('users/' + key).set({
                username: user.username,
                email: user.email,
                password: user.password,
                role: user.role || 'cliente',
                createdAt: user.createdAt || new Date().toISOString()
            });

            // Emitir notificación global en la nube
            await db.ref('notifications').push({
                type: 'user',
                title: '¡Nuevo Usuario Registrado!',
                desc: `El usuario "${user.username}" (${user.email}) se ha registrado como ${user.role || 'cliente'}.`,
                timestamp: Date.now(),
                dateStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                unread: true
            });
            console.log('☁️ Usuario guardado en la nube Firebase');
        } catch (err) {
            console.error('Error al guardar en Firebase:', err);
        }
    }
};

/**
 * Guarda un pedido en la nube de Firebase y en localStorage
 */
window.cloudSaveOrder = async (order) => {
    // 1. Guardar local
    const userOrdersKey = `confort_orders_${order.customerEmail}`;
    const orders = JSON.parse(localStorage.getItem(userOrdersKey)) || [];
    orders.unshift(order);
    localStorage.setItem(userOrdersKey, JSON.stringify(orders));
    localStorage.setItem('confort_last_order', JSON.stringify(order));

    // 2. Guardar en Firebase Realtime Database
    const db = getFbDb();
    if (db) {
        try {
            await db.ref('orders/' + order.id).set(order);

            // Emitir notificación global en la nube para el admin
            await db.ref('notifications').push({
                type: 'order',
                title: '¡Nuevo Pedido Recibido!',
                desc: `Pedido ${order.id} por $${Number(order.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} de ${order.customerName || 'Cliente'}.`,
                timestamp: Date.now(),
                dateStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                data: order,
                unread: true
            });
            console.log('☁️ Pedido guardado en la nube Firebase');
        } catch (err) {
            console.error('Error al guardar pedido en Firebase:', err);
        }
    }
};

/**
 * Escucha notificaciones en tiempo real desde cualquier computador
 */
window.cloudListenNotifications = (onNotification) => {
    const db = getFbDb();
    if (!db) return;

    // Solo escuchar notificaciones generadas a partir de la conexión
    const startTimestamp = Date.now() - 3000;
    db.ref('notifications')
        .orderByChild('timestamp')
        .startAt(startTimestamp)
        .on('child_added', (snapshot) => {
            const notif = snapshot.val();
            if (notif && typeof onNotification === 'function') {
                onNotification(notif);
            }
        });
};

/**
 * Escucha cambios en los usuarios en tiempo real
 */
window.cloudListenUsers = (onUsersUpdated) => {
    const db = getFbDb();
    if (!db) return;

    db.ref('users').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const cloudUsersList = Object.values(data);
            localStorage.setItem('confort_users', JSON.stringify(cloudUsersList));
            if (typeof onUsersUpdated === 'function') {
                onUsersUpdated(cloudUsersList);
            }
        }
    });
};

/**
 * Escucha cambios en los pedidos en tiempo real
 */
window.cloudListenOrders = (onOrdersUpdated) => {
    const db = getFbDb();
    if (!db) return;

    db.ref('orders').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const cloudOrdersList = Object.values(data);
            cloudOrdersList.forEach(order => {
                if (order.customerEmail) {
                    const key = `confort_orders_${order.customerEmail}`;
                    const localOrders = JSON.parse(localStorage.getItem(key)) || [];
                    if (!localOrders.some(o => o.id === order.id)) {
                        localOrders.unshift(order);
                        localStorage.setItem(key, JSON.stringify(localOrders));
                    }
                }
            });
            if (typeof onOrdersUpdated === 'function') {
                onOrdersUpdated(cloudOrdersList);
            }
        }
    });
};

/**
 * Pre-sincronizar datos de Firebase a localStorage al iniciar cualquier página
 */
window.cloudSyncInitialData = async () => {
    const db = getFbDb();
    if (!db) return;
    try {
        const [usersSnap, ordersSnap] = await Promise.all([
            db.ref('users').once('value'),
            db.ref('orders').once('value')
        ]);
        if (usersSnap && usersSnap.val()) {
            const cloudUsers = Object.values(usersSnap.val());
            const localUsers = JSON.parse(localStorage.getItem('confort_users')) || [];
            cloudUsers.forEach(cu => {
                if (!localUsers.some(lu => lu.email.toLowerCase() === cu.email.toLowerCase())) {
                    localUsers.push(cu);
                }
            });
            localStorage.setItem('confort_users', JSON.stringify(localUsers));
        }
        if (ordersSnap && ordersSnap.val()) {
            const cloudOrders = Object.values(ordersSnap.val());
            cloudOrders.forEach(ord => {
                if (ord.customerEmail) {
                    const key = `confort_orders_${ord.customerEmail}`;
                    const localOrders = JSON.parse(localStorage.getItem(key)) || [];
                    if (!localOrders.some(o => o.id === ord.id)) {
                        localOrders.unshift(ord);
                        localStorage.setItem(key, JSON.stringify(localOrders));
                    }
                }
            });
        }
    } catch (e) {
        console.warn('Nota: sincronización inicial Firebase en proceso:', e);
    }
};

// Ejecutar sincronización inicial en cuanto cargue el script
if (typeof window !== 'undefined') {
    window.cloudSyncInitialData();
}
