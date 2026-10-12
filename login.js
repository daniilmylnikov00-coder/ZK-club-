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
  const errEl = document.getElementById('login-error');
  if (errEl) errEl.textContent = '';
}

async function checkCode(code) {
  isChecking = true;
  const errEl = document.getElementById('login-error');
  try {
    const { data, error } = await window.db
      .from('users')
      .select('*')
      .eq('code', code)
      .single();

    if (error || !data) {
      errEl.textContent = 'Неверный код';
      enteredCode = '';
      updateCodeDots();
      // тряска
      const box = document.querySelector('.code-box');
      box.classList.add('shake');
      setTimeout(() => box.classList.remove('shake'), 400);
      isChecking = false;
      return;
    }

    // Успешно — сохраняем сессию
    saveUserSession({
      id: data.id,
      name: data.name,
      role: data.role,
      code: data.code
    });

    // Запускаем приложение
    if (typeof window.onLoginSuccess === 'function') {
      window.onLoginSuccess();
    }
  } catch (e) {
    errEl.textContent = 'Ошибка сети';
    enteredCode = '';
    updateCodeDots();
    isChecking = false;
  }
}

// ============ Обработка клавиатуры ============
function pressDigit(d) {
  if (isChecking) return;
  if (enteredCode.length >= 4) return;
  enteredCode += d;
  updateCodeDots();

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

// ============ Инициализация экрана входа ============
function initLoginScreen() {
  const pad = document.getElementById('pin-pad');
  if (!pad) return;

  pad.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const digit = btn.dataset.digit;
    const action = btn.dataset.action;

    if (digit !== undefined) {
      pressDigit(digit);
    } else if (action === 'back') {
      pressBackspace();
    }
  });

  // Физическая клавиатура (для тестов на ПК)
  document.addEventListener('keydown', (e) => {
    const loginScreen = document.getElementById('login-screen');
    if (!loginScreen || loginScreen.classList.contains('hidden')) return;

    if (e.key >= '0' && e.key <= '9') {
      pressDigit(e.key);
    } else if (e.key === 'Backspace') {
      pressBackspace();
    }
  });

  updateCodeDots();
}