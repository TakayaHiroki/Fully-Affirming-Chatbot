// ===== State =====
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

// ===== DOM Elements =====
const settingsScreen = document.getElementById('settings-screen');
const chatScreen = document.getElementById('chat-screen');
const startChatBtn = document.getElementById('start-chat-btn');
const settingsBtn = document.getElementById('settings-btn');
const clearBtn = document.getElementById('clear-btn');
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const quirkInput = document.getElementById('quirk-input');

// ===== Initialize =====
function init() {
    // Load saved settings
    const savedSettings = localStorage.getItem('chatbot-settings');
    if (savedSettings) {
        Object.assign(state.settings, JSON.parse(savedSettings));
        updateSettingsUI();
    }

    // Load chat history
    const savedHistory = localStorage.getItem('chatbot-history');
    if (savedHistory) {
        state.history = JSON.parse(savedHistory);
    }

    // Setup event listeners
    setupEventListeners();
}

function updateSettingsUI() {
    // Update option buttons
    document.querySelectorAll('.option-btn').forEach(btn => {
        const setting = btn.dataset.setting;
        const value = btn.dataset.value;
        btn.classList.toggle('active', state.settings[setting] === value);
    });

    // Update quirk input
    quirkInput.value = state.settings.quirk || '';
}

function setupEventListeners() {
    // Option buttons
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const setting = btn.dataset.setting;
            const value = btn.dataset.value;

            // Update state
            state.settings[setting] = value;

            // Update UI
            document.querySelectorAll(`[data-setting="${setting}"]`).forEach(b => {
                b.classList.remove('active');
            });
            btn.classList.add('active');

            // Save
            saveSettings();
        });
    });

    // Quirk input
    quirkInput.addEventListener('input', () => {
        state.settings.quirk = quirkInput.value;
        saveSettings();
    });

    // Start chat button
    startChatBtn.addEventListener('click', () => {
        switchToChat();
    });

    // Settings button (back to settings)
    settingsBtn.addEventListener('click', () => {
        switchToSettings();
    });

    // Clear history button
    clearBtn.addEventListener('click', () => {
        if (confirm('チャット履歴を削除しますか？')) {
            state.history = [];
            localStorage.removeItem('chatbot-history');
            renderMessages();
        }
    });

    // Message input
    messageInput.addEventListener('input', () => {
        // Auto-resize
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';

        // Enable/disable send button
        sendBtn.disabled = !messageInput.value.trim() || state.isLoading;
    });

    // Send on Enter (but Shift+Enter for new line)
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!sendBtn.disabled) {
                sendMessage();
            }
        }
    });

    // Send button
    sendBtn.addEventListener('click', sendMessage);
}

function saveSettings() {
    localStorage.setItem('chatbot-settings', JSON.stringify(state.settings));
}

function saveHistory() {
    // Keep only last 50 messages to avoid storage issues
    const historyToSave = state.history.slice(-50);
    localStorage.setItem('chatbot-history', JSON.stringify(historyToSave));
}

// ===== Screen Navigation =====
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

// ===== Message Rendering =====
function renderMessages() {
    chatMessages.innerHTML = '';

    if (state.history.length === 0) {
        // Show welcome message
        const welcome = document.createElement('div');
        welcome.className = 'welcome-message';
        welcome.innerHTML = `
            <div class="emoji">💖</div>
            <p>こんにちは！<br>なんでも話してね。<br>全力で肯定するよ！✨</p>
        `;
        chatMessages.appendChild(welcome);
    } else {
        // Render chat history
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

// ===== API Communication =====
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || state.isLoading) return;

    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendBtn.disabled = true;
    state.isLoading = true;

    // Add user message
    state.history.push({ role: 'user', content: message });
    addMessageToDOM('user', message);
    scrollToBottom();

    // Show typing indicator
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
                history: state.history.slice(-10) // Send last 10 messages for context
            }),
        });

        removeTypingIndicator();

        if (!response.ok) {
            throw new Error('API request failed');
        }

        const data = await response.json();
        const reply = data.reply;

        // Add bot message
        state.history.push({ role: 'assistant', content: reply });
        addMessageToDOM('assistant', reply);
        saveHistory();

    } catch (error) {
        console.error('Error:', error);
        removeTypingIndicator();

        // Show error message
        const errorMsg = 'ごめんね、うまく返事できなかった...！でも君は最高だよ！✨';
        state.history.push({ role: 'assistant', content: errorMsg });
        addMessageToDOM('assistant', errorMsg);
        saveHistory();
    }

    state.isLoading = false;
    sendBtn.disabled = !messageInput.value.trim();
    scrollToBottom();
}

// ===== Start =====
init();
