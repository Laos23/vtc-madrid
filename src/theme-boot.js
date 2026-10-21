// Aplica el último tema guardado antes de pintar para evitar un destello claro en el modo oscuro.
// La preferencia real vive en la cuenta (IndexedDB); esto es solo una caché.
try { if (localStorage.getItem('vtc-theme') === 'dark') document.documentElement.dataset.theme = 'dark'; } catch {}
