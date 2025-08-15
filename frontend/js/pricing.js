document.querySelectorAll('[data-plan]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const plan = btn.dataset.plan;
    const token = localStorage.getItem('token');
    const res = await fetch('https://yourbackend.com/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', ...(token && { 'Authorization': `Bearer ${token}` }) },
      body: JSON.stringify({ plan })
    });
    const { url } = await res.json();
    if (url) location.href = url;
  });
});