// NOTIFICHE TOAST
export function showToast(message, isError = false) {
  const toast = document.getElementById('saveToast');
  toast.textContent = message;

  if (isError) {
    toast.style.backgroundColor = 'var(--danger-color)';
    toast.style.color = '#ffffff';
  } else {
    toast.style.backgroundColor = 'var(--text-primary)';
    toast.style.color = 'var(--bg-color)';
  }

  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}
