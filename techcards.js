// ============================================
//  РАЗДЕЛ ТТК
// ============================================

let dishes = [];
let dishIngredients = [];
let techcardsLoaded = false;
let currentDishId = null;

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
      const count = dishIngredients.filter(i => i.dish_id === d.id).length;
      html += `
        <div class="dish-card" data-id="${d.id}">
          <div class="dish-info">
            <div class="dish-name">${escapeHtmlTtk(d.name)}</div>
            <div class="dish-meta">${count} ингредиентов</div>
          </div>
          <svg class="dish-arrow" viewBox="0 0 24 24" fill="none">
            <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      `;
    });
  });

  listEl.innerHTML = html;
}

// Открыть карточку блюда
function openDish(dishId) {
  const dish = dishes.find(d => d.id === dishId);
  if (!dish) return;

  currentDishId = dishId;

  const titleEl = document.getElementById('dish-view-title');
  const listEl = document.getElementById('dish-view-ingredients');

  titleEl.textContent = dish.name;

  const items = dishIngredients.filter(i => i.dish_id === dishId);
  if (items.length === 0) {
    listEl.innerHTML = '<div class="empty-state">Ингредиентов нет</div>';
  } else {
    listEl.innerHTML = items.map(item => `
      <div class="dish-ingredient">
        <div class="dish-ingredient-name">${escapeHtmlTtk(item.name)}</div>
        <div class="dish-ingredient-amount">${escapeHtmlTtk(item.amount)}</div>
      </div>
    `).join('');
  }

  document.getElementById('techcards-list-view').classList.add('hidden');
  document.getElementById('techcards-dish-view').classList.remove('hidden');
}

// Назад к списку
function closeDish() {
  document.getElementById('techcards-dish-view').classList.add('hidden');
  document.getElementById('techcards-list-view').classList.remove('hidden');
  currentDishId = null;
}

// Инициализация событий
function initTechcards() {
  const listEl = document.getElementById('dishes-list');
  if (listEl) {
    listEl.addEventListener('click', (e) => {
      const card = e.target.closest('.dish-card');
      if (!card) return;
      openDish(card.dataset.id);
    });
  }

  const backBtn = document.getElementById('dish-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', closeDish);
  }

  // Загружаем, когда пользователь впервые открывает вкладку
  const ttkTab = document.querySelector('.tab-btn[data-tab="techcards"]');
  if (ttkTab) {
    ttkTab.addEventListener('click', () => {
      if (!techcardsLoaded) {
        loadTechcards();
      }
    });
  }

  // Если вдруг приложение стартует с ТТК — грузим сразу
  const activeTab = document.querySelector('.tab-btn.active');
  if (activeTab && activeTab.dataset.tab === 'techcards') {
    loadTechcards();
  }
}