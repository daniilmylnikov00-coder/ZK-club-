// ============================================
//  РАЗДЕЛ ТТК — аккордеон
// ============================================

let dishes = [];
let dishIngredients = [];
let techcardsLoaded = false;
let openDishId = null;

// Загрузка из Supabase
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
    renderDishes();
  } catch (e) {
    console.error('Ошибка сети:', e);
  }
}

function escapeHtmlTtk(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderDishes() {
  const listEl = document.getElementById('dishes-list');
  if (!listEl) return;

  if (dishes.length === 0) {
    listEl.innerHTML = '<div class="empty-state">Блюда не загружены</div>';
    return;
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

  listEl.innerHTML = html;
}

// Тап на блюдо — раскрыть/закрыть
function toggleDish(dishId) {
  if (openDishId === dishId) {
    openDishId = null;
  } else {
    openDishId = dishId;
  }
  renderDishes();
}

// Инициализация
function initTechcards() {
  const listEl = document.getElementById('dishes-list');
  if (listEl && !listEl.dataset.bound) {
    listEl.dataset.bound = '1';
    listEl.addEventListener('click', (e) => {
      const card = e.target.closest('.dish-card');
      if (!card) return;
      toggleDish(card.dataset.id);
    });
  }

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