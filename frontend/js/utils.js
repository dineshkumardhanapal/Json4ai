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