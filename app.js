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
let isRendering = false;

let dirtyQuantities = {};
let dirtyUnits = {};

let unsavedAction = null;
let pendingTabSwitch = null;

let deleteTargetId = null;

let swipeState = {
  activeCard: null,
  startX: 0,
  startY: 0,
  currentX: 0,
  isDragging: false,
  lockedVertical: false
};

// ============================================
//  DOM
// ============================================
const listEl   = document.getElementById('ingredients-list');
const searchEl = document.getElementById('search-input');
const addBtn   = document.getElementById('add-btn');
const modal    = document.getElementById('modal');
const saveBtn  = document.getElementById('save-inventory-btn');

// ============================================
//  ПРАВА
// ============================================
function canEdit() {
  if (!currentUser) return false;
  return currentUser.name === 'Даниил';
}

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

    dirtyQuantities = {};
    dirtyUnits = {};

    updateSaveButton();
    render();
  } catch (e) {
    console.error('Ошибка сети:', e);
  }
}

// ============================================
//  НЕСОХРАНЁННЫЕ
// ============================================
function hasUnsavedChanges() {
  return Object.keys(dirtyQuantities).length > 0 || Object.keys(dirtyUnits).length > 0;
}

// ============================================
//  СОХРАНЕНИЕ
// ============================================
async function saveChanges() {
  const idsToUpdate = new Set([
    ...Object.keys(dirtyQuantities),
    ...Object.keys(dirtyUnits)
  ]);

  if (idsToUpdate.size === 0) return;

  const now = new Date().toISOString();

  for (const id of idsToUpdate) {
    const update = { updated_at: now };

    if (dirtyQuantities[id] !== undefined) {
      update.quantity = dirtyQuantities[id];
    }
    if (dirtyUnits[id] !== undefined) {
      update.unit = dirtyUnits[id];
    }

    const { error } = await window.db
      .from('ingredients')
      .update(update)
      .eq('id', id);

    if (error) {
      console.error('Ошибка сохранения:', error);
      alert('Не удалось сохранить изменения');
      return;
    }
  }

  ingredients.forEach(item => {
    if (dirtyQuantities[item.id] !== undefined) {
      item.quantity = dirtyQuantities[item.id];
    }
    if (dirtyUnits[item.id] !== undefined) {
      item.unit = dirtyUnits[item.id];
    }
  });

  dirtyQuantities = {};
  dirtyUnits = {};

  updateSaveButton();
  render();

  if (saveBtn) {
    saveBtn.textContent = '✓ Сохранено';
    saveBtn.classList.add('saved');
    setTimeout(() => {
      saveBtn.textContent = 'Сохранить';
      saveBtn.classList.remove('saved');
      updateSaveButton();
    }, 1500);
  }
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

  const activeEl = document.activeElement;
  const activeId = activeEl && activeEl.dataset ? activeEl.dataset.id : null;
  const activeClass = activeEl && activeEl.classList.contains('qty-input') ? 'qty'
                    : (activeEl && activeEl.classList.contains('unit-select') ? 'unit' : null);
  const selStart = activeEl && activeEl.selectionStart !== undefined ? activeEl.selectionStart : null;

  const canSwipe = canEdit();

  listEl.innerHTML = filtered.map(item => {
    const isLow = item.min_qty > 0 && item.quantity <= item.min_qty;
    const isDirtyQty = dirtyQuantities[item.id] !== undefined;
    const isDirtyUnit = dirtyUnits[item.id] !== undefined;
    const isDirty = isDirtyQty || isDirtyUnit;

    const qtyValue = isDirtyQty
      ? (item.unit === 'kg' || item.unit === 'l' ? dirtyQuantities[item.id] / 1000 : dirtyQuantities[item.id])
      : displayQty(item).replace(/\s(кг|г|мл|л|шт)$/, '');

    const displayUnit = isDirtyUnit ? dirtyUnits[item.id] : item.unit;

    return `
      <div class="ingredient-card${isLow ? ' low' : ''}${isDirty ? ' dirty' : ''}" data-id="${item.id}">
        ${canSwipe ? `
        <div class="ingredient-swipe-actions">
          <button class="swipe-btn swipe-btn-edit" data-act="edit" data-id="${item.id}">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M4 20h4l10-10-4-4L4 16v4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
              <path d="M14 6l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <span>Изменить</span>
          </button>
          <button class="swipe-btn swipe-btn-delete" data-act="delete" data-id="${item.id}">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M10 7V4a1 1 0 011-1h2a1 1 0 011 1v3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Удалить</span>
          </button>
        </div>
        ` : ''}
        <div class="ingredient-card-inner">
          <div class="ingredient-info">
            <div class="ingredient-name">${escapeHtml(item.name)}</div>
            <div class="ingredient-category">${escapeHtml(item.category)}</div>
          </div>
          <div class="qty-input-wrap">
            <input
              type="text"
              inputmode="decimal"
              class="qty-input${isLow ? ' low' : ''}${isDirtyQty ? ' dirty' : ''}"
              data-id="${item.id}"
              value="${qtyValue}"
              placeholder="0"
            >
            <select class="unit-select${isDirtyUnit ? ' dirty' : ''}" data-id="${item.id}">
              <option value="g"  ${displayUnit === 'g'   ? 'selected' : ''}>г</option>
              <option value="kg" ${displayUnit === 'kg'  ? 'selected' : ''}>кг</option>
              <option value="ml" ${displayUnit === 'ml'  ? 'selected' : ''}>мл</option>
              <option value="l"  ${displayUnit === 'l'   ? 'selected' : ''}>л</option>
              <option value="pcs"${displayUnit === 'pcs' ? 'selected' : ''}>шт</option>
            </select>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (activeId && activeClass) {
    const selector = activeClass === 'qty'
      ? `.qty-input[data-id="${activeId}"]`
      : `.unit-select[data-id="${activeId}"]`;
    const el = listEl.querySelector(selector);
    if (el) {
      el.focus();
      if (selStart !== null && el.setSelectionRange) {
        try { el.setSelectionRange(selStart, selStart); } catch (e) {}
      }
    }
  }

  isRendering = false;
}

function updateSaveButton() {
  if (!saveBtn) return;
  if (hasUnsavedChanges()) {
    saveBtn.classList.add('active');
    saveBtn.disabled = false;
  } else {
    saveBtn.classList.remove('active');
    saveBtn.disabled = true;
  }
}

// ============================================
//  МОДАЛКА: НЕСОХРАНЁННЫЕ
// ============================================
function openUnsavedModal(action) {
  unsavedAction = action;
  const m = document.getElementById('unsaved-modal');
  if (m) m.classList.remove('hidden');
}

function closeUnsavedModal() {
  unsavedAction = null;
  pendingTabSwitch = null;
  const m = document.getElementById('unsaved-modal');
  if (m) m.classList.add('hidden');
}

(function bindUnsavedModal() {
  const m = document.getElementById('unsaved-modal');
  if (!m || m.dataset.bound) return;
  m.dataset.bound = '1';

  const cancelBtn = document.getElementById('unsaved-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      dirtyQuantities = {};
      dirtyUnits = {};
      updateSaveButton();
      render();

      const action = unsavedAction;
      const tab = pendingTabSwitch;
      closeUnsavedModal();

      if (action === 'logout') {
        doLogout();
      } else if (action === 'switch' && tab) {
        switchTab(tab);
      }
    });
  }

  const saveBtnU = document.getElementById('unsaved-save');
  if (saveBtnU) {
    saveBtnU.addEventListener('click', async () => {
      await saveChanges();

      const action = unsavedAction;
      const tab = pendingTabSwitch;
      closeUnsavedModal();

      if (action === 'logout') {
        doLogout();
      } else if (action === 'switch' && tab) {
        switchTab(tab);
      }
    });
  }

  m.addEventListener('click', (e) => {
    if (e.target === m) closeUnsavedModal();
  });
})();

// ============================================
//  МОДАЛКА: УДАЛЕНИЕ
// ============================================
function openDeleteModal(id) {
  const item = ingredients.find(i => i.id === id);
  if (!item) return;

  deleteTargetId = id;
  const textEl = document.getElementById('delete-text');
  if (textEl) {
    textEl.textContent = `«${item.name}» будет удалён из склада. Это действие нельзя отменить.`;
  }
  const m = document.getElementById('delete-confirm-modal');
  if (m) m.classList.remove('hidden');
}

function closeDeleteModal() {
  deleteTargetId = null;
  const m = document.getElementById('delete-confirm-modal');
  if (m) m.classList.add('hidden');
}

async function confirmDelete() {
  if (!deleteTargetId) return;
  const id = deleteTargetId;

  const { error } = await window.db
    .from('ingredients')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Ошибка удаления:', error);
    alert('Не удалось удалить');
    closeDeleteModal();
    return;
  }

  ingredients = ingredients.filter(i => i.id !== id);
  delete dirtyQuantities[id];
  delete dirtyUnits[id];

  closeDeleteModal();
  updateSaveButton();
  render();
}

(function bindDeleteModal() {
  const m = document.getElementById('delete-confirm-modal');
  if (!m || m.dataset.bound) return;
  m.dataset.bound = '1';

  document.getElementById('delete-cancel')?.addEventListener('click', closeDeleteModal);
  document.getElementById('delete-confirm')?.addEventListener('click', confirmDelete);

  m.addEventListener('click', (e) => {
    if (e.target === m) closeDeleteModal();
  });
})();

// ============================================
//  СВАЙП
// ============================================
function closeAllSwipes() {
  listEl.querySelectorAll('.ingredient-card.swiped').forEach(c => {
    c.classList.remove('swiped');
  });
  swipeState.activeCard = null;
}

listEl.addEventListener('touchstart', (e) => {
  if (!canEdit()) return;

  const card = e.target.closest('.ingredient-card');
  if (!card) return;

  if (e.target.closest('.qty-input-wrap')) return;
  if (e.target.closest('.ingredient-swipe-actions')) return;

  if (hasUnsavedChanges()) return;

  const touch = e.touches[0];
  swipeState.startX = touch.clientX;
  swipeState.startY = touch.clientY;
  swipeState.currentX = touch.clientX;
  swipeState.activeCard = card;
  swipeState.isDragging = false;
  swipeState.lockedVertical = false;
}, { passive: true });

listEl.addEventListener('touchmove', (e) => {
  if (!swipeState.activeCard) return;

  const touch = e.touches[0];
  const dx = touch.clientX - swipeState.startX;
  const dy = touch.clientY - swipeState.startY;

  if (!swipeState.lockedVertical) {
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
      swipeState.activeCard = null;
      return;
    }
    if (Math.abs(dx) > 10) {
      swipeState.lockedVertical = true;
      swipeState.isDragging = true;
    }
  }

  if (!swipeState.isDragging) return;

  const inner = swipeState.activeCard.querySelector('.ingredient-card-inner');
  if (!inner) return;

  let offset = Math.min(0, Math.max(-168, dx));

  if (swipeState.activeCard.classList.contains('swiped')) {
    offset = Math.min(0, Math.max(-168, -168 + dx));
  }

  inner.style.transition = 'none';
  inner.style.transform = `translateX(${offset}px)`;
}, { passive: true });

listEl.addEventListener('touchend', (e) => {
  if (!swipeState.activeCard) return;

  const card = swipeState.activeCard;
  const inner = card.querySelector('.ingredient-card-inner');
  swipeState.activeCard = null;

  if (!swipeState.isDragging) {
    closeAllSwipes();
    return;
  }

  const touch = e.changedTouches[0];
  const dx = touch.clientX - swipeState.startX;
  const wasSwiped = card.classList.contains('swiped');

  if (inner) {
    inner.style.transition = '';
    inner.style.transform = '';
  }

  const THRESHOLD = 40;

  if (wasSwiped) {
    if (dx > THRESHOLD) {
      card.classList.remove('swiped');
    } else {
      card.classList.add('swiped');
    }
  } else {
    if (dx < -THRESHOLD) {
      closeAllSwipes();
      card.classList.add('swiped');
    } else {
      card.classList.remove('swiped');
    }
  }

  swipeState.isDragging = false;
  swipeState.lockedVertical = false;
}, { passive: true });

listEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.swipe-btn');
  if (!btn) return;

  const act = btn.dataset.act;
  const id = btn.dataset.id;
  closeAllSwipes();

  if (act === 'edit') {
    openEdit(id);
  } else if (act === 'delete') {
    openDeleteModal(id);
  }
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.ingredient-card')) {
    closeAllSwipes();
  }
});

// ============================================
//  СОБЫТИЯ СПИСКА
// ============================================
if (searchEl) {
  searchEl.addEventListener('input', e => {
    filterText = e.target.value.toLowerCase().trim();
    render();
  });
}

listEl.addEventListener('input', e => {
  const input = e.target.closest('.qty-input');
  if (!input) return;

  const id = input.dataset.id;
  const item = ingredients.find(i => i.id === id);
  if (!item) return;

  const raw = input.value.replace(',', '.').replace(/[^\d.\-]/g, '');
  const num = parseFloat(raw) || 0;

  const currentUnit = dirtyUnits[id] || item.unit;
  let baseQty;
  if (currentUnit === 'kg' || currentUnit === 'l') {
    baseQty = num * 1000;
  } else {
    baseQty = num;
  }

  dirtyQuantities[id] = baseQty;
  input.classList.add('dirty');
  const card = input.closest('.ingredient-card');
  if (card) card.classList.add('dirty');
  updateSaveButton();
});

listEl.addEventListener('change', e => {
  const select = e.target.closest('.unit-select');
  if (!select) return;

  const id = select.dataset.id;
  const item = ingredients.find(i => i.id === id);
  if (!item) return;

  dirtyUnits[id] = select.value;
  select.classList.add('dirty');
  const card = select.closest('.ingredient-card');
  if (card) card.classList.add('dirty');
  updateSaveButton();
});

listEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.closest('.qty-input')) {
    e.target.blur();
  }
});

if (addBtn) {
  addBtn.addEventListener('click', () => openEdit(null));
}

if (saveBtn) {
  saveBtn.addEventListener('click', saveChanges);
}

listEl.addEventListener('contextmenu', e => {
  const card = e.target.closest('.ingredient-card');
  if (!card) return;
  if (e.target.closest('.qty-input-wrap')) return;
  if (!canEdit()) return;
  e.preventDefault();
  openEdit(card.dataset.id);
});

// ============================================
//  МОДАЛКА РЕДАКТИРОВАНИЯ
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

  if (error) {
    console.error('Ошибка сохранения:', error);
    alert('Не удалось сохранить');
    return;
  }

  delete dirtyQuantities[item.id];
  delete dirtyUnits[item.id];

  modal.classList.add('hidden');
  editingId = null;

  updateSaveButton();
  render();
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

  if (saveBtn) {
    if (tab === 'inventory') saveBtn.style.display = '';
    else saveBtn.style.display = 'none';
  }
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const targetBtn = document.querySelector('.tab-btn[data-tab="' + tab + '"]');
  if (targetBtn) targetBtn.classList.add('active');

  document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));
  const targetView = document.getElementById('tab-' + tab);
  if (targetView) targetView.classList.add('active');

  const content = document.querySelector('.content');
  if (content) content.scrollTop = 0;

  updateFabVisibility(tab);
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    const currentTab = document.querySelector('.tab-btn.active')?.dataset.tab;

    if (currentTab === 'inventory' && tab !== 'inventory' && hasUnsavedChanges()) {
      pendingTabSwitch = tab;
      openUnsavedModal('switch');
      return;
    }

    switchTab(tab);
  });
});

// ============================================
//  ВЫХОД
// ============================================
function logout() {
  if (hasUnsavedChanges()) {
    openUnsavedModal('logout');
    return;
  }
  doLogout();
}

function doLogout() {
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

  const nameEl = document.getElementById('user-name-display');
  if (nameEl && currentUser) {
    nameEl.textContent = currentUser.name;
  }

  if (typeof initTechcards === 'function') initTechcards();
  if (typeof initChat === 'function') initChat();
  if (typeof initShift === 'function') initShift();
  if (typeof initCooking === 'function') initCooking();
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