// ============================================
//  ЭКРАН ВХОДА
// ============================================

const LOGIN_STORAGE_KEY = 'zk_user_session';

let enteredCode = '';
let isChecking = false;

function isLoggedIn() {
  const raw = localStorage.getItem(LOGIN_STORAGE_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    return !!data.code;
  } catch {
    return false;
  }
}

function getCurrentUser() {
  const raw = localStorage.getItem(LOGIN_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveUserSession(user) {
  localStorage.setItem(LOGIN_STORAGE_KEY, JSON.stringify(user));
}

function clearUserSession() {
  localStorage.removeItem(LOGIN_STORAGE_KEY);
}

function updateCodeDots() {
  const dots = document.querySelectorAll('.code-dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('filled', i < enteredCode.length);
  });
}

function showLoginError(msg) {
  const errEl = document.getElementById('login-error');
  if (errEl) errEl.textContent = msg;
}

async function checkCode(code) {
  isChecking = true;
  showLoginError('Проверка...');

  // Проверяем, что db вообще существует
  if (!window.db) {
    showLoginError('Нет подключения к базе');
    isChecking = false;
    enteredCode = '';
    updateCodeDots();
    return;
  }

  try {
    const { data, error } = await window.db
      .from('users')
      .select('*')
      .eq('code', code);

    // Показываем сырой ответ для отладки
    if (error) {
      showLoginError('Ошибка: ' + error.message);
      isChecking = false;
      enteredCode = '';
      updateCodeDots();
      return;
    }

    if (!data || data.length === 0) {
      showLoginError('Код не найден в базе');
      enteredCode = '';
      updateCodeDots();
      shakeCodeBox();
      isChecking = false;
      return;
    }

    // Нашли
    const user = data[0];
    saveUserSession({
      id: user.id,
      name: user.name,
      role: user.role,
      code: user.code
    });

    if (typeof window.onLoginSuccess === 'function') {
      window.onLoginSuccess();
    }
  } catch (e) {
    showLoginError('Исключение: ' + (e.message || 'неизвестно'));
    enteredCode = '';
    updateCodeDots();
    isChecking = false;
  }
}

function shakeCodeBox() {
  const box = document.querySelector('.code-box');
  if (!box) return;
  box.classList.add('shake');
  setTimeout(() => box.classList.remove('shake'), 400);
}

function pressDigit(d) {
  if (isChecking) return;
  if (enteredCode.length >= 4) return;
  enteredCode += d;
  updateCodeDots();
  showLoginError('');

  if (enteredCode.length === 4) {
    setTimeout(() => checkCode(enteredCode), 150);
  }
}

function pressBackspace() {
  if (isChecking) return;
  if (enteredCode.length === 0) return;
  enteredCode = enteredCode.slice(0, -1);
  updateCodeDots();
}

function initLoginScreen() {
  const pad = document.getElementById('pin-pad');
  if (!pad) return;

  pad.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const digit = btn.dataset.digit;
    const action = btn.dataset.action;

    if (digit !== undefined) pressDigit(digit);
    else if (action === 'back') pressBackspace();
  });

  document.addEventListener('keydown', (e) => {
    const loginScreen = document.getElementById('login-screen');
    if (!loginScreen || loginScreen.classList.contains('hidden')) return;
    if (e.key >= '0' && e.key <= '9') pressDigit(e.key);
    else if (e.key === 'Backspace') pressBackspace();
  });

  updateCodeDots();
}