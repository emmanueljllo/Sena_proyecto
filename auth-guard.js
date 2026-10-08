(function() {
    const protectedPages = ['checkout.html', 'dashboard.html', 'admin.html'];
    const currentPage = window.location.pathname.split('/').pop();
    if (!protectedPages.includes(currentPage)) return;

    document.documentElement.classList.add('auth-pending');
    fetch('api/index.php?action=me', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
        .then(async response => {
            if (!response.ok) throw new Error('No fue posible validar la sesión.');
            return response.json();
        })
        .then(session => {
            const user = session.user;
            if (!user) {
                window.location.replace('login.html');
                return;
            }
            if (currentPage === 'admin.html' && user.role !== 'admin') {
                window.location.replace('dashboard.html');
                return;
            }
            localStorage.setItem('confort_current_user', JSON.stringify(user));
            localStorage.setItem('confort_user_logged_in', 'true');
        })
        .catch(() => {
            window.location.replace('login.html?error=server');
        })
        .finally(() => document.documentElement.classList.remove('auth-pending'));
})();
