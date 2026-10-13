// ============================================
//  ЧАТ — раздел «Чат»
// ============================================

let chatMessages = [];
let chatLoaded = false;
let chatTimer = null;
let currentChannel = null;
let lastRenderedId = null;

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
    card.addEventListener('click', () => {
      openChannel(card.dataset.channel);
    });
  });
}

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
    return `
      <div class="chat-msg ${isMine ? 'mine' : 'theirs'}">
        <div class="chat-bubble">
          ${!isMine ? `<div class="chat-author">${escapeHtmlChat(m.author_name)}</div>` : ''}
          <div class="chat-text">${escapeHtmlChat(m.text)}</div>
          <div class="chat-time">${formatTime(m.created_at)}</div>
        </div>
      </div>
    `;
  }).join('');

  setTimeout(() => {
    listEl.scrollTop = listEl.scrollHeight;
  }, 50);
}

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

  const input = document.getElementById('chat-input');
  if (input && !input.dataset.bound) {
    input.dataset.bound = '1';
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // При фокусе прокручиваем чат вниз — чтобы поле ввода было над клавиатурой
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