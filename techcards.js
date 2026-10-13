// ============================================
//  ТТК — двухуровневый аккордеон с добавлением
//  Уровень 1: Блюда / Заготовки
//  Уровень 2: список блюд (раскрываются)
// ============================================

let dishes = [];
let dishIngredients = [];
let techcardsLoaded = false;

let openSection = null;
let openDishId = null;

// Для формы добавления
let newDishIngredients = []; // [{name, amount}]

// ============================================
//  ПРАВА
// ============================================
function canEditTechcards() {
  const me = getCurrentUser();
  if (!me) return false;
  return me.name === 'Даниил';
}

// ============================================
//  ЗАГРУЗКА
// ============================================
async function loadTechcards() {
  try {
    const [dishesRes, ingRes] = await Promise.all([
      window.db.from('dishes').select('*').order('sort_order'),
      window.db.from('dish_ingredients').select('*').order('sort_order')
    ]);

    if (dishesRes.error) {
      console.error('Ошибка загрузки блюд:', dishesRes.error);
      return;
    }
    if (ingRes.error) {
      console.error('Ошибка загрузки ингредиентов:', ingRes.error);
      return;
    }

    dishes = dishesRes.data || [];
    dishIngredients = ingRes.data || [];
    techcardsLoaded = true;
    renderTechcards();
  } catch (e) {
    console.error('Ошибка сети:', e);
  }
}

function escapeHtmlTtk(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================
//  ОТРИСОВКА
// ============================================
function renderTechcards() {
  const listEl = document.getElementById('dishes-list');
  if (!listEl) return;

  listEl.innerHTML = '';

  // === СЕКЦИЯ «БЛЮДА» ===
  const dishesOpen = openSection === 'dishes';
  const dishesSection = document.createElement('div');
  dishesSection.className = 'ttk-section' + (dishesOpen ? ' open' : '');
  dishesSection.innerHTML = `
    <div class="ttk-section-header" data-section="dishes">
      <span class="ttk-section-emoji">🍽</span>
      <span class="ttk-section-name">Блюда</span>
      <svg class="ttk-section-arrow" viewBox="0 0 24 24" fill="none">
        <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="ttk-section-body">
      ${renderDishesInside('dish')}
      ${canEditTechcards() ? `<button class="ttk-add-btn" data-type="dish">+ Добавить блюдо</button>` : ''}
    </div>
  `;
  listEl.appendChild(dishesSection);

  // === СЕКЦИЯ «ЗАГОТОВКИ» ===
  const prepOpen = openSection === 'prep';
  const prepSection = document.createElement('div');
  prepSection.className = 'ttk-section' + (prepOpen ? ' open' : '');
  prepSection.innerHTML = `
    <div class="ttk-section-header" data-section="prep">
      <span class="ttk-section-emoji">🥫</span>
      <span class="ttk-section-name">Заготовки</span>
      <svg class="ttk-section-arrow" viewBox="0 0 24 24" fill="none">
        <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="ttk-section-body">
      ${renderDishesInside('prep')}
      ${canEditTechcards() ? `<button class="ttk-add-btn" data-type="prep">+ Добавить заготовку</button>` : ''}
    </div>
  `;
  listEl.appendChild(prepSection);

  // === ОБРАБОТЧИКИ ===

  // Клик по заголовку секции — раскрыть/закрыть
  listEl.querySelectorAll('.ttk-section-header').forEach(header => {
    header.addEventListener('click', () => {
      const section = header.dataset.section;
      openSection = (openSection === section) ? null : section;
      renderTechcards();
    });
  });

  // Клик по блюду — раскрыть ингредиенты
  listEl.querySelectorAll('.dish-card').forEach(card => {
    const header = card.querySelector('.dish-header');
    header.addEventListener('click', (e) => {
      e.stopPropagation();
      const dishId = card.dataset.id;
      openDishId = (openDishId === dishId) ? null : dishId;
      renderTechcards();
    });

    // Долгое нажатие — удалить (только Даниил)
    if (canEditTechcards()) {
      let pressTimer = null;
      header.addEventListener('touchstart', () => {
        pressTimer = setTimeout(() => {
          const dishId = card.dataset.id;
          const dish = dishes.find(d => d.id === dishId);
          if (dish && confirm(`Удалить «${dish.name}»?`)) {
            deleteDish(dishId);
          }
        }, 800);
      }, { passive: true });

      header.addEventListener('touchend', () => clearTimeout(pressTimer));
      header.addEventListener('touchmove', () => clearTimeout(pressTimer));
      header.addEventListener('touchcancel', () => clearTimeout(pressTimer));
    }
  });

  // Кнопка «Добавить блюдо/заготовку»
  listEl.querySelectorAll('.ttk-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openAddDishModal(btn.dataset.type);
    });
  });
}

// Внутренний список блюд/заготовок
function renderDishesInside(type) {
  const filtered = dishes.filter(d => (d.type || 'dish') === type);

  if (filtered.length === 0) {
    return '<div class="ttk-empty">Пока пусто</div>';
  }

  // Группировка по категориям
  const grouped = {};
  filtered.forEach(d => {
    if (!grouped[d.category]) grouped[d.category] = [];
    grouped[d.category].push(d);
  });

  let html = '';
  Object.keys(grouped).forEach(cat => {
    html += `<div class="ttk-category">${escapeHtmlTtk(cat)}</div>`;
    grouped[cat].forEach(d => {
      const items = dishIngredients.filter(i => i.dish_id === d.id);
      const isOpen = openDishId === d.id;

      const ingHtml = items.map(item => `
        <div class="dish-ingredient">
          <div class="dish-ingredient-name">${escapeHtmlTtk(item.name)}</div>
          <div class="dish-ingredient-amount">${escapeHtmlTtk(item.amount)}</div>
        </div>
      `).join('');

      html += `
        <div class="dish-card ${isOpen ? 'open' : ''}" data-id="${d.id}">
          <div class="dish-header">
            <div class="dish-info">
              <div class="dish-name">${escapeHtmlTtk(d.name)}</div>
              <div class="dish-meta">${items.length} ингредиентов</div>
            </div>
            <svg class="dish-arrow" viewBox="0 0 24 24" fill="none">
              <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="dish-body">
            ${ingHtml}
          </div>
        </div>
      `;
    });
  });

  return html;
}

// ============================================
//  УДАЛЕНИЕ БЛЮДА
// ============================================
async function deleteDish(dishId) {
  try {
    // Сначала ингредиенты (хотя каскад должен сработать сам)
    await window.db.from('dish_ingredients').delete().eq('dish_id', dishId);

    const { error } = await window.db.from('dishes').delete().eq('id', dishId);

    if (error) {
      console.error('Ошибка удаления:', error);
      alert('Не удалось удалить');
      return;
    }

    // Обновляем локально
    dishes = dishes.filter(d => d.id !== dishId);
    dishIngredients = dishIngredients.filter(i => i.dish_id !== dishId);
    openDishId = null;
    renderTechcards();
  } catch (e) {
    console.error('Ошибка сети:', e);
    alert('Ошибка при удалении');
  }
}

// ============================================
//  МОДАЛКА ДОБАВЛЕНИЯ
// ============================================
function openAddDishModal(type) {
  const modal = document.getElementById('add-dish-modal');
  if (!modal) return;

  const isDish = type === 'dish';
  document.getElementById('add-dish-title').textContent = isDish ? 'Новое блюдо' : 'Новая заготовка';

  // Сброс формы
  document.getElementById('add-dish-name').value = '';
  document.getElementById('add-dish-category').value = '';
  newDishIngredients = [{ name: '', amount: '' }];
  renderAddDishIngredients();

  // Заполнить datalist категорий
  const cats = [...new Set(dishes.filter(d => (d.type || 'dish') === type).map(d => d.category))]
    .sort((a, b) => a.localeCompare(b, 'ru'));
  document.getElementById('add-dish-cat-list').innerHTML =
    cats.map(c => `<option value="${escapeHtmlTtk(c)}">`).join('');

  modal.dataset.type = type;
  modal.classList.remove('hidden');
}

function renderAddDishIngredients() {
  const list = document.getElementById('add-dish-ingredients');
  list.innerHTML = newDishIngredients.map((ing, i) => `
    <div class="add-ing-row" data-index="${i}">
      <input type="text" class="add-ing-name" placeholder="Ингредиент" value="${escapeHtmlTtk(ing.name)}">
      <input type="text" class="add-ing-amount" placeholder="Граммовка" value="${escapeHtmlTtk(ing.amount)}">
      <button class="add-ing-remove" data-index="${i}" aria-label="Удалить">✕</button>
    </div>
  `).join('');

  // Обработчики
  list.querySelectorAll('.add-ing-name').forEach(input => {
    input.addEventListener('input', (e) => {
      const i = parseInt(e.target.closest('.add-ing-row').dataset.index, 10);
      newDishIngredients[i].name = e.target.value;
    });
  });

  list.querySelectorAll('.add-ing-amount').forEach(input => {
    input.addEventListener('input', (e) => {
      const i = parseInt(e.target.closest('.add-ing-row').dataset.index, 10);
      newDishIngredients[i].amount = e.target.value;
    });
  });

  list.querySelectorAll('.add-ing-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const i = parseInt(btn.dataset.index, 10);
      newDishIngredients.splice(i, 1);
      if (newDishIngredients.length === 0) newDishIngredients.push({ name: '', amount: '' });
      renderAddDishIngredients();
    });
  });
}

// ============================================
//  СОХРАНЕНИЕ НОВОГО БЛЮДА
// ============================================
async function saveNewDish() {
  const modal = document.getElementById('add-dish-modal');
  const type = modal.dataset.type || 'dish';

  const name = document.getElementById('add-dish-name').value.trim();
  const category = document.getElementById('add-dish-category').value.trim();

  if (!name) {
    alert('Введите название');
    return;
  }
  if (!category) {
    alert('Введите категорию');
    return;
  }

  const validIngs = newDishIngredients.filter(i => i.name.trim());

  try {
    // ID нового блюда
    const newId = 'd' + Date.now();

    // Сортировка — в конец того же типа
    const sameType = dishes.filter(d => (d.type || 'dish') === type);
    const maxSort = sameType.length > 0
      ? Math.max(...sameType.map(d => d.sort_order || 0))
      : 0;

    // 1. Вставляем блюдо
    const { error: dishErr } = await window.db
      .from('dishes')
      .insert({
        id: newId,
        name: name,
        category: category,
        sort_order: maxSort + 1,
        type: type
      });

    if (dishErr) {
      console.error('Ошибка добавления блюда:', dishErr);
      alert('Не удалось добавить: ' + dishErr.message);
      return;
    }

    // 2. Вставляем ингредиенты
    if (validIngs.length > 0) {
      const rows = validIngs.map((ing, idx) => ({
        dish_id: newId,
        name: ing.name.trim(),
        amount: ing.amount.trim(),
        sort_order: idx + 1
      }));

      const { error: ingErr } = await window.db.from('dish_ingredients').insert(rows);
      if (ingErr) {
        console.error('Ошибка добавления ингредиентов:', ingErr);
      }
    }

    // Закрываем модалку и перезагружаем
    modal.classList.add('hidden');
    openSection = type === 'dish' ? 'dishes' : 'prep';
    openDishId = newId;
    await loadTechcards();
  } catch (e) {
    console.error('Ошибка сети:', e);
    alert('Ошибка при сохранении');
  }
}

// ============================================
//  ИНИЦИАЛИЗАЦИЯ
// ============================================
function initTechcards() {
  // Загрузка при первом открытии вкладки
  const ttkTab = document.querySelector('.tab-btn[data-tab="techcards"]');
  if (ttkTab && !ttkTab.dataset.bound) {
    ttkTab.dataset.bound = '1';
    ttkTab.addEventListener('click', () => {
      if (!techcardsLoaded) loadTechcards();
    });
  }

  const activeTab = document.querySelector('.tab-btn.active');
  if (activeTab && activeTab.dataset.tab === 'techcards' && !techcardsLoaded) {
    loadTechcards();
  }

  // Кнопка «+ Добавить ингредиент» в модалке
  const addIngBtn = document.getElementById('add-dish-add-ing');
  if (addIngBtn && !addIngBtn.dataset.bound) {
    addIngBtn.dataset.bound = '1';
    addIngBtn.addEventListener('click', () => {
      newDishIngredients.push({ name: '', amount: '' });
      renderAddDishIngredients();
      // Фокус на последнее поле
      const rows = document.querySelectorAll('.add-ing-row');
      const last = rows[rows.length - 1];
      if (last) last.querySelector('.add-ing-name').focus();
    });
  }

  // Кнопка «Сохранить»
  const saveBtn = document.getElementById('add-dish-save');
  if (saveBtn && !saveBtn.dataset.bound) {
    saveBtn.dataset.bound = '1';
    saveBtn.addEventListener('click', saveNewDish);
  }

  // Кнопка «Отмена»
  const cancelBtn = document.getElementById('add-dish-cancel');
  if (cancelBtn && !cancelBtn.dataset.bound) {
    cancelBtn.dataset.bound = '1';
    cancelBtn.addEventListener('click', () => {
      document.getElementById('add-dish-modal').classList.add('hidden');
    });
  }
}