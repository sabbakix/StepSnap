// DIALOGS PERSONALIZZATI (sostituiscono alert/confirm/prompt nativi)

export function showConfirm(message, { confirmText = 'Conferma', cancelText = 'Annulla', isDanger = false } = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    const okBtn = document.getElementById('confirmModalOk');
    const cancelBtn = document.getElementById('confirmModalCancel');

    document.getElementById('confirmModalMessage').textContent = message;
    okBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;
    okBtn.className = `btn ${isDanger ? 'btn-danger' : 'btn-primary'}`;

    modal.classList.add('active');
    setTimeout(() => okBtn.focus(), 50);

    const cleanup = (result) => {
      modal.classList.remove('active');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      document.removeEventListener('keydown', onKeydown);
      modal.removeEventListener('click', onOverlay);
      resolve(result);
    };

    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onKeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); cleanup(true); }
      if (e.key === 'Escape') { e.preventDefault(); cleanup(false); }
    };
    const onOverlay = (e) => { if (e.target === modal) cleanup(false); };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    document.addEventListener('keydown', onKeydown);
    modal.addEventListener('click', onOverlay);
  });
}

export function showAlert(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('alertModal');
    const okBtn = document.getElementById('alertModalOk');

    document.getElementById('alertModalMessage').textContent = message;
    modal.classList.add('active');
    setTimeout(() => okBtn.focus(), 50);

    const cleanup = () => {
      modal.classList.remove('active');
      okBtn.removeEventListener('click', cleanup);
      document.removeEventListener('keydown', onKeydown);
      modal.removeEventListener('click', onOverlay);
      resolve();
    };

    const onKeydown = (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); cleanup(); }
    };
    const onOverlay = (e) => { if (e.target === modal) cleanup(); };

    okBtn.addEventListener('click', cleanup);
    document.addEventListener('keydown', onKeydown);
    modal.addEventListener('click', onOverlay);
  });
}

export function showPrompt() {
  return new Promise((resolve) => {
    const modal = document.getElementById('promptModal');
    const input = document.getElementById('promptModalInput');
    const okBtn = document.getElementById('promptModalOk');
    const cancelBtn = document.getElementById('promptModalCancel');

    input.value = '';
    modal.classList.add('active');
    setTimeout(() => input.focus(), 50);

    const cleanup = (value) => {
      modal.classList.remove('active');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      document.removeEventListener('keydown', onKeydown);
      modal.removeEventListener('click', onOverlay);
      resolve(value);
    };

    const onOk = () => cleanup(input.value);
    const onCancel = () => cleanup(null);
    const onKeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); cleanup(input.value); }
      if (e.key === 'Escape') { e.preventDefault(); cleanup(null); }
    };
    const onOverlay = (e) => { if (e.target === modal) cleanup(null); };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    document.addEventListener('keydown', onKeydown);
    modal.addEventListener('click', onOverlay);
  });
}

// Gestione Modale Istruzioni
export function initModals() {
  const helpModal = document.getElementById('helpModal');
  document.getElementById('btnHelp').addEventListener('click', () => {
    helpModal.classList.add('active');
  });
  document.getElementById('btnCloseHelp').addEventListener('click', () => {
    helpModal.classList.remove('active');
  });
  document.getElementById('btnConfirmCloseHelp').addEventListener('click', () => {
    helpModal.classList.remove('active');
  });
}
