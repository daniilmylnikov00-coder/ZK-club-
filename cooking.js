// ============================================
//  ПРИГОТОВЛЕНИЕ — пошаговые инструкции
// ============================================

let cookingDishes = [];
let cookingSteps = {};
let cookingLoaded = false;
let openCookingDishId = null;

// Таймеры
let activeTimers = {}; // { stepId: { endTime, intervalId } }

// Форма шага
let editingStepId = null;

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

    // Сортируем шаги
    Object.keys(cookingSteps).forEach(k => {
      cookingSteps[k].sort((a, b) => a.step_order - b.step_order);
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

  if (openCookingDishId) {
    renderCookingDish(root, openCookingDishId);
    return;
  }

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
  const canEdit = canEditCooking();

  let stepsHtml = '';
  if (steps.length === 0) {
    stepsHtml = '<div class="cooking-empty">Шагов пока нет</div>';
  } else {
    stepsHtml = steps.map((s, i) => {
      const timerMinutes = extractTimerMinutes(s.text);
      const timerHtml = timerMinutes > 0
        ? renderTimerButton(s.id, timerMinutes)
        : '';
      const editBtn = canEdit
        ? `<button class="cooking-step-edit" data-id="${s.id}" aria-label="Редактировать шаг">
             <svg viewBox="0 0 24 24" fill="none">
               <path d="M4 20h4l10-10-4-4L4 16v4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
               <path d="M14 6l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
             </svg>
           </button>`
        : '';

      return `
        <div class="cooking-step" data-step-id="${s.id}">
          <div class="cooking-step-num">${i + 1}</div>
          <div class="cooking-step-body">
            <div class="cooking-step-text">${escapeHtmlCook(s.text)}</div>
            ${timerHtml}
          </div>
          ${editBtn}
        </div>
      `;
    }).join('');
  }

  const addStepBtn = canEdit
    ? `<button class="cooking-add-step" id="cooking-add-step-btn">+ Добавить шаг</button>`
    : '';

  const photoHtml = dish.final_photo_url ? `
    <div class="cooking-photo-block">
      <div class="cooking-photo-label">Так должно выглядеть:</div>
      <img src="${dish.final_photo_url}" class="cooking-photo" alt="" loading="lazy">
      ${canEdit ? `
        <button class="cooking-photo-change" id="cooking-photo-change-btn">Заменить фото</button>
      ` : ''}
    </div>
  ` : (canEdit ? `
    <div class="cooking-photo-empty">
      <button class="cooking-photo-add" id="cooking-photo-add-btn">📷 Добавить фото готового блюда</button>
    </div>
  ` : '');

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

    ${addStepBtn}

    ${photoHtml}
  `;

  // Обработчики
  root.querySelector('#cooking-back-btn')?.addEventListener('click', () => {
    openCookingDishId = null;
    renderCooking();
  });

  root.querySelector('#cooking-add-step-btn')?.addEventListener('click', () => {
    openStepModal(null);
  });

  root.querySelectorAll('.cooking-step-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openStepModal(btn.dataset.id);
    });
  });

  // Таймеры
  root.querySelectorAll('.timer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const stepId = btn.dataset.stepId;
      const minutes = parseInt(btn.dataset.minutes, 10);
      toggleTimer(stepId, minutes);
    });
  });

  // Восстанавливаем активные таймеры
  Object.keys(activeTimers).forEach(stepId => {
    updateTimerDisplay(stepId);
  });

  // Фото
  root.querySelector('#cooking-photo-add-btn')?.addEventListener('click', () => {
    openCookingPhotoSource(dishId);
  });
  root.querySelector('#cooking-photo-change-btn')?.addEventListener('click', () => {
    openCookingPhotoSource(dishId);
  });
}

// ============================================
//  ТАЙМЕР
// ============================================

// Автоматически извлекаем количество минут из текста
function extractTimerMinutes(text) {
  if (!text) return 0;

  // Ищем "X минут" или "X мин" или "X минуту"
  const match = text.match(/(\d+)\s*(минут|мин|минуту|минуты|секунд|сек)/i);
  if (!match) return 0;

  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  if (unit.startsWith('сек')) {
    // Секунды — если меньше 60 — считаем как долю минуты
    return num < 60 ? num / 60 : Math.round(num / 60);
  }
  return num;
}

function renderTimerButton(stepId, minutes) {
  const state = activeTimers[stepId];
  if (state && state.endTime > Date.now()) {
    // Таймер запущен — показываем отсчёт
    return `<div class="timer-btn active" data-step-id="${stepId}">
      ⏱ <span class="timer-time" id="timer-${stepId}">--:--</span>
      <span class="timer-hint">(тап — отменить)</span>
    </div>`;
  }
  return `<button class="timer-btn" data-step-id="${stepId}" data-minutes="${minutes}">
    ⏱ Запустить таймер ${minutes} мин
  </button>`;
}

function toggleTimer(stepId, minutes) {
  // Если уже активен — отменяем
  if (activeTimers[stepId]) {
    clearInterval(activeTimers[stepId].intervalId);
    delete activeTimers[stepId];
    // Перерисовываем экран
    renderCooking();
    return;
  }

  const endTime = Date.now() + minutes * 60 * 1000;
  const intervalId = setInterval(() => {
    const left = endTime - Date.now();
    if (left <= 0) {
      clearInterval(intervalId);
      delete activeTimers[stepId];
      notifyTimerDone(minutes);
      renderCooking();
      return;
    }
    updateTimerDisplay(stepId);
  }, 1000);

  activeTimers[stepId] = { endTime, minutes, intervalId };
  renderCooking();
}

function updateTimerDisplay(stepId) {
  const state = activeTimers[stepId];
  if (!state) return;

  const el = document.getElementById('timer-' + stepId);
  if (!el) return;

  const left = Math.max(0, state.endTime - Date.now());
  const totalSec = Math.floor(left / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  el.textContent = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function notifyTimerDone(minutes) {
  // Визуальное уведомление
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

  // Alert
  setTimeout(() => {
    alert(`⏱ Таймер ${minutes} мин завершён!`);
  }, 100);
}

// ============================================
//  МОДАЛКА ШАГА
// ============================================

function openStepModal(stepId) {
  editingStepId = stepId;
  const modal = document.getElementById('step-modal');
  if (!modal) return;

  const titleEl = document.getElementById('step-modal-title');
  const textEl = document.getElementById('step-text');

  if (stepId) {
    // Находим шаг
    let step = null;
    Object.values(cookingSteps).forEach(arr => {
      const found = arr.find(s => s.id === stepId);
      if (found) step = found;
    });

    titleEl.textContent = 'Редактировать шаг';
    textEl.value = step ? step.text : '';
  } else {
    titleEl.textContent = 'Новый шаг';
    textEl.value = '';
  }

  modal.classList.remove('hidden');
  setTimeout(() => textEl.focus(), 200);
}

function closeStepModal() {
  editingStepId = null;
  const modal = document.getElementById('step-modal');
  if (modal) modal.classList.add('hidden');
}

async function saveStep() {
  const textEl = document.getElementById('step-text');
  const text = textEl.value.trim();

  if (!text) { alert('Введите текст шага'); return; }

  const dishId = openCookingDishId;
  if (!dishId) return;

  const steps = cookingSteps[dishId] || [];

  if (editingStepId) {
    // Обновляем существующий
    const step = steps.find(s => s.id === editingStepId);
    if (!step) return;

    const { error } = await window.db
      .from('dish_steps')
      .update({ text })
      .eq('id', editingStepId);

    if (error) {
      console.error('Ошибка обновления:', error);
      alert('Не удалось сохранить');
      return;
    }

    step.text = text;
  } else {
    // Новый шаг
    const nextOrder = steps.length > 0 ? Math.max(...steps.map(s => s.step_order)) + 1 : 1;

    const { error } = await window.db
      .from('dish_steps')
      .insert({
        dish_id: dishId,
        step_order: nextOrder,
        text
      });

    if (error) {
      console.error('Ошибка добавления:', error);
      alert('Не удалось добавить шаг');
      return;
    }

    // Перезагружаем шаги
    await loadCookingSteps();
  }

  closeStepModal();
  renderCooking();
}

async function deleteStep(stepId) {
  if (!confirm('Удалить шаг?')) return;

  const { error } = await window.db
    .from('dish_steps')
    .delete()
    .eq('id', stepId);

  if (error) {
    console.error('Ошибка удаления:', error);
    alert('Не удалось удалить');
    return;
  }

  // Удаляем локально
  Object.keys(cookingSteps).forEach(dishId => {
    cookingSteps[dishId] = cookingSteps[dishId].filter(s => s.id !== stepId);
  });

  closeStepModal();
  renderCooking();
}

// ============================================
//  ЗАГРУЗКА ШАГОВ (для конкретного блюда)
// ============================================
async function loadCookingSteps() {
  try {
    const { data, error } = await window.db
      .from('dish_steps')
      .select('*')
      .order('step_order');

    if (error) {
      console.error('Ошибка загрузки шагов:', error);
      return;
    }

    cookingSteps = {};
    (data || []).forEach(s => {
      if (!cookingSteps[s.dish_id]) cookingSteps[s.dish_id] = [];
      cookingSteps[s.dish_id].push(s);
    });

    Object.keys(cookingSteps).forEach(k => {
      cookingSteps[k].sort((a, b) => a.step_order - b.step_order);
    });
  } catch (e) {
    console.error('Ошибка сети:', e);
  }
}

// ============================================
//  ФОТО ГОТОВОГО БЛЮДА
// ============================================

function openCookingPhotoSource(dishId) {
  let modal = document.getElementById('cooking-photo-source-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'cooking-photo-source-modal';
    modal.className = 'photo-source';
    modal.innerHTML = `
      <div class="photo-source-sheet">
        <div class="photo-source-handle"></div>
        <h3>Фото готового блюда</h3>
        <button class="photo-source-btn" data-source="camera">
          <span class="emoji">📷</span> Снять на камеру
        </button>
        <button class="photo-source-btn" data-source="gallery">
          <span class="emoji">🖼</span> Выбрать из галереи
        </button>
        <button class="photo-source-cancel" data-source="cancel">Отмена</button>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-source]');
      if (!btn) {
        if (e.target === modal) modal.classList.add('hidden');
        return;
      }

      const source = btn.dataset.source;
      modal.classList.add('hidden');

      if (source === 'camera' || source === 'gallery') {
        const fileInput = document.getElementById('cooking-photo-input');
        if (source === 'camera') {
          fileInput.setAttribute('capture', 'environment');
        } else {
          fileInput.removeAttribute('capture');
        }
        fileInput.click();
      }
    });
  }

  // Запоминаем dishId
  modal.dataset.dishId = dishId;
  modal.classList.remove('hidden');
}

async function handleCookingPhotoSelected(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  e.target.value = '';

  const modal = document.getElementById('cooking-photo-source-modal');
  const dishId = modal ? modal.dataset.dishId : null;
  if (!dishId) return;

  try {
    // Сжимаем
    const compressed = await compressCookingImage(file, 1600, 0.85);

    // Загружаем в Supabase Storage
    const fileName = `dish-${dishId}-${Date.now()}.jpg`;
    const filePath = fileName;

    const { error: uploadError } = await window.db.storage
      .from('dish-photos')
      .upload(filePath, compressed, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (uploadError) {
      console.error('Ошибка загрузки фото:', uploadError);
      alert('Не удалось загрузить фото');
      return;
    }

    // Получаем URL
    const { data: urlData } = window.db.storage
      .from('dish-photos')
      .getPublicUrl(filePath);

    const imageUrl = urlData.publicUrl;

    // Обновляем блюдо
    const { error: dbError } = await window.db
      .from('dishes')
      .update({ final_photo_url: imageUrl })
      .eq('id', dishId);

    if (dbError) {
      console.error('Ошибка сохранения URL:', dbError);
      alert('Не удалось сохранить фото');
      return;
    }

    // Обновляем локально
    const dish = cookingDishes.find(d => d.id === dishId);
    if (dish) dish.final_photo_url = imageUrl;

    renderCooking();
  } catch (err) {
    console.error('Ошибка:', err);
    alert('Ошибка при загрузке фото');
  }
}

function compressCookingImage(file, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        if (width > height && width > maxSize) {
          height = Math.round(height * maxSize / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round(width * maxSize / height);
          height = maxSize;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Не удалось сжать'));
        }, 'image/jpeg', quality);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
  const cookTab = document.querySelector('.tab-btn[data-tab="cooking"]');
  if (cookTab && !cookTab.dataset.boundCook) {
    cookTab.dataset.boundCook = '1';
    cookTab.addEventListener('click', () => {
      if (!cookingLoaded) loadCooking();
    });
  }

  const activeTab = document.querySelector('.tab-btn.active');
  if (activeTab && activeTab.dataset.tab === 'cooking' && !cookingLoaded) {
    loadCooking();
  }

  // Обработчики модалки шага
  const stepModal = document.getElementById('step-modal');
  if (stepModal && !stepModal.dataset.bound) {
    stepModal.dataset.bound = '1';

    document.getElementById('step-modal-cancel')?.addEventListener('click', closeStepModal);
    document.getElementById('step-modal-save')?.addEventListener('click', saveStep);

    stepModal.addEventListener('click', (e) => {
      if (e.target === stepModal) closeStepModal();
    });

    // Кнопка удаления (если редактирование)
    const delBtn = document.getElementById('step-modal-delete');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        if (editingStepId) deleteStep(editingStepId);
      });
    }
  }

  // Обработчик file-input для фото
  const fileInput = document.getElementById('cooking-photo-input');
  if (fileInput && !fileInput.dataset.bound) {
    fileInput.dataset.bound = '1';
    fileInput.addEventListener('change', handleCookingPhotoSelected);
  }
}