// Lógica de protección de rutas (Auth Guard)
// Se ejecuta antes de que se renderice la página
(function() {
    const protectedPages = ['checkout.html', 'dashboard.html', 'admin.html'];
    const currentPage = window.location.pathname.split('/').pop();
    if (!protectedPages.includes(currentPage)) return;

    const isLoggedIn = localStorage.getItem('confort_user_logged_in') === 'true';
    if (!isLoggedIn) {
        window.location.href = 'login.html';
        return;
    }

    const currentUser = JSON.parse(localStorage.getItem('confort_current_user')) || null;
    if (!currentUser || !currentUser.email) {
        localStorage.setItem('confort_user_logged_in', 'false');
        window.location.href = 'login.html';
        return;
    }

    if (currentPage === 'admin.html' && currentUser.role !== 'admin') {
        window.location.href = 'dashboard.html';
    }
})();
