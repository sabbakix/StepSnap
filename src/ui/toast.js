// NOTIFICHE TOAST
let toastTimeout = null;

export function showToast(message, isError = false, { actionText = null, onAction = null, duration = 2500 } = {}) {
  const toast = document.getElementById('saveToast');
  toast.innerHTML = '';
  toast.appendChild(document.createTextNode(message));

  if (isError) {
    toast.style.backgroundColor = 'var(--danger-color)';
    toast.style.color = '#ffffff';
  } else {
    toast.style.backgroundColor = 'var(--text-primary)';
    toast.style.color = 'var(--bg-color)';
  }

  const hasAction = Boolean(actionText && onAction);
  if (hasAction) {
    const btn = document.createElement('button');
    btn.className = 'toast-action-btn';
    btn.textContent = actionText;
    btn.addEventListener('click', () => {
      hideToast();
      onAction();
    });
    toast.appendChild(btn);
  }

  toast.classList.add('show');

  // Con un'azione disponibile il toast resta visibile più a lungo
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(hideToast, hasAction ? Math.max(duration, 5000) : duration);
}

function hideToast() {
  clearTimeout(toastTimeout);
  document.getElementById('saveToast').classList.remove('show');
}
