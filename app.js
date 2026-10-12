// ============================================
//  ХРАНИЛИЩЕ
//  Пока локально (localStorage на этом телефоне).
//  Позже заменим на Supabase — общий склад для всех.
// ============================================
const STORAGE_KEY = 'zk_ingredients_v2';

// Каждая позиция:
//   id       — уникальный идентификатор
//   name     — название
//   category — категория
//   quantity — количество (храним в БАЗОВЫХ единицах: г, мл, шт)
//   unit     — "g" | "kg" | "ml" | "l" | "pcs" (что показываем)
//   min      — порог «мало осталось» (в базовых единицах)

const DEFAULT_INGREDIENTS = [
  // ——— Мясо и птица ———
  { id: 'm1',  name: 'Куриное филе',            category: 'Мясо и птица', quantity: 0, min: 0, unit: 'kg' },
  { id: 'm2',  name: 'Курица для пасты',        category: 'Мясо и птица', quantity: 0, min: 0, unit: 'kg' },
  { id: 'm3',  name: 'Говядина для жаркого',    category: 'Мясо и птица', quantity: 0, min: 0, unit: 'kg' },
  { id: 'm4',  name: 'Говядина для удона',      category: 'Мясо и птица', quantity: 0, min: 0, unit: 'kg' },
  { id: 'm5',  name: 'Сосиски курица',          category: 'Мясо и птица', quantity: 0, min: 0, unit: 'kg' },
  { id: 'm6',  name: 'Сосиски говядина',        category: 'Мясо и птица', quantity: 0, min: 0, unit: 'kg' },
  { id: 'm7',  name: 'Наггетсы',                category: 'Мясо и птица', quantity: 0, min: 0, unit: 'kg' },
  { id: 'm8',  name: 'Бекон',                   category: 'Мясо и птица', quantity: 0, min: 0, unit: 'kg' },
  { id: 'm9',  name: 'Куриные крылья',          category: 'Мясо и птица', quantity: 0, min: 0, unit: 'kg' },

  // ——— Морепродукты ———
  { id: 's1',  name: 'Креветки',                category: 'Морепродукты', quantity: 0, min: 0, unit: 'kg' },
  { id: 's2',  name: 'Креветки темпура',        category: 'Морепродукты', quantity: 0, min: 0, unit: 'kg' },

  // ——— Гарниры и заморозка ———
  { id: 'g1',  name: 'Удон',                    category: 'Гарниры',      quantity: 0, min: 0, unit: 'kg' },
  { id: 'g2',  name: 'Спагетти',                category: 'Гарниры',      quantity: 0, min: 0, unit: 'kg' },
  { id: 'g3',  name: 'Феттучини',               category: 'Гарниры',      quantity: 0, min: 0, unit: 'kg' },
  { id: 'g4',  name: 'Сырные палочки',          category: 'Гарниры',      quantity: 0, min: 0, unit: 'kg' },
  { id: 'g5',  name: 'Картошка фри',            category: 'Гарниры',      quantity: 0, min: 0, unit: 'kg' },
  { id: 'g6',  name: 'Батат фри',               category: 'Гарниры',      quantity: 0, min: 0, unit: 'kg' },
  { id: 'g7',  name: 'Дольки картофельные',     category: 'Гарниры',      quantity: 0, min: 0, unit: 'kg' },

  // ——— Овощи ———
  { id: 'v1',  name: 'Помидоры',                category: 'Овощи',        quantity: 0, min: 0, unit: 'kg' },
  { id: 'v2',  name: 'Огурцы',                  category: 'Овощи',        quantity: 0, min: 0, unit: 'kg' },
  { id: 'v3',  name: 'Болгарский перец',        category: 'Овощи',        quantity: 0, min: 0, unit: 'kg' },
  { id: 'v4',  name: 'Шампиньоны',              category: 'Овощи',        quantity: 0, min: 0, unit: 'kg' },
  { id: 'v5',  name: 'Помидоры черри',          category: 'Овощи',        quantity: 0, min: 0, unit: 'kg' },
  { id: 'v6',  name: 'Лук',                     category: 'Овощи',        quantity: 0, min: 0, unit: 'kg' },
  { id: 'v7',  name: 'Морковь',                 category: 'Овощи',        quantity: 0, min: 0, unit: 'kg' },
  { id: 'v8',  name: 'Салат',                   category: 'Овощи',        quantity: 0, min: 0, unit: 'kg' },
  { id: 'v9',  name: 'Картофель',               category: 'Овощи',        quantity: 0, min: 0, unit: 'kg' },

  // ——— Сыры ———
  { id: 'c1',  name: 'Чеддер',                  category: 'Сыры',         quantity: 0, min: 0, unit: 'kg' },
  { id: 'c2',  name: 'Пармезан',                category: 'Сыры',         quantity: 0, min: 0, unit: 'kg' },
  { id: 'c3',  name: 'Плавленый сыр',           category: 'Сыры',         quantity: 0, min: 0, unit: 'kg' },

  // ——— Соусы ———
  { id: 'sc1', name: 'Соус сырный',             category: 'Соусы',        quantity: 0, min: 0, unit: 'kg' },
  { id: 'sc2', name: 'Соус цезарь',             category: 'Соусы',        quantity: 0, min: 0, unit: 'kg' },
  { id: 'sc3', name: 'Соус горчица',            category: 'Соусы',        quantity: 0, min: 0, unit: 'kg' },
  { id: 'sc4', name: 'Соус красный',            category: 'Соусы',        quantity: 0, min: 0, unit: 'kg' },
  { id: 'sc5', name: 'Соус гриль',              category: 'Соусы',        quantity: 0, min: 0, unit: 'kg' },
  { id: 'sc6', name: 'Соус барбекю',            category: 'Соусы',        quantity: 0, min: 0, unit: 'kg' },
  { id: 'sc7', name: 'Соус унаги',              category: 'Соусы',        quantity: 0, min: 0, unit: 'kg' },

  // ——— Хлеб ———
  { id: 'b1',  name: 'Тостовый хлеб',           category: 'Хлеб',         quantity: 0, min: 0, unit: 'pcs' }
];

let ingredients = [];

// ---------- Загрузка / сохранение ----------
function loadIngredients() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      ingredients = JSON.parse(raw);
    } else {
      ingredients = DEFAULT_INGREDIENTS.map(i => ({ ...i }));
      saveIngredients();
    }
  } catch (e) {
    ingredients = DEFAULT_INGREDIENTS.map(i => ({ ...i }));
  }
}

function saveIngredients() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ingredients));
  } catch (e) {
    console.error('Не удалось сохранить', e);
  }
}

// ============================================
//  ОТОБРАЖЕНИЕ
// ============================================
const listEl   = document.getElementById('ingredients-list');
const searchEl = document.getElementById('search-input');
const addBtn   = document.getElementById('add-btn');
const modal    = document.getElementById('modal');

let filterText = '';

// Показать количество в удобной единице
function displayQty(item) {
  const q = item.quantity;
  if (item.unit === 'kg')  return niceNum(q / 1000) + ' кг';
  if (item.unit === 'l')   return niceNum(q / 1000) + ' л';
  if (item.unit === 'ml')  return niceNum(q) + ' мл';
  if (item.unit === 'pcs') return niceNum(q) + ' шт';
  return niceNum(q) + ' г';
}

function niceNum(n) {
  if (n === 0) return '0';
  const rounded = Math.round(n * 1000) / 1000;
  return rounded.toString().replace('.', ',');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function render() {
  const filtered = ingredients.filter(i =>
    i.name.toLowerCase().includes(filterText)
  );

  // Сортировка: сначала те, где мало осталось, потом по категории, потом по имени
  filtered.sort((a, b) => {
    const aLow = a.min > 0 && a.quantity <= a.min;
    const bLow = b.min > 0 && b.quantity <= b.min;
    if (aLow !== bLow) return aLow ? -1 : 1;
    if (a.category !== b.category) return a.category.localeCompare(b.category, 'ru');
    return a.name.localeCompare(b.name, 'ru');
  });

  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="empty-state">Ничего не найдено</div>';
    return;
  }

  listEl.innerHTML = filtered.map(item => {
    const isLow = item.min > 0 && item.quantity <= item.min;
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
}

// ============================================
//  СОБЫТИЯ
// ============================================

// Поиск
searchEl.addEventListener('input', e => {
  filterText = e.target.value.toLowerCase().trim();
  render();
});

// Ввод количества — сохраняем при потере фокуса или Enter
listEl.addEventListener('change', e => {
  const input = e.target.closest('.qty-input');
  const select = e.target.closest('.unit-select');

  if (input) {
    const id = input.dataset.id;
    const item = ingredients.find(i => i.id === id);
    if (!item) return;

    const raw = input.value.replace(',', '.').replace(/[^\d.\-]/g, '');
    const num = parseFloat(raw) || 0;

    // Сохраняем в базовых единицах
    if (item.unit === 'kg' || item.unit === 'l') {
      item.quantity = num * 1000;
    } else {
      item.quantity = num;
    }

    saveIngredients();
    render();
  }

  if (select) {
    const id = select.dataset.id;
    const item = ingredients.find(i => i.id === id);
    if (!item) return;
    item.unit = select.value;
    saveIngredients();
    render();
  }
});

// Enter — убрать фокус (закрывает клавиатуру)
listEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.closest('.qty-input')) {
    e.target.blur();
  }
});

// FAB → добавить новый ингредиент
addBtn.addEventListener('click', () => openEdit(null));

// Долгое нажатие на карточку (кроме полей ввода) — редактировать
listEl.addEventListener('contextmenu', e => {
  const card = e.target.closest('.ingredient-card');
  if (!card) return;
  // Если тап по полю ввода — не открываем
  if (e.target.closest('.qty-input-wrap')) return;
  e.preventDefault();
  openEdit(card.dataset.id);
});

// ============================================
//  МОДАЛКА (создание / редактирование)
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
    const q = (item.unit === 'kg' || item.unit === 'l') ? item.quantity / 1000 : item.quantity;
    const mn = (item.unit === 'kg' || item.unit === 'l') ? item.min / 1000 : item.min;
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

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

function updateMinUnitLabel() {
  const u = mUnit.value;
  const map = { g: 'г', kg: 'кг', ml: 'мл', l: 'л', pcs: 'шт' };
  mMinUnit.textContent = map[u] || 'г';
}

mUnit.addEventListener('change', updateMinUnitLabel);

document.getElementById('modal-cancel').addEventListener('click', () => {
  modal.classList.add('hidden');
  editingId = null;
});

document.getElementById('modal-save').addEventListener('click', () => {
  const name     = mName.value.trim();
  const category = mCategory.value.trim() || 'Прочее';
  const qty      = parseFloat(mQuantity.value) || 0;
  const min      = parseFloat(mMin.value) || 0;
  const unit     = mUnit.value;

  if (!name) {
    alert('Введите название');
    return;
  }

  const isBig = (unit === 'kg' || unit === 'l');
  const qtyBase = isBig ? qty * 1000 : qty;
  const minBase = isBig ? min * 1000 : min;

  if (editingId) {
    const item = ingredients.find(i => i.id === editingId);
    if (item) {
      item.name = name;
      item.category = category;
      item.quantity = qtyBase;
      item.min = minBase;
      item.unit = unit;
    }
  } else {
    ingredients.push({
      id: Date.now().toString(),
      name,
      category,
      quantity: qtyBase,
      min: minBase,
      unit
    });
  }

  saveIngredients();
  render();
  modal.classList.add('hidden');
  editingId = null;
});

// Закрытие тапом по затемнению
modal.addEventListener('click', e => {
  if (e.target === modal) {
    modal.classList.add('hidden');
    editingId = null;
  }
});

// ============================================
//  ПЕРЕКЛЮЧЕНИЕ ТАБОВ
// ============================================
const fab = document.getElementById('add-btn');

function updateFabVisibility(tab) {
  if (tab === 'inventory') {
    fab.classList.remove('hidden');
  } else {
    fab.classList.add('hidden');
  }
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
//  СТАРТ
// ============================================
loadIngredients();
render();
updateFabVisibility('inventory');