document.querySelectorAll('[data-plan]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const plan = btn.dataset.plan;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('https://json4ai.onrender.com/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', ...(token && { 'Authorization': `Bearer ${token}` }) },
        body: JSON.stringify({ plan })
      });
      const data = await res.json();
      const url = data && data.url;
      if (url) {
        location.href = url;
      } else {
        showError('Unable to start checkout.');
      }
    } catch (_) {
      showError('Checkout unavailable. Please try again later.');
    }
  });
});