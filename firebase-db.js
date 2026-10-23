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
window.confortFirebaseConfig = firebaseConfig;

const publicUserProfile = (user) => ({
    uid: user.uid || '',
    username: user.username || '',
    email: user.email || '',
    role: user.role === 'admin' ? 'admin' : 'cliente',
    createdAt: user.createdAt || ''
});

const cachedUsers = JSON.parse(localStorage.getItem('confort_users') || '[]');
if (Array.isArray(cachedUsers)) {
    localStorage.setItem('confort_users', JSON.stringify(cachedUsers.map(publicUserProfile)));
}

// Inicializar Firebase Compat
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    try {
        firebase.initializeApp(firebaseConfig);
        console.log(' Firebase Realtime Database conectado exitosamente');
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
    const profile = publicUserProfile(user);
    const users = JSON.parse(localStorage.getItem('confort_users') || '[]');
    const idx = users.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
    if (idx !== -1) {
        users[idx] = { ...users[idx], ...profile };
    } else {
        users.push(profile);
    }
    localStorage.setItem('confort_users', JSON.stringify(users));

    const db = getFbDb();
    if (db) {
        try {
            const key = sanitizeKey(user.uid || user.email);
            await db.ref('users/' + key).update(profile);
            const legacyKey = sanitizeKey(user.email);
            if (legacyKey !== key) {
                const legacyEmail = await db.ref(`users/${legacyKey}/email`).once('value');
                if (String(legacyEmail.val() || '').toLowerCase() === user.email.toLowerCase()) {
                    await db.ref('users/' + legacyKey).remove();
                }
            }
            console.log(' Usuario guardado en la nube Firebase');
        } catch (err) {
            console.error('Error al guardar en Firebase:', err);
            throw err;
        }
    }
};

/**
 * Guarda un pedido en la nube de Firebase y en localStorage
 */
window.cloudSaveOrder = async (order) => {
    // 1. Guardar local por email
    const email = order.customerEmail || order.userEmail;
    const userOrdersKey = `confort_orders_${email}`;
    const orders = JSON.parse(localStorage.getItem(userOrdersKey)) || [];
    orders.unshift(order);
    localStorage.setItem(userOrdersKey, JSON.stringify(orders));
    localStorage.setItem('confort_last_order', JSON.stringify(order));

    // Guardar en lista centralizada local
    const allCloudOrders = JSON.parse(localStorage.getItem('confort_all_cloud_orders')) || [];
    if (!allCloudOrders.some(o => o.id === order.id)) {
        allCloudOrders.unshift(order);
        localStorage.setItem('confort_all_cloud_orders', JSON.stringify(allCloudOrders));
    }

    // 2. Guardar en Firebase Realtime Database
    const db = getFbDb();
    if (db) {
        try {
            await db.ref('orders/' + order.id).set(order);

            // Emitir notificación global en la nube para el admin
            const notifItem = {
                id: 'notif_' + Date.now(),
                type: 'order',
                title: '¡Nuevo Pedido Recibido!',
                desc: `Pedido ${order.id} por $${Number(order.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} de ${order.customerName || order.userName || 'Cliente'}.`,
                timestamp: Date.now(),
                dateStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                data: order,
                unread: true
            };
            await db.ref('notifications').push(notifItem);
            console.log(' Pedido guardado en la nube Firebase');
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
            const cloudUsersList = Object.values(data).map(publicUserProfile);
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
            // 1. Guardar en lista central de órdenes para el admin
            localStorage.setItem('confort_all_cloud_orders', JSON.stringify(cloudOrdersList));

            // 2. Guardar por clave de cliente
            cloudOrdersList.forEach(order => {
                const email = order.customerEmail || order.userEmail;
                if (email) {
                    const key = `confort_orders_${email}`;
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
 * Sincronización inicial completa de Firebase
 */
window.cloudSyncInitialData = async () => {
    const db = getFbDb();
    if (!db) return;
    try {
        const [usersSnap, ordersSnap, notifsSnap] = await Promise.all([
            db.ref('users').once('value'),
            db.ref('orders').once('value'),
            db.ref('notifications').limitToLast(25).once('value')
        ]);

        if (usersSnap && usersSnap.val()) {
            const cloudUsers = Object.values(usersSnap.val()).map(publicUserProfile);
            localStorage.setItem('confort_users', JSON.stringify(cloudUsers));
        }

        if (ordersSnap && ordersSnap.val()) {
            const cloudOrders = Object.values(ordersSnap.val());
            localStorage.setItem('confort_all_cloud_orders', JSON.stringify(cloudOrders));
            cloudOrders.forEach(ord => {
                const email = ord.customerEmail || ord.userEmail;
                if (email) {
                    const key = `confort_orders_${email}`;
                    const localOrders = JSON.parse(localStorage.getItem(key)) || [];
                    if (!localOrders.some(o => o.id === ord.id)) {
                        localOrders.unshift(ord);
                        localStorage.setItem(key, JSON.stringify(localOrders));
                    }
                }
            });
        }

        if (notifsSnap && notifsSnap.val()) {
            const cloudNotifs = Object.values(notifsSnap.val()).reverse();
            localStorage.setItem('confort_admin_notifications', JSON.stringify(cloudNotifs));
        }
    } catch (e) {
        console.warn('Sincronización inicial Firebase:', e);
    }
};

// Iniciar sincronización de inmediato
if (typeof window !== 'undefined') {
    window.cloudSyncInitialData();
}
