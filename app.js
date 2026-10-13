// ============================================
//  ФИКС ВЫСОТЫ ЭКРАНА (iOS PWA — убирает щель снизу)
// ============================================
function setRealHeight() {
  const h = window.innerHeight;
  document.documentElement.style.setProperty('--app-height', h + 'px');
  document.body.style.height = h + 'px';
}

window.addEventListener('resize', setRealHeight);
window.addEventListener('orientationchange', setRealHeight);
window.addEventListener('load', setRealHeight);
setTimeout(setRealHeight, 50);
setTimeout(setRealHeight, 300);
setTimeout(setRealHeight, 1000);
setRealHeight();

// ============================================
//  ПОДКЛЮЧЕНИЕ К SUPABASE
// ============================================
const { createClient } = supabase;
window.db = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

// ============================================
//  СОСТОЯНИЕ
// ============================================
let ingredients = [];
let currentUser = null;
let filterText = '';
let syncTimer = null;
let isRendering = false;

// ============================================
//  DOM
// ============================================
const listEl   = document.getElementById('ingredients-list');
const searchEl = document.getElementById('search-input');
const addBtn   = document.getElementById('add-btn');
const modal    = document.getElementById('modal');

// ============================================
//  ЗАГРУЗКА ИЗ SUPABASE
// ============================================
async function loadFromServer() {
  try {
    const { data, error } = await window.db
      .from('ingredients')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Ошибка загрузки:', error);
      return;
    }
    ingredients = data || [];
    render();
  } catch (e) {
    console.error('Ошибка сети:', e);
  }
}

// ============================================
//  СОХРАНЕНИЕ ИНГРЕДИЕНТА
// ============================================
async function saveIngredient(item) {
  const payload = {
    id: item.id,
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    unit: item.unit,
    min_qty: item.min_qty,
    updated_at: new Date().toISOString()
  };

  const { error } = await window.db
    .from('ingredients')
    .upsert(payload, { onConflict: 'id' });

  if (error) console.error('Ошибка сохранения:', error);
}

// Обновление одного поля
async function updateIngredientField(id, field, value) {
  const update = { updated_at: new Date().toISOString() };
  update[field] = value;

  const { error } = await window.db
    .from('ingredients')
    .update(update)
    .eq('id', id);

  if (error) console.error('Ошибка обновления:', error);
}

// ============================================
//  ОТОБРАЖЕНИЕ
// ============================================
function niceNum(n) {
  if (n === 0) return '0';
  const rounded = Math.round(n * 1000) / 1000;
  return rounded.toString().replace('.', ',');
}

function displayQty(item) {
  const q = item.quantity;
  if (item.unit === 'kg')  return niceNum(q / 1000) + ' кг';
  if (item.unit === 'l')   return niceNum(q / 1000) + ' л';
  if (item.unit === 'ml')  return niceNum(q) + ' мл';
  if (item.unit === 'pcs') return niceNum(q) + ' шт';
  return niceNum(q) + ' г';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function render() {
  if (isRendering) return;
  isRendering = true;

  const filtered = ingredients.filter(i =>
    i.name.toLowerCase().includes(filterText)
  );

  filtered.sort((a, b) => {
    const aLow = a.min_qty > 0 && a.quantity <= a.min_qty;
    const bLow = b.min_qty > 0 && b.quantity <= b.min_qty;
    if (aLow !== bLow) return aLow ? -1 : 1;
    if (a.category !== b.category) return a.category.localeCompare(b.category, 'ru');
    return a.name.localeCompare(b.name, 'ru');
  });

  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="empty-state">Ничего не найдено</div>';
    isRendering = false;
    return;
  }

  listEl.innerHTML = filtered.map(item => {
    const isLow = item.min_qty > 0 && item.quantity <= item.min_qty;
    return `
      <div class="ingredient-card${isLow ? ' low' : ''}" data-id="${item.id}">
        <div class="ingredient-info">
          <div class="ingredient-name">${escapeHtml(item.name)}</div>
          <div class="ingredient-category">${escapeHtml(item.category)}</div>
        </div>
        <div class="qty-input-wrap">
          <input
            type="text"
            inputmode="decimal"
            class="qty-input${isLow ? ' low' : ''}"
            data-id="${item.id}"
            value="${displayQty(item).replace(/\s(кг|г|мл|л|шт)$/, '')}"
            placeholder="0"
          >
          <select class="unit-select" data-id="${item.id}">
            <option value="g"  ${item.unit === 'g'   ? 'selected' : ''}>г</option>
            <option value="kg" ${item.unit === 'kg'  ? 'selected' : ''}>кг</option>
            <option value="ml" ${item.unit === 'ml'  ? 'selected' : ''}>мл</option>
            <option value="l"  ${item.unit === 'l'   ? 'selected' : ''}>л</option>
            <option value="pcs"${item.unit === 'pcs' ? 'selected' : ''}>шт</option>
          </select>
        </div>
      </div>
    `;
  }).join('');

  isRendering = false;
}

// ============================================
//  СОБЫТИЯ СПИСКА
// ============================================

// Поиск
if (searchEl) {
  searchEl.addEventListener('input', e => {
    filterText = e.target.value.toLowerCase().trim();
    render();
  });
}

// Изменение количества / единицы
listEl.addEventListener('change', async e => {
  const input = e.target.closest('.qty-input');
  const select = e.target.closest('.unit-select');

  if (input) {
    const id = input.dataset.id;
    const item = ingredients.find(i => i.id === id);
    if (!item) return;

    const raw = input.value.replace(',', '.').replace(/[^\d.\-]/g, '');
    const num = parseFloat(raw) || 0;

    let baseQty;
    if (item.unit === 'kg' || item.unit === 'l') {
      baseQty = num * 1000;
    } else {
      baseQty = num;
    }

    item.quantity = baseQty;
    await updateIngredientField(id, 'quantity', baseQty);
    render();
  }

  if (select) {
    const id = select.dataset.id;
    const item = ingredients.find(i => i.id === id);
    if (!item) return;
    item.unit = select.value;
    await updateIngredientField(id, 'unit', select.value);
    render();
  }
});

// Enter — закрыть клавиатуру
listEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.closest('.qty-input')) {
    e.target.blur();
  }
});

// FAB → добавить
if (addBtn) {
  addBtn.addEventListener('click', () => openEdit(null));
}

// Долгое нажатие — редактировать
listEl.addEventListener('contextmenu', e => {
  const card = e.target.closest('.ingredient-card');
  if (!card) return;
  if (e.target.closest('.qty-input-wrap')) return;
  e.preventDefault();
  openEdit(card.dataset.id);
});

// ============================================
//  МОДАЛКА
// ============================================
const modalTitle = document.getElementById('modal-title');
const mName     = document.getElementById('m-name');
const mCategory = document.getElementById('m-category');
const mQuantity = document.getElementById('m-quantity');
const mUnit     = document.getElementById('m-unit');
const mMin      = document.getElementById('m-min');
const mMinUnit  = document.getElementById('m-min-unit');
const catList   = document.getElementById('cat-list');

let editingId = null;

function openEdit(id) {
  editingId = id;
  const item = id ? ingredients.find(i => i.id === id) : null;

  modalTitle.textContent = item ? 'Редактировать' : 'Новый ингредиент';
  mName.value = item ? item.name : '';
  mCategory.value = item ? item.category : '';
  mUnit.value = item ? item.unit : 'kg';

  if (item) {
    const isBig = (item.unit === 'kg' || item.unit === 'l');
    const q = isBig ? item.quantity / 1000 : item.quantity;
    const mn = isBig ? item.min_qty / 1000 : item.min_qty;
    mQuantity.value = round3(q);
    mMin.value = round3(mn);
  } else {
    mQuantity.value = '';
    mMin.value = '';
  }
  updateMinUnitLabel();

  const cats = [...new Set(ingredients.map(i => i.category))].sort((a, b) => a.localeCompare(b, 'ru'));
  catList.innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">`).join('');

  modal.classList.remove('hidden');
}

function round3(n) { return Math.round(n * 1000) / 1000; }

function updateMinUnitLabel() {
  const map = { g: 'г', kg: 'кг', ml: 'мл', l: 'л', pcs: 'шт' };
  mMinUnit.textContent = map[mUnit.value] || 'г';
}

if (mUnit) mUnit.addEventListener('change', updateMinUnitLabel);

document.getElementById('modal-cancel')?.addEventListener('click', () => {
  modal.classList.add('hidden');
  editingId = null;
});

document.getElementById('modal-save')?.addEventListener('click', async () => {
  const name     = mName.value.trim();
  const category = mCategory.value.trim() || 'Прочее';
  const qty      = parseFloat(mQuantity.value) || 0;
  const min      = parseFloat(mMin.value) || 0;
  const unit     = mUnit.value;

  if (!name) { alert('Введите название'); return; }

  const isBig = (unit === 'kg' || unit === 'l');
  const qtyBase = isBig ? qty * 1000 : qty;
  const minBase = isBig ? min * 1000 : min;

  let item;
  if (editingId) {
    item = ingredients.find(i => i.id === editingId);
    if (item) {
      item.name = name;
      item.category = category;
      item.quantity = qtyBase;
      item.min_qty = minBase;
      item.unit = unit;
    }
  } else {
    item = {
      id: Date.now().toString(),
      name, category,
      quantity: qtyBase,
      min_qty: minBase,
      unit
    };
    ingredients.push(item);
  }

  await saveIngredient(item);
  render();
  modal.classList.add('hidden');
  editingId = null;
});

modal?.addEventListener('click', e => {
  if (e.target === modal) {
    modal.classList.add('hidden');
    editingId = null;
  }
});

// ============================================
//  ТАБЫ
// ============================================
function updateFabVisibility(tab) {
  if (!addBtn) return;
  if (tab === 'inventory') addBtn.classList.remove('hidden');
  else addBtn.classList.add('hidden');
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    document.querySelector('.content').scrollTop = 0;
    updateFabVisibility(tab);
  });
});

// ============================================
//  АВТОСИНХРОНИЗАЦИЯ (каждые 3 секунды)
// ============================================
function startAutoSync() {
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = setInterval(loadFromServer, 3000);
}

// ============================================
//  ВЫХОД
// ============================================
function logout() {
  if (!confirm('Выйти из аккаунта?')) return;
  clearUserSession();
  currentUser = null;
  location.reload();
}

// ============================================
//  СТАРТ ПОСЛЕ ВХОДА
// ============================================
window.onLoginSuccess = async function() {
  currentUser = getCurrentUser();

  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');

  await loadFromServer();
  updateFabVisibility('inventory');
  startAutoSync();

  // Показываем имя пользователя в шапке
  const nameEl = document.getElementById('user-name-display');
  if (nameEl && currentUser) {
    nameEl.textContent = currentUser.name;
  }

  if (typeof initTechcards === 'function') {
    initTechcards();
  }
  if (typeof initChat === 'function') {
    initChat();
  }
};

// ============================================
//  ИНИЦИАЛИЗАЦИЯ
// ============================================
(function init() {
  if (isLoggedIn()) {
    window.onLoginSuccess();
  } else {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-screen').classList.add('hidden');
    initLoginScreen();
  }
})();