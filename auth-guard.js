(function () {
    const protectedPages = ['checkout.html', 'dashboard.html', 'admin.html'];
    const currentPage = window.location.pathname.split('/').pop();
    if (!protectedPages.includes(currentPage)) return;

    const redirectToLogin = () => {
        localStorage.removeItem('confort_current_user');
        localStorage.removeItem('confort_user_logged_in');
        window.location.replace('login.html');
    };

    if (typeof firebase === 'undefined' || !firebase.apps.length || !firebase.auth) {
        redirectToLogin();
        return;
    }

    firebase.auth().onAuthStateChanged(async user => {
        if (!user) {
            redirectToLogin();
            return;
        }

        try {
            const token = await user.getIdTokenResult();
            const isAdmin = token.claims.admin === true || token.claims.role === 'admin';
            if (currentPage === 'admin.html' && !isAdmin) {
                window.location.replace('dashboard.html');
                return;
            }

            localStorage.setItem('confort_current_user', JSON.stringify({
                uid: user.uid,
                email: user.email,
                username: user.displayName || user.email,
                role: isAdmin ? 'admin' : 'cliente',
                loginAt: user.metadata.lastSignInTime || new Date().toISOString()
            }));
            localStorage.setItem('confort_user_logged_in', 'true');
            document.documentElement.classList.remove('auth-pending');
        } catch (error) {
            console.error('No se pudo validar la sesión autenticada:', error);
            redirectToLogin();
        }
    }, error => {
        console.error('No se pudo consultar el estado de autenticación:', error);
        redirectToLogin();
    });
})();
