// ============================================
//  РАЗДЕЛ ТТК — двухуровневый аккордеон
//  Уровень 1: Блюда / Заготовки
//  Уровень 2: список блюд (тоже раскрываются)
// ============================================

let dishes = [];
let dishIngredients = [];
let techcardsLoaded = false;

// Состояния раскрытия
let openSection = null;    // 'dishes' | 'prep' | null
let openDishId = null;     // id блюда, у которого раскрыты ингредиенты

// ============================================
//  ЗАГРУЗКА ИЗ SUPABASE
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

  // ===== СЕКЦИЯ 1: БЛЮДА =====
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
      ${renderDishesInside()}
    </div>
  `;
  listEl.appendChild(dishesSection);

  // ===== СЕКЦИЯ 2: ЗАГОТОВКИ =====
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
      <div class="ttk-empty">Скоро</div>
    </div>
  `;
  listEl.appendChild(prepSection);

  // Навешиваем обработчики
  listEl.querySelectorAll('.ttk-section-header').forEach(header => {
    header.addEventListener('click', () => {
      const section = header.dataset.section;
      if (openSection === section) {
        openSection = null;
      } else {
        openSection = section;
      }
      renderTechcards();
    });
  });

  // Обработчики на блюда (только внутри открытой секции «Блюда»)
  listEl.querySelectorAll('.dish-card').forEach(card => {
    card.addEventListener('click', () => {
      const dishId = card.dataset.id;
      if (openDishId === dishId) {
        openDishId = null;
      } else {
        openDishId = dishId;
      }
      renderTechcards();
    });
  });
}

// Внутренний список блюд (категории + карточки)
function renderDishesInside() {
  if (dishes.length === 0) {
    return '<div class="ttk-empty">Блюда не загружены</div>';
  }

  // Группировка по категориям
  const grouped = {};
  dishes.forEach(d => {
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
//  ИНИЦИАЛИЗАЦИЯ
// ============================================
function initTechcards() {
  // Загружаем при первом открытии вкладки ТТК
  const ttkTab = document.querySelector('.tab-btn[data-tab="techcards"]');
  if (ttkTab && !ttkTab.dataset.bound) {
    ttkTab.dataset.bound = '1';
    ttkTab.addEventListener('click', () => {
      if (!techcardsLoaded) {
        loadTechcards();
      }
    });
  }

  // Если приложение стартует сразу с ТТК
  const activeTab = document.querySelector('.tab-btn.active');
  if (activeTab && activeTab.dataset.tab === 'techcards' && !techcardsLoaded) {
    loadTechcards();
  }
}