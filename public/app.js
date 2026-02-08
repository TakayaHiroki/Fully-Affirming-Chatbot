// ===== State =====
const state = {
    settings: {
        gender: 'female',
        age: 'twenties',
        style: 'casual',
        quirk: ''
    },
    chats: {}, // { chatId: { id, title, messages: [], createdAt } }
    currentChatId: null,
    isLoading: false
};

// ===== DOM Elements =====
const sidebar = document.getElementById('sidebar');
const chatList = document.getElementById('chat-list');
const newChatBtn = document.getElementById('new-chat-btn');
const settingsBtn = document.getElementById('settings-btn');
const menuBtn = document.getElementById('menu-btn');
const deleteChatBtn = document.getElementById('delete-chat-btn');
const chatTitle = document.getElementById('chat-title');

const settingsScreen = document.getElementById('settings-screen');
const chatScreen = document.getElementById('chat-screen');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const quirkInput = document.getElementById('quirk-input');

const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

// ===== Initialize =====
function init() {
    loadData();
    setupEventListeners();

    // 初回起動時またはチャットがない場合
    if (Object.keys(state.chats).length === 0) {
        createNewChat();
    } else {
        // 最後に使ったチャットを開く、またはチャット画面を表示
        const lastChatId = localStorage.getItem('lastChatId');
        if (lastChatId && state.chats[lastChatId]) {
            switchToChat(lastChatId);
        } else {
            const firstChatId = Object.keys(state.chats)[0];
            switchToChat(firstChatId);
        }
    }

    renderChatList();
    showScreen('chat');
}

function loadData() {
    const savedSettings = localStorage.getItem('chatbot-settings');
    if (savedSettings) {
        Object.assign(state.settings, JSON.parse(savedSettings));
    }

    const savedChats = localStorage.getItem('chatbot-chats');
    if (savedChats) {
        state.chats = JSON.parse(savedChats);
    }

    updateSettingsUI();
}

function saveData() {
    localStorage.setItem('chatbot-settings', JSON.stringify(state.settings));
    localStorage.setItem('chatbot-chats', JSON.stringify(state.chats));
    if (state.currentChatId) {
        localStorage.setItem('lastChatId', state.currentChatId);
    }
}

// ===== Event Listeners =====
function setupEventListeners() {
    // 新規チャット
    newChatBtn.addEventListener('click', () => {
        createNewChat();
        closeSidebar();
    });

    // 設定画面
    settingsBtn.addEventListener('click', () => {
        showScreen('settings');
        closeSidebar();
    });

    // 設定保存
    saveSettingsBtn.addEventListener('click', () => {
        state.settings.quirk = quirkInput.value;
        saveData();
        showScreen('chat');
    });

    // オプションボタン
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const setting = btn.dataset.setting;
            const value = btn.dataset.value;
            state.settings[setting] = value;
            document.querySelectorAll(`[data-setting="${setting}"]`).forEach(b => {
                b.classList.remove('active');
            });
            btn.classList.add('active');
        });
    });

    // サイドバートグル（モバイル）
    menuBtn.addEventListener('click', toggleSidebar);

    // チャット削除
    deleteChatBtn.addEventListener('click', () => {
        if (state.currentChatId && confirm('このチャットを削除しますか？')) {
            deleteChat(state.currentChatId);
        }
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

    // オーバーレイクリックでサイドバー閉じる
    document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('open') &&
            !sidebar.contains(e.target) &&
            e.target !== menuBtn) {
            closeSidebar();
        }
    });
}

function updateSettingsUI() {
    document.querySelectorAll('.option-btn').forEach(btn => {
        const setting = btn.dataset.setting;
        const value = btn.dataset.value;
        btn.classList.toggle('active', state.settings[setting] === value);
    });
    quirkInput.value = state.settings.quirk || '';
}

// ===== Screen Navigation =====
function showScreen(screen) {
    settingsScreen.classList.remove('active');
    chatScreen.classList.remove('active');

    if (screen === 'settings') {
        settingsScreen.classList.add('active');
    } else {
        chatScreen.classList.add('active');
    }
}

// ===== Sidebar =====
function toggleSidebar() {
    sidebar.classList.toggle('open');
}

function closeSidebar() {
    sidebar.classList.remove('open');
}

// ===== Chat Management =====
function createNewChat() {
    const id = 'chat_' + Date.now();
    state.chats[id] = {
        id: id,
        title: '新しいチャット',
        messages: [],
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
    showScreen('chat');
}

function deleteChat(chatId) {
    delete state.chats[chatId];

    if (Object.keys(state.chats).length === 0) {
        createNewChat();
    } else if (state.currentChatId === chatId) {
        const firstChatId = Object.keys(state.chats)[0];
        switchToChat(firstChatId);
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

    // 新しい順にソート
    const sortedChats = Object.values(state.chats).sort((a, b) => b.createdAt - a.createdAt);

    sortedChats.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'chat-item' + (chat.id === state.currentChatId ? ' active' : '');
        item.textContent = chat.title;
        item.addEventListener('click', () => {
            switchToChat(chat.id);
            closeSidebar();
        });
        chatList.appendChild(item);
    });
}

// ===== Message Rendering =====
function renderMessages() {
    chatMessages.innerHTML = '';
    const chat = state.chats[state.currentChatId];

    if (!chat || chat.messages.length === 0) {
        const welcome = document.createElement('div');
        welcome.className = 'welcome-message';
        welcome.innerHTML = `
            <div class="emoji">💖</div>
            <p>こんにちは！<br>なんでも話してね。<br>全力で肯定するよ！</p>
        `;
        chatMessages.appendChild(welcome);
    } else {
        chat.messages.forEach(msg => {
            addMessageToDOM(msg.role, msg.content);
        });
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
    typing.innerHTML = `
        <div class="typing-indicator">
            <span></span><span></span><span></span>
        </div>
    `;
    chatMessages.appendChild(typing);
    scrollToBottom();
}

function removeTypingIndicator() {
    const typing = document.getElementById('typing-indicator');
    if (typing) typing.remove();
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

    // ユーザーメッセージを追加
    chat.messages.push({ role: 'user', content: message });

    // 最初のメッセージでタイトルを更新
    if (chat.messages.length === 1) {
        chat.title = message.slice(0, 30) + (message.length > 30 ? '...' : '');
        updateChatTitle();
        renderChatList();
    }

    addMessageToDOM('user', message);
    scrollToBottom();
    addTypingIndicator();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                settings: state.settings,
                history: chat.messages.slice(-10)
            }),
        });

        removeTypingIndicator();

        if (!response.ok) throw new Error('API failed');

        const data = await response.json();
        const reply = data.reply;

        chat.messages.push({ role: 'assistant', content: reply });
        addMessageToDOM('assistant', reply);
        saveData();

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

// ===== Start =====
init();
