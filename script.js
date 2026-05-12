document.addEventListener('DOMContentLoaded', () => {
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
});
