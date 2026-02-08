const state = {
    settings: {
        gender: 'female',
        age: 'twenties',
        style: 'casual',
        quirk: ''
    },
    history: [],
    isLoading: false
};

const settingsScreen = document.getElementById('settings-screen');
const chatScreen = document.getElementById('chat-screen');
const startChatBtn = document.getElementById('start-chat-btn');
const settingsBtn = document.getElementById('settings-btn');
const clearBtn = document.getElementById('clear-btn');
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const quirkInput = document.getElementById('quirk-input');

function init() {
    const savedSettings = localStorage.getItem('chatbot-settings');
    if (savedSettings) {
        Object.assign(state.settings, JSON.parse(savedSettings));
        updateSettingsUI();
    }

    const savedHistory = localStorage.getItem('chatbot-history');
    if (savedHistory) {
        state.history = JSON.parse(savedHistory);
    }

    setupEventListeners();
}

function updateSettingsUI() {
    document.querySelectorAll('.option-btn').forEach(btn => {
        const setting = btn.dataset.setting;
        const value = btn.dataset.value;
        btn.classList.toggle('active', state.settings[setting] === value);
    });

    quirkInput.value = state.settings.quirk || '';
}

function setupEventListeners() {
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const setting = btn.dataset.setting;
            const value = btn.dataset.value;
            state.settings[setting] = value;
            document.querySelectorAll(`[data-setting="${setting}"]`).forEach(b => {
                b.classList.remove('active');
            });
            btn.classList.add('active');
            saveSettings();
        });
    });

    quirkInput.addEventListener('input', () => {
        state.settings.quirk = quirkInput.value;
        saveSettings();
    });

    startChatBtn.addEventListener('click', () => {
        switchToChat();
    });

    settingsBtn.addEventListener('click', () => {
        switchToSettings();
    });

    clearBtn.addEventListener('click', () => {
        if (confirm('チャット履歴を削除しますか？')) {
            state.history = [];
            localStorage.removeItem('chatbot-history');
            renderMessages();
        }
    });

    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
        sendBtn.disabled = !messageInput.value.trim() || state.isLoading;
    });

    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!sendBtn.disabled) {
                sendMessage();
            }
        }
    });

    sendBtn.addEventListener('click', sendMessage);
}

function saveSettings() {
    localStorage.setItem('chatbot-settings', JSON.stringify(state.settings));
}

function saveHistory() {
    const historyToSave = state.history.slice(-50);
    localStorage.setItem('chatbot-history', JSON.stringify(historyToSave));
}

function switchToChat() {
    settingsScreen.classList.remove('active');
    chatScreen.classList.add('active');
    renderMessages();
    messageInput.focus();
}

function switchToSettings() {
    chatScreen.classList.remove('active');
    settingsScreen.classList.add('active');
}

function renderMessages() {
    chatMessages.innerHTML = '';

    if (state.history.length === 0) {
        const welcome = document.createElement('div');
        welcome.className = 'welcome-message';
        welcome.innerHTML = `
            <div class="emoji">💖</div>
            <p>こんにちは！<br>なんでも話してね。<br>全力で肯定するよ！✨</p>
        `;
        chatMessages.appendChild(welcome);
    } else {
        state.history.forEach(msg => {
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
    typing.className = 'message bot typing';
    typing.id = 'typing-indicator';
    typing.innerHTML = `
        <div class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;
    chatMessages.appendChild(typing);
    scrollToBottom();
}

function removeTypingIndicator() {
    const typing = document.getElementById('typing-indicator');
    if (typing) {
        typing.remove();
    }
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || state.isLoading) return;

    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendBtn.disabled = true;
    state.isLoading = true;

    state.history.push({ role: 'user', content: message });
    addMessageToDOM('user', message);
    scrollToBottom();

    addTypingIndicator();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                settings: state.settings,
                history: state.history.slice(-10)
            }),
        });

        removeTypingIndicator();

        if (!response.ok) {
            throw new Error('API request failed');
        }

        const data = await response.json();
        const reply = data.reply;

        state.history.push({ role: 'assistant', content: reply });
        addMessageToDOM('assistant', reply);
        saveHistory();

    } catch (error) {
        console.error('Error:', error);
        removeTypingIndicator();

        const errorMsg = 'ごめんね、うまく返事できなかった...！でも君は最高だよ！✨';
        state.history.push({ role: 'assistant', content: errorMsg });
        addMessageToDOM('assistant', errorMsg);
        saveHistory();
    }

    state.isLoading = false;
    sendBtn.disabled = !messageInput.value.trim();
    scrollToBottom();
}

init();
