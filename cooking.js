// ============================================
//  ПРИГОТОВЛЕНИЕ — пошаговые инструкции
// ============================================

let cookingDishes = [];
let cookingSteps = {};
let cookingLoaded = false;
let openCookingDishId = null;

// ============================================
//  ПРАВА
// ============================================
function canEditCooking() {
  const me = getCurrentUser();
  if (!me) return false;
  return me.name === 'Даниил';
}

// ============================================
//  ЗАГРУЗКА
// ============================================
async function loadCooking() {
  try {
    const [dishesRes, stepsRes] = await Promise.all([
      window.db.from('dishes').select('*').order('sort_order'),
      window.db.from('dish_steps').select('*').order('step_order')
    ]);

    if (dishesRes.error) {
      console.error('Ошибка загрузки блюд:', dishesRes.error);
      return;
    }
    if (stepsRes.error) {
      console.error('Ошибка загрузки шагов:', stepsRes.error);
      return;
    }

    cookingDishes = dishesRes.data || [];
    cookingSteps = {};
    (stepsRes.data || []).forEach(s => {
      if (!cookingSteps[s.dish_id]) cookingSteps[s.dish_id] = [];
      cookingSteps[s.dish_id].push(s);
    });

    cookingLoaded = true;
    renderCooking();
  } catch (e) {
    console.error('Ошибка сети:', e);
  }
}

function escapeHtmlCook(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================
//  ОТРИСОВКА
// ============================================
function renderCooking() {
  const root = document.getElementById('cooking-root');
  if (!root) return;

  // Если открыто блюдо — показываем шаги
  if (openCookingDishId) {
    renderCookingDish(root, openCookingDishId);
    return;
  }

  // Иначе — список блюд
  renderCookingList(root);
}

function renderCookingList(root) {
  if (cookingDishes.length === 0) {
    root.innerHTML = `
      <h1 class="section-title">Приготовление</h1>
      <p class="section-sub">Пошаговые инструкции для блюд</p>
      <div class="empty-state">Блюда не загружены</div>
    `;
    return;
  }

  // Группировка по категориям
  const grouped = {};
  cookingDishes.forEach(d => {
    if (!grouped[d.category]) grouped[d.category] = [];
    grouped[d.category].push(d);
  });

  let html = `
    <h1 class="section-title">Приготовление</h1>
    <p class="section-sub">Пошаговые инструкции для блюд</p>
  `;

  Object.keys(grouped).forEach(cat => {
    html += `<div class="ttk-category">${escapeHtmlCook(cat)}</div>`;
    grouped[cat].forEach(d => {
      const steps = cookingSteps[d.id] || [];
      const stepCount = steps.length;
      html += `
        <div class="cooking-dish-card" data-id="${d.id}">
          <div class="cooking-dish-info">
            <div class="cooking-dish-name">${escapeHtmlCook(d.name)}</div>
            <div class="cooking-dish-meta">${stepCount} ${pluralCook(stepCount, 'шаг', 'шага', 'шагов')}</div>
          </div>
          <svg class="cooking-dish-arrow" viewBox="0 0 24 24" fill="none">
            <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      `;
    });
  });

  root.innerHTML = html;

  // Обработчики
  root.querySelectorAll('.cooking-dish-card').forEach(card => {
    card.addEventListener('click', () => {
      openCookingDishId = card.dataset.id;
      renderCooking();
    });
  });
}

function renderCookingDish(root, dishId) {
  const dish = cookingDishes.find(d => d.id === dishId);
  if (!dish) {
    openCookingDishId = null;
    renderCooking();
    return;
  }

  const steps = cookingSteps[dishId] || [];

  let stepsHtml = '';
  if (steps.length === 0) {
    stepsHtml = '<div class="cooking-empty">Шагов пока нет</div>';
  } else {
    stepsHtml = steps.map((s, i) => `
      <div class="cooking-step">
        <div class="cooking-step-num">${i + 1}</div>
        <div class="cooking-step-text">${escapeHtmlCook(s.text)}</div>
      </div>
    `).join('');
  }

  const photoHtml = dish.final_photo_url ? `
    <div class="cooking-photo-block">
      <div class="cooking-photo-label">Так должно выглядеть:</div>
      <img src="${dish.final_photo_url}" class="cooking-photo" alt="" loading="lazy">
    </div>
  ` : '';

  root.innerHTML = `
    <div class="cooking-header">
      <button class="dish-back-btn" id="cooking-back-btn" aria-label="Назад">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <h1 class="section-title cooking-dish-title">${escapeHtmlCook(dish.name)}</h1>
    </div>
    <p class="section-sub">${escapeHtmlCook(dish.category)}</p>

    <div class="cooking-steps">
      ${stepsHtml}
    </div>

    ${photoHtml}
  `;

  const backBtn = root.querySelector('#cooking-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      openCookingDishId = null;
      renderCooking();
    });
  }
}

// ============================================
//  УТИЛИТЫ
// ============================================
function pluralCook(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

// ============================================
//  ИНИЦИАЛИЗАЦИЯ
// ============================================
function initCooking() {
  // Загружаем при первом открытии вкладки
  const cookTab = document.querySelector('.tab-btn[data-tab="cooking"]');
  if (cookTab && !cookTab.dataset.boundCook) {
    cookTab.dataset.boundCook = '1';
    cookTab.addEventListener('click', () => {
      if (!cookingLoaded) loadCooking();
    });
  }

  // Если приложение стартует с Приготовления
  const activeTab = document.querySelector('.tab-btn.active');
  if (activeTab && activeTab.dataset.tab === 'cooking' && !cookingLoaded) {
    loadCooking();
  }
}