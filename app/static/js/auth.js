// ============================================
// СОСТОЯНИЕ АВТОРИЗАЦИИ
// ============================================

const AUTH_TOKEN_KEY = 'moviehunter_token';
const AUTH_USER_KEY = 'moviehunter_user';

function getStoredUser() {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
}

function setStoredUser(user) {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

function removeStoredUser() {
    localStorage.removeItem(AUTH_USER_KEY);
}

// Получить токен из localStorage
function getToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
}

// Сохранить токен
function setToken(token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
}

// Удалить токен (логаут)
function removeToken() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    removeStoredUser();
}

// Проверить, авторизован ли юзер
function isAuthenticated() {
    return !!getToken();
}

// Общая функция для запросов с авторизацией
async function apiRequest(url, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    return fetch(url, { ...options, headers });
}


// ============================================
// ОБНОВЛЕНИЕ ШАПКИ
// ============================================

function fillUserData(user) {
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    const welcomeName = document.getElementById('welcomeName');

    if (userAvatar) {
        userAvatar.src = `/static/avatars/${user.avatar}.png`;
        userAvatar.onerror = () => { userAvatar.src = '/static/avatars/default.png'; };
    }
    if (userName) {
        userName.textContent = user.username;
    }
    if (welcomeName) {
        welcomeName.textContent = user.username;
    }
    if (typeof renderStreak === 'function') {
        renderStreak();
    }
}

async function updateHeader() {
    const html = document.documentElement;

    if (!isAuthenticated()) {
        html.classList.remove('auth-loaded');
        return;
    }

    // Сначала показываем из кэша (мгновенно, без мигания)
    const cachedUser = getStoredUser();
    if (cachedUser) {
        html.classList.add('auth-loaded');
        fillUserData(cachedUser);
    }

    // Параллельно обновляем в фоне
    try {
        const response = await apiRequest('/api/profile/me');

        if (!response.ok) {
            removeToken();
            html.classList.remove('auth-loaded');
            return;
        }

        const user = await response.json();
        setStoredUser(user);

        html.classList.add('auth-loaded');
        fillUserData(user);
    } catch (err) {
        console.error('Ошибка загрузки профиля:', err);
    }
}


// ============================================
// МОДАЛКА
// ============================================

let isLoginMode = true;  // true = вход, false = регистрация

function openAuthModal(mode = 'login') {
    isLoginMode = (mode === 'login');
    updateAuthModalUI();
    document.getElementById('authModal').classList.remove('hidden');
    document.getElementById('authUsername').focus();
}

function closeAuthModal() {
    document.getElementById('authModal').classList.add('hidden');
    document.getElementById('authForm').reset();
    document.getElementById('authError').classList.add('hidden');
}

function updateAuthModalUI() {
    const title = document.getElementById('authModalTitle');
    const subtitle = document.getElementById('authModalSubtitle');
    const submitBtn = document.getElementById('authSubmitBtn');
    const switchText = document.getElementById('authSwitchText');
    const switchBtn = document.getElementById('authSwitchBtn');

    if (isLoginMode) {
        title.textContent = 'Вход';
        subtitle.textContent = 'Играй и сохраняй свои результаты';
        submitBtn.textContent = 'Войти';
        switchText.textContent = 'Ещё нет аккаунта?';
        switchBtn.textContent = 'Зарегистрироваться';
    } else {
        title.textContent = 'Регистрация';
        subtitle.textContent = 'Создай аккаунт за 10 секунд';
        submitBtn.textContent = 'Создать аккаунт';
        switchText.textContent = 'Уже есть аккаунт?';
        switchBtn.textContent = 'Войти';
    }
}

function switchAuthMode() {
    isLoginMode = !isLoginMode;
    updateAuthModalUI();
    document.getElementById('authError').classList.add('hidden');
}

function showAuthError(message) {
    const errorDiv = document.getElementById('authError');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
}


// ============================================
// ОТПРАВКА ФОРМЫ
// ============================================

async function handleAuthSubmit(event) {
    event.preventDefault();

    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value;
    const submitBtn = document.getElementById('authSubmitBtn');
    const errorDiv = document.getElementById('authError');

    errorDiv.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Подождите...';

    try {
        if (isLoginMode) {
            // === ВХОД ===
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Ошибка входа');
            }

            const data = await response.json();
            setToken(data.access_token);

            // Перезагружаем — всё подтянется с токеном
            window.location.reload();

        } else {
            // === РЕГИСТРАЦИЯ ===
            const registerResponse = await fetch('/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (!registerResponse.ok) {
                const data = await registerResponse.json();
                throw new Error(data.detail || 'Ошибка регистрации');
            }

            // Автоматически логинимся после регистрации
            const loginResponse = await fetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const loginData = await loginResponse.json();
            setToken(loginData.access_token);

            // Перезагружаем — всё подтянется с токеном
            window.location.reload();
        }
    } catch (err) {
        showAuthError(err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = isLoginMode ? 'Войти' : 'Создать аккаунт';
    }
}


// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Обновить шапку при загрузке
    updateHeader();

    // Кнопка "Войти" в шапке
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => openAuthModal('login'));
    }

    // Кнопка закрыть модалку
    const closeBtn = document.getElementById('closeAuthModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeAuthModal);
    }

    // Клик по фону модалки — закрыть
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeAuthModal();
        });
    }

    // Переключение вход/регистрация
    const switchBtn = document.getElementById('authSwitchBtn');
    if (switchBtn) {
        switchBtn.addEventListener('click', switchAuthMode);
    }

    // Отправка формы
    const form = document.getElementById('authForm');
    if (form) {
        form.addEventListener('submit', handleAuthSubmit);
    }

    // Escape закрывает модалку
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeAuthModal();
        }
    });
});