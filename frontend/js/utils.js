// Hamburger toggle
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('nav-links');
if (hamburger) {
  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });
}
// Show Dashboard link if JWT exists
const token = localStorage.getItem('token');
if (token) {
  const loginLink = document.getElementById('login-link');
  const dashLink  = document.getElementById('dashboard-link');
  if (loginLink) loginLink.classList.add('hidden');
  if (dashLink)  dashLink.classList.remove('hidden');
}

// Logo Slider Enhancement
document.addEventListener('DOMContentLoaded', function() {
  const logoSlider = document.querySelector('.logo-slider');
  const logoTrack = document.querySelector('.logo-track');
  
  if (logoSlider && logoTrack) {
    // Add touch/swipe support for mobile
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    
    logoSlider.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      isDragging = true;
      logoTrack.style.animationPlayState = 'paused';
    });
    
    logoSlider.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      currentX = e.touches[0].clientX;
      const diff = startX - currentX;
      logoTrack.style.transform = `translateX(-${diff}px)`;
    });
    
    logoSlider.addEventListener('touchend', () => {
      isDragging = false;
      logoTrack.style.transform = '';
      logoTrack.style.animationPlayState = 'running';
    });
    
    // Add mouse drag support for desktop
    logoSlider.addEventListener('mousedown', (e) => {
      startX = e.clientX;
      isDragging = true;
      logoTrack.style.animationPlayState = 'paused';
      logoSlider.style.cursor = 'grabbing';
    });
    
    logoSlider.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      currentX = e.clientX;
      const diff = startX - currentX;
      logoTrack.style.transform = `translateX(-${diff}px)`;
    });
    
    logoSlider.addEventListener('mouseup', () => {
      isDragging = false;
      logoTrack.style.transform = '';
      logoTrack.style.animationPlayState = 'running';
      logoSlider.style.cursor = 'grab';
    });
    
    logoSlider.addEventListener('mouseleave', () => {
      if (isDragging) {
        isDragging = false;
        logoTrack.style.transform = '';
        logoTrack.style.animationPlayState = 'running';
        logoSlider.style.cursor = 'grab';
      }
    });
  }
});