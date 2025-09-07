// Mobile Navigation Handler
document.addEventListener('DOMContentLoaded', function() {
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('nav-links');
  
  if (hamburger && navLinks) {
    // Initialize ARIA state
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.classList.remove('active');
    
    hamburger.addEventListener('click', function() {
      const isExpanded = hamburger.getAttribute('aria-expanded') === 'true';
      
      // Toggle aria-expanded
      hamburger.setAttribute('aria-expanded', String(!isExpanded));
      
      // Toggle navigation visibility using 'open' class (matches CSS)
      navLinks.classList.toggle('open');
      
      // Toggle hamburger animation
      hamburger.classList.toggle('active');
    });
    
    // Close mobile menu when clicking on a link
    const navItems = navLinks.querySelectorAll('a');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        navLinks.classList.remove('open');
        hamburger.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', function(event) {
      const isClickInsideNav = navLinks.contains(event.target);
      const isClickOnHamburger = hamburger.contains(event.target);
      
      if (!isClickInsideNav && !isClickOnHamburger && navLinks.classList.contains('open')) {
        navLinks.classList.remove('open');
        hamburger.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
      }
    });
    
    // Handle window resize
    window.addEventListener('resize', function() {
      if (window.innerWidth > 768) {
        // Desktop view - ensure menu is visible as per CSS; remove mobile state
        navLinks.classList.remove('open');
        hamburger.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
      } else {
        // Mobile view - keep menu closed by default
        navLinks.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.classList.remove('active');
      }
    });
    
    // Prevent menu from hiding on scroll (mobile)
    let lastScrollTop = 0;
    window.addEventListener('scroll', function() {
      if (window.innerWidth <= 768) {
        const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Only prevent hiding if menu is currently open
        if (navLinks.classList.contains('open')) {
          // Keep menu open until user clicks outside or on hamburger
          return;
        }
        
        lastScrollTop = currentScrollTop;
      }
    });
    
    // Add scroll behavior to keep navbar visible
    let ticking = false;
    function updateNavbarOnScroll() {
      const navbar = document.querySelector('.navbar');
      if (navbar) {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > 100) {
          navbar.style.position = 'fixed';
          navbar.style.top = '0';
          navbar.style.width = '100%';
          navbar.style.zIndex = '1000';
          navbar.style.backdropFilter = 'blur(10px)';
          navbar.style.backgroundColor = 'rgba(15, 23, 42, 0.8)';
        } else {
          navbar.style.position = 'relative';
          navbar.style.backdropFilter = 'none';
          navbar.style.backgroundColor = 'transparent';
        }
      }
      ticking = false;
    }
    
    function requestTick() {
      if (!ticking) {
        requestAnimationFrame(updateNavbarOnScroll);
        ticking = true;
      }
    }
    
    window.addEventListener('scroll', requestTick);
  }
});
