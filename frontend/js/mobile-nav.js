// Mobile Navigation Handler
document.addEventListener('DOMContentLoaded', function() {
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('nav-links');
  
  if (hamburger && navLinks) {
    // Initialize mobile menu as visible on mobile
    if (window.innerWidth <= 768) {
      navLinks.classList.remove('hidden');
      hamburger.setAttribute('aria-expanded', 'true');
      hamburger.classList.add('active');
    }
    
    hamburger.addEventListener('click', function() {
      const isExpanded = hamburger.getAttribute('aria-expanded') === 'true';
      
      // Toggle aria-expanded
      hamburger.setAttribute('aria-expanded', !isExpanded);
      
      // Toggle navigation visibility
      navLinks.classList.toggle('hidden');
      
      // Toggle hamburger animation
      hamburger.classList.toggle('active');
    });
    
    // Close mobile menu when clicking on a link
    const navItems = navLinks.querySelectorAll('a');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        navLinks.classList.add('hidden');
        hamburger.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', function(event) {
      const isClickInsideNav = navLinks.contains(event.target);
      const isClickOnHamburger = hamburger.contains(event.target);
      
      if (!isClickInsideNav && !isClickOnHamburger && !navLinks.classList.contains('hidden')) {
        navLinks.classList.add('hidden');
        hamburger.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
      }
    });
    
    // Handle window resize
    window.addEventListener('resize', function() {
      if (window.innerWidth > 768) {
        // Desktop view - remove mobile classes
        navLinks.classList.remove('hidden');
        hamburger.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
      } else {
        // Mobile view - ensure menu is visible by default
        if (!navLinks.classList.contains('hidden')) {
          navLinks.classList.remove('hidden');
          hamburger.setAttribute('aria-expanded', 'true');
          hamburger.classList.add('active');
        }
      }
    });
  }
});
