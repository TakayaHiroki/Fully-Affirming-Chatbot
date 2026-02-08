// ===== State =====
const state = {
    chats: {}, // { chatId: { id, title, messages: [], settings: {}, createdAt } }
    currentChatId: null,
    isLoading: false,
    defaultSettings: {
        gender: 'female',
        age: 'twenties',
        style: 'casual',
        quirk: ''
    }
};

// ===== DOM Elements =====
const sidebar = document.getElementById('sidebar');
const chatList = document.getElementById('chat-list');
const newChatBtn = document.getElementById('new-chat-btn');
const menuBtn = document.getElementById('menu-btn');
const chatTitle = document.getElementById('chat-title');
const editTitleBtn = document.getElementById('edit-title-btn');
const chatSettingsBtn = document.getElementById('chat-settings-btn');

const chatSettingsModal = document.getElementById('chat-settings-modal');
const closeChatSettingsBtn = document.getElementById('close-chat-settings');
const saveChatSettingsBtn = document.getElementById('save-chat-settings');
const deleteChatBtn = document.getElementById('delete-chat-btn');
const chatQuirkInput = document.getElementById('chat-quirk-input');

const titleModal = document.getElementById('title-modal');
const closeTitleModalBtn = document.getElementById('close-title-modal');
const titleInput = document.getElementById('title-input');
const saveTitleBtn = document.getElementById('save-title');
const cancelTitleBtn = document.getElementById('cancel-title');

const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

// ===== Initialize =====
function init() {
    loadData();
    setupEventListeners();

    if (Object.keys(state.chats).length === 0) {
        createNewChat();
    } else {
        const lastChatId = localStorage.getItem('lastChatId');
        if (lastChatId && state.chats[lastChatId]) {
            switchToChat(lastChatId);
        } else {
            switchToChat(Object.keys(state.chats)[0]);
        }
    }

    renderChatList();
}

function loadData() {
    const savedChats = localStorage.getItem('chatbot-chats');
    if (savedChats) {
        state.chats = JSON.parse(savedChats);
    }

    const savedDefaults = localStorage.getItem('chatbot-defaults');
    if (savedDefaults) {
        Object.assign(state.defaultSettings, JSON.parse(savedDefaults));
    }
}

function saveData() {
    localStorage.setItem('chatbot-chats', JSON.stringify(state.chats));
    if (state.currentChatId) {
        localStorage.setItem('lastChatId', state.currentChatId);
    }
}

// ===== Event Listeners =====
function setupEventListeners() {
    newChatBtn.addEventListener('click', () => { createNewChat(); closeSidebar(); });
    menuBtn.addEventListener('click', toggleSidebar);

    // チャット設定モーダル
    chatSettingsBtn.addEventListener('click', openChatSettings);
    closeChatSettingsBtn.addEventListener('click', () => chatSettingsModal.classList.remove('active'));
    saveChatSettingsBtn.addEventListener('click', saveChatSettings);
    deleteChatBtn.addEventListener('click', () => {
        if (confirm('このチャットを削除しますか？')) {
            deleteChat(state.currentChatId);
            chatSettingsModal.classList.remove('active');
        }
    });

    // タイトル編集モーダル
    editTitleBtn.addEventListener('click', openTitleModal);
    closeTitleModalBtn.addEventListener('click', () => titleModal.classList.remove('active'));
    cancelTitleBtn.addEventListener('click', () => titleModal.classList.remove('active'));
    saveTitleBtn.addEventListener('click', saveTitle);

    // モーダル外クリックで閉じる
    chatSettingsModal.addEventListener('click', (e) => {
        if (e.target === chatSettingsModal) chatSettingsModal.classList.remove('active');
    });
    titleModal.addEventListener('click', (e) => {
        if (e.target === titleModal) titleModal.classList.remove('active');
    });

    // 設定ボタン
    document.querySelectorAll('.option-buttons').forEach(group => {
        group.addEventListener('click', (e) => {
            if (e.target.classList.contains('option-btn')) {
                group.querySelectorAll('.option-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
            }
        });
    });

    // メッセージ入力
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
        sendBtn.disabled = !messageInput.value.trim() || state.isLoading;
    });

    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!sendBtn.disabled) sendMessage();
        }
    });

    sendBtn.addEventListener('click', sendMessage);

    // サイドバー外クリック
    document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('open') &&
            !sidebar.contains(e.target) && e.target !== menuBtn) {
            closeSidebar();
        }
    });
}

// ===== Sidebar =====
function toggleSidebar() { sidebar.classList.toggle('open'); }
function closeSidebar() { sidebar.classList.remove('open'); }

// ===== Chat Management =====
function createNewChat() {
    const id = 'chat_' + Date.now();
    state.chats[id] = {
        id,
        title: '新しいチャット',
        messages: [],
        settings: { ...state.defaultSettings },
        createdAt: Date.now()
    };
    state.currentChatId = id;
    saveData();
    renderChatList();
    renderMessages();
    updateChatTitle();
}

function switchToChat(chatId) {
    if (!state.chats[chatId]) return;
    state.currentChatId = chatId;
    saveData();
    renderChatList();
    renderMessages();
    updateChatTitle();
}

function deleteChat(chatId) {
    delete state.chats[chatId];

    if (Object.keys(state.chats).length === 0) {
        createNewChat();
    } else if (state.currentChatId === chatId) {
        switchToChat(Object.keys(state.chats)[0]);
    }

    saveData();
    renderChatList();
}

function updateChatTitle() {
    const chat = state.chats[state.currentChatId];
    chatTitle.textContent = chat ? chat.title : '新しいチャット';
}

function renderChatList() {
    chatList.innerHTML = '';
    const sortedChats = Object.values(state.chats).sort((a, b) => b.createdAt - a.createdAt);

    sortedChats.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'chat-item' + (chat.id === state.currentChatId ? ' active' : '');
        item.textContent = chat.title;
        item.addEventListener('click', () => { switchToChat(chat.id); closeSidebar(); });
        chatList.appendChild(item);
    });
}

// ===== Settings Modal =====
function openChatSettings() {
    const chat = state.chats[state.currentChatId];
    if (!chat) return;

    const settings = chat.settings || state.defaultSettings;

    document.querySelectorAll('[data-setting-group]').forEach(group => {
        const settingName = group.dataset.settingGroup;
        const value = settings[settingName];
        group.querySelectorAll('.option-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === value);
        });
    });

    chatQuirkInput.value = settings.quirk || '';
    chatSettingsModal.classList.add('active');
}

function saveChatSettings() {
    const chat = state.chats[state.currentChatId];
    if (!chat) return;

    chat.settings = {
        gender: document.querySelector('[data-setting-group="gender"] .option-btn.active')?.dataset.value || 'female',
        age: document.querySelector('[data-setting-group="age"] .option-btn.active')?.dataset.value || 'twenties',
        style: document.querySelector('[data-setting-group="style"] .option-btn.active')?.dataset.value || 'casual',
        quirk: chatQuirkInput.value
    };

    saveData();
    chatSettingsModal.classList.remove('active');
}

// ===== Title Modal =====
function openTitleModal() {
    const chat = state.chats[state.currentChatId];
    if (!chat) return;
    titleInput.value = chat.title;
    titleModal.classList.add('active');
    titleInput.focus();
}

function saveTitle() {
    const chat = state.chats[state.currentChatId];
    if (!chat) return;

    const newTitle = titleInput.value.trim() || '新しいチャット';
    chat.title = newTitle;
    saveData();
    updateChatTitle();
    renderChatList();
    titleModal.classList.remove('active');
}

// ===== Message Rendering =====
function renderMessages() {
    chatMessages.innerHTML = '';
    const chat = state.chats[state.currentChatId];

    if (!chat || chat.messages.length === 0) {
        chatMessages.innerHTML = `
            <div class="welcome-message">
                <div class="emoji">💖</div>
                <p>こんにちは！<br>なんでも話してね。<br>全力で肯定するよ！</p>
            </div>
        `;
    } else {
        chat.messages.forEach(msg => addMessageToDOM(msg.role, msg.content));
    }
    scrollToBottom();
}

function addMessageToDOM(role, content) {
    const msgEl = document.createElement('div');
    msgEl.className = `message ${role === 'user' ? 'user' : 'bot'}`;
    msgEl.textContent = content;
    chatMessages.appendChild(msgEl);
}

function addTypingIndicator() {
    const typing = document.createElement('div');
    typing.className = 'message bot';
    typing.id = 'typing-indicator';
    typing.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    chatMessages.appendChild(typing);
    scrollToBottom();
}

function removeTypingIndicator() {
    document.getElementById('typing-indicator')?.remove();
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ===== API Communication =====
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || state.isLoading) return;

    const chat = state.chats[state.currentChatId];
    if (!chat) return;

    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendBtn.disabled = true;
    state.isLoading = true;

    chat.messages.push({ role: 'user', content: message });
    addMessageToDOM('user', message);
    scrollToBottom();
    addTypingIndicator();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                settings: chat.settings || state.defaultSettings,
                history: chat.messages.slice(-10)
            }),
        });

        removeTypingIndicator();
        if (!response.ok) throw new Error('API failed');

        const data = await response.json();
        chat.messages.push({ role: 'assistant', content: data.reply });
        addMessageToDOM('assistant', data.reply);
        saveData();

        // 最初のやり取り後にAIでタイトル生成
        if (chat.messages.length === 2 && chat.title === '新しいチャット') {
            generateTitle(chat);
        }

    } catch (error) {
        console.error('Error:', error);
        removeTypingIndicator();
        const errorMsg = 'ごめんね、うまく返事できなかった...！でも君は最高だよ！✨';
        chat.messages.push({ role: 'assistant', content: errorMsg });
        addMessageToDOM('assistant', errorMsg);
        saveData();
    }

    state.isLoading = false;
    sendBtn.disabled = !messageInput.value.trim();
    scrollToBottom();
}

async function generateTitle(chat) {
    try {
        const response = await fetch('/api/generate-title', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: chat.messages.slice(0, 4) }),
        });

        if (response.ok) {
            const data = await response.json();
            if (data.title && data.title !== '新しいチャット') {
                chat.title = data.title;
                saveData();
                updateChatTitle();
                renderChatList();
            }
        }
    } catch (error) {
        console.error('Title generation failed:', error);
    }
}

// ===== Start =====
init();
