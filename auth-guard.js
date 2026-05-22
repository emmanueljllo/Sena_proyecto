// Lógica de protección de rutas (Auth Guard)
// Se ejecuta antes de que se renderice la página
(function() {
    const isLoggedIn = localStorage.getItem('confort_user_logged_in') === 'true';
    
    // Si no está logueado, redirigimos a login inmediatamente
    if (!isLoggedIn) {
        window.location.href = 'login.html';
    }
})();
