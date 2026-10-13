// ============================================
//  ЧАТ — с поддержкой фото
// ============================================

let chatMessages = [];
let chatLoaded = false;
let chatTimer = null;
let currentChannel = null;
let lastRenderedId = null;
let isUploading = false;

// ============================================
//  СПИСОК КАНАЛОВ
// ============================================
function renderChannels() {
  const listEl = document.getElementById('channels-list');
  if (!listEl) return;

  listEl.innerHTML = `
    <div class="channel-card" data-channel="shift_report">
      <div class="channel-emoji">📊</div>
      <div class="channel-info">
        <div class="channel-name">Отчёт закрытия смены</div>
        <div class="channel-desc">Фото закрытия смены</div>
      </div>
      <svg class="channel-arrow" viewBox="0 0 24 24" fill="none">
        <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>

    <div class="channel-card" data-channel="writeoff">
      <div class="channel-emoji">📦</div>
      <div class="channel-info">
        <div class="channel-name">Списание продукции</div>
        <div class="channel-desc">Фото + подпись</div>
      </div>
      <svg class="channel-arrow" viewBox="0 0 24 24" fill="none">
        <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>

    <div class="channel-card" data-channel="chat">
      <div class="channel-emoji">💬</div>
      <div class="channel-info">
        <div class="channel-name">Общение поваров</div>
        <div class="channel-desc">Общий чат</div>
      </div>
      <svg class="channel-arrow" viewBox="0 0 24 24" fill="none">
        <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  `;

  listEl.querySelectorAll('.channel-card').forEach(card => {
    card.addEventListener('click', () => openChannel(card.dataset.channel));
  });
}

// ============================================
//  ОТКРЫТИЕ / ЗАКРЫТИЕ КАНАЛА
// ============================================
function openChannel(channel) {
  currentChannel = channel;

  if (channel === 'chat') {
    document.getElementById('chat-channels-view').classList.add('hidden');
    document.getElementById('chat-messages-view').classList.remove('hidden');
    document.getElementById('chat-view-title').textContent = 'Общение поваров';

    document.getElementById('tab-comments').classList.add('chat-open');
    document.body.classList.add('chat-open');

    loadMessages();
    startChatSync();
  } else {
    alert('Этот канал в разработке. Скоро будет.');
  }
}

function closeChannel() {
  currentChannel = null;
  stopChatSync();

  document.getElementById('chat-messages-view').classList.add('hidden');
  document.getElementById('chat-channels-view').classList.remove('hidden');

  document.getElementById('tab-comments').classList.remove('chat-open');
  document.body.classList.remove('chat-open');

  chatMessages = [];
  lastRenderedId = null;
}

// ============================================
//  ЗАГРУЗКА СООБЩЕНИЙ
// ============================================
async function loadMessages() {
  if (!currentChannel) return;

  try {
    const { data, error } = await window.db
      .from('messages')
      .select('*')
      .eq('channel', currentChannel)
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) {
      console.error('Ошибка загрузки сообщений:', error);
      return;
    }

    const newMessages = data || [];

    if (newMessages.length > 0) {
      const lastId = newMessages[newMessages.length - 1].id;
      const lastCount = chatMessages.length;
      if (lastId === lastRenderedId && newMessages.length === lastCount) {
        return;
      }
      lastRenderedId = lastId;
    } else if (chatMessages.length === 0 && newMessages.length === 0) {
      return;
    }

    chatMessages = newMessages;
    renderMessages();
  } catch (e) {
    console.error('Ошибка сети:', e);
  }
}

// ============================================
//  ОТРИСОВКА СООБЩЕНИЙ
// ============================================
function escapeHtmlChat(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function formatTime(iso) {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return hh + ':' + mm;
}

function renderMessages() {
  const listEl = document.getElementById('chat-messages-list');
  if (!listEl) return;

  if (chatMessages.length === 0) {
    listEl.innerHTML = '<div class="empty-state">Сообщений пока нет. Напишите первым!</div>';
    return;
  }

  const me = getCurrentUser();
  const myName = me ? me.name : '';

  listEl.innerHTML = chatMessages.map(m => {
    const isMine = m.author_name === myName;
    const hasText = m.text && m.text.trim();
    const hasImage = m.image_url;

    return `
      <div class="chat-msg ${isMine ? 'mine' : 'theirs'}">
        <div class="chat-bubble">
          ${!isMine ? `<div class="chat-author">${escapeHtmlChat(m.author_name)}</div>` : ''}
          ${hasImage ? `<img src="${m.image_url}" class="chat-photo" alt="" loading="lazy">` : ''}
          ${hasText ? `<div class="chat-text">${escapeHtmlChat(m.text)}</div>` : ''}
          <div class="chat-time">${formatTime(m.created_at)}</div>
        </div>
      </div>
    `;
  }).join('');

  setTimeout(() => {
    listEl.scrollTop = listEl.scrollHeight;
  }, 50);
}

// ============================================
//  ОТПРАВКА ТЕКСТА
// ============================================
async function sendMessage() {
  const input = document.getElementById('chat-input');
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  const me = getCurrentUser();
  if (!me) return;

  input.value = '';

  const tempMsg = {
    id: 'temp-' + Date.now(),
    channel: currentChannel,
    author_name: me.name,
    text: text,
    created_at: new Date().toISOString()
  };
  chatMessages.push(tempMsg);
  renderMessages();

  try {
    const { error } = await window.db
      .from('messages')
      .insert({
        channel: currentChannel,
        author_id: me.id,
        author_name: me.name,
        text: text
      });

    if (error) {
      console.error('Ошибка отправки:', error);
      chatMessages = chatMessages.filter(m => m.id !== tempMsg.id);
      renderMessages();
      alert('Не удалось отправить сообщение');
      return;
    }

    lastRenderedId = null;
    await loadMessages();
  } catch (e) {
    console.error('Ошибка сети:', e);
  }
}

// ============================================
//  ФОТО — выбор источника
// ============================================
function openPhotoSource() {
  let modal = document.getElementById('photo-source-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'photo-source-modal';
    modal.className = 'photo-source';
    modal.innerHTML = `
      <div class="photo-source-sheet">
        <div class="photo-source-handle"></div>
        <h3>Добавить фото</h3>
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
        const fileInput = document.getElementById('chat-photo-input');
        if (source === 'camera') {
          fileInput.setAttribute('capture', 'environment');
        } else {
          fileInput.removeAttribute('capture');
        }
        fileInput.click();
      }
    });
  }

  modal.classList.remove('hidden');
}

// ============================================
//  ФОТО — обработка выбора файла
// ============================================
async function handlePhotoSelected(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  e.target.value = '';

  if (isUploading) return;
  isUploading = true;

  const me = getCurrentUser();
  if (!me) { isUploading = false; return; }

  // Показать превью «загружается»
  const tempMsg = {
    id: 'temp-' + Date.now(),
    channel: currentChannel,
    author_name: me.name,
    text: 'Загрузка фото...',
    created_at: new Date().toISOString()
  };
  chatMessages.push(tempMsg);
  renderMessages();

  try {
    // 1. Сжимаем фото
    const compressed = await compressImage(file, 1280, 0.8);

    // 2. Загружаем в Supabase Storage
    const ext = 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = `${currentChannel}/${fileName}`;

    const { error: uploadError } = await window.db.storage
      .from('chat-photos')
      .upload(filePath, compressed, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (uploadError) {
      console.error('Ошибка загрузки фото:', uploadError);
      chatMessages = chatMessages.filter(m => m.id !== tempMsg.id);
      renderMessages();
      alert('Не удалось загрузить фото');
      isUploading = false;
      return;
    }

    // 3. Получаем публичный URL
    const { data: urlData } = window.db.storage
      .from('chat-photos')
      .getPublicUrl(filePath);

    const imageUrl = urlData.publicUrl;

    // 4. Сохраняем сообщение в БД
    const { error: dbError } = await window.db
      .from('messages')
      .insert({
        channel: currentChannel,
        author_id: me.id,
        author_name: me.name,
        text: '',
        image_url: imageUrl
      });

    if (dbError) {
      console.error('Ошибка сохранения:', dbError);
      chatMessages = chatMessages.filter(m => m.id !== tempMsg.id);
      renderMessages();
      alert('Не удалось сохранить фото');
      isUploading = false;
      return;
    }

    // 5. Убираем временное сообщение, перезагружаем
    chatMessages = chatMessages.filter(m => m.id !== tempMsg.id);
    lastRenderedId = null;
    await loadMessages();

  } catch (err) {
    console.error('Ошибка:', err);
    chatMessages = chatMessages.filter(m => m.id !== tempMsg.id);
    renderMessages();
    alert('Ошибка при загрузке фото');
  } finally {
    isUploading = false;
  }
}

// ============================================
//  СЖАТИЕ ФОТО
// ============================================
function compressImage(file, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        // Уменьшаем до maxSize по большей стороне
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
//  СИНХРОНИЗАЦИЯ
// ============================================
function startChatSync() {
  stopChatSync();
  chatTimer = setInterval(loadMessages, 3000);
}

function stopChatSync() {
  if (chatTimer) {
    clearInterval(chatTimer);
    chatTimer = null;
  }
}

// ============================================
//  ИНИЦИАЛИЗАЦИЯ
// ============================================
function initChat() {
  renderChannels();

  const backBtn = document.getElementById('chat-back-btn');
  if (backBtn && !backBtn.dataset.bound) {
    backBtn.dataset.bound = '1';
    backBtn.addEventListener('click', closeChannel);
  }

  const sendBtn = document.getElementById('chat-send-btn');
  if (sendBtn && !sendBtn.dataset.bound) {
    sendBtn.dataset.bound = '1';
    sendBtn.addEventListener('click', sendMessage);
  }

  const photoBtn = document.getElementById('chat-photo-btn');
  if (photoBtn && !photoBtn.dataset.bound) {
    photoBtn.dataset.bound = '1';
    photoBtn.addEventListener('click', openPhotoSource);
  }

  const photoInput = document.getElementById('chat-photo-input');
  if (photoInput && !photoInput.dataset.bound) {
    photoInput.dataset.bound = '1';
    photoInput.addEventListener('change', handlePhotoSelected);
  }

  const input = document.getElementById('chat-input');
  if (input && !input.dataset.bound) {
    input.dataset.bound = '1';
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    input.addEventListener('focus', () => {
      setTimeout(() => {
        const list = document.getElementById('chat-messages-list');
        if (list) list.scrollTop = list.scrollHeight;
      }, 300);
    });
  }

  const chatTab = document.querySelector('.tab-btn[data-tab="comments"]');
  if (chatTab && !chatTab.dataset.boundChat) {
    chatTab.dataset.boundChat = '1';
    chatTab.addEventListener('click', () => {
      if (currentChannel === 'chat') {
        loadMessages();
      }
    });
  }
}