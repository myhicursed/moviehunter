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

function getToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
}

function setToken(token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
}

function removeToken() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    removeStoredUser();
}

function isAuthenticated() {
    return !!getToken();
}

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
    const dashboardAvatar = document.getElementById('dashboardAvatar');
    const userName = document.getElementById('userName');
    const welcomeName = document.getElementById('welcomeName');

    if (userAvatar) {
        userAvatar.src = `/static/avatars/${user.avatar}.png`;
        userAvatar.onerror = () => { userAvatar.src = '/static/avatars/default.png'; };
    }
    if (dashboardAvatar) {
        dashboardAvatar.src = `/static/avatars/${user.avatar}.png`;
        dashboardAvatar.onerror = () => { dashboardAvatar.src = '/static/avatars/default.png'; };
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

    const cachedUser = getStoredUser();
    if (cachedUser) {
        html.classList.add('auth-loaded');
        fillUserData(cachedUser);
    }

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

let authMode = 'login'; // 'login' | 'register' | 'forgot'

function openAuthModal(mode = 'login') {
    authMode = mode;
    updateAuthModalUI();
    document.getElementById('authModal').classList.remove('hidden');

    setTimeout(() => {
        if (authMode === 'forgot') document.getElementById('authEmail').focus();
        else document.getElementById('authUsername').focus();
    }, 100);
}

function closeAuthModal() {
    document.getElementById('authModal').classList.add('hidden');
    document.getElementById('authForm').reset();
    document.getElementById('authMsgBox').classList.add('hidden');

    document.querySelectorAll('.toggle-password').forEach(btn => {
        const input = document.getElementById(btn.getAttribute('data-target'));
        if (input) input.type = 'password';
        btn.innerHTML = '<i class="fa-solid fa-eye"></i>';
        btn.classList.remove('text-brand');
    });
}

function updateAuthModalUI() {
    const title = document.getElementById('authModalTitle');
    const subtitle = document.getElementById('authModalSubtitle');
    const submitBtn = document.getElementById('authSubmitBtn');
    const switchText = document.getElementById('authSwitchText');
    const switchBtn = document.getElementById('authSwitchBtn');

    // Блоки полей
    const usernameBlock = document.getElementById('authUsernameBlock');
    const emailBlock = document.getElementById('authEmailBlock');
    const passwordBlock = document.getElementById('authPasswordBlock');
    const confirmBlock = document.getElementById('authConfirmPasswordBlock');

    // Инпуты (для управления required)
    const usernameInput = document.getElementById('authUsername');
    const emailInput = document.getElementById('authEmail');
    const passwordInput = document.getElementById('authPassword');
    const confirmInput = document.getElementById('authConfirmPassword');

    // Футеры
    const authFooter = document.getElementById('authFooter');
    const backToLogin = document.getElementById('authBackToLogin');
    const forgotBtn = document.getElementById('authForgotBtn');

    // Сброс видимости
    usernameBlock.classList.add('hidden');
    emailBlock.classList.add('hidden');
    passwordBlock.classList.add('hidden');
    confirmBlock.classList.add('hidden');
    authFooter.classList.add('hidden');
    backToLogin.classList.add('hidden');
    forgotBtn.classList.add('hidden');
    document.getElementById('authMsgBox').classList.add('hidden');

    usernameInput.required = false;
    emailInput.required = false;
    passwordInput.required = false;
    confirmInput.required = false;

    if (authMode === 'login') {
        title.textContent = 'Вход';
        subtitle.textContent = 'Играй и сохраняй свои результаты';
        submitBtn.textContent = 'Войти';
        switchText.textContent = 'Ещё нет аккаунта?';
        switchBtn.textContent = 'Зарегистрироваться';

        usernameBlock.classList.remove('hidden');
        passwordBlock.classList.remove('hidden');
        authFooter.classList.remove('hidden');
        forgotBtn.classList.remove('hidden');

        usernameInput.required = true;
        passwordInput.required = true;
    }
    else if (authMode === 'register') {
        title.textContent = 'Регистрация';
        subtitle.textContent = 'Создай аккаунт за 10 секунд';
        submitBtn.textContent = 'Создать аккаунт';
        switchText.textContent = 'Уже есть аккаунт?';
        switchBtn.textContent = 'Войти';

        usernameBlock.classList.remove('hidden');
        passwordBlock.classList.remove('hidden');
        confirmBlock.classList.remove('hidden');
        authFooter.classList.remove('hidden');

        usernameInput.required = true;
        passwordInput.required = true;
        confirmInput.required = true;
    }
    else if (authMode === 'forgot') {
        title.textContent = 'Сброс пароля';
        subtitle.textContent = 'Мы отправим ссылку на твой email';
        submitBtn.textContent = 'Отправить письмо';

        emailBlock.classList.remove('hidden');
        backToLogin.classList.remove('hidden');

        emailInput.required = true;
    }
}

function showAuthMessage(message, isError = true) {
    const msgBox = document.getElementById('authMsgBox');
    msgBox.textContent = message;
    msgBox.className = `px-4 py-3 rounded-lg text-sm text-center font-medium ${isError ? 'bg-red-500/20 border border-red-500/50 text-red-300' : 'bg-green-500/20 border border-green-500/50 text-green-300'}`;
}

// ============================================
// ОТПРАВКА ФОРМЫ
// ============================================

async function handleAuthSubmit(event) {
    event.preventDefault();

    const submitBtn = document.getElementById('authSubmitBtn');
    const msgBox = document.getElementById('authMsgBox');

    msgBox.classList.add('hidden');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Подождите...';

    try {
        if (authMode === 'login') {
            const username = document.getElementById('authUsername').value.trim();
            const password = document.getElementById('authPassword').value;

            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            if (!response.ok) throw new Error((await response.json()).detail || 'Неверный логин или пароль');
            setToken((await response.json()).access_token);
            window.location.reload();
            return;
        }

        if (authMode === 'register') {
            const username = document.getElementById('authUsername').value.trim();
            const password = document.getElementById('authPassword').value;
            const confirmPassword = document.getElementById('authConfirmPassword').value;

            if (password !== confirmPassword) throw new Error('Пароли не совпадают!');

            const regResp = await fetch('/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            if (!regResp.ok) throw new Error((await regResp.json()).detail || 'Ошибка регистрации');

            const loginResp = await fetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            setToken((await loginResp.json()).access_token);
            window.location.reload();
            return;
        }

        if (authMode === 'forgot') {
            const email = document.getElementById('authEmail').value.trim();

            const response = await fetch('/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            if (!response.ok) throw new Error('Ошибка при отправке письма');

            showAuthMessage('Письмо отправлено! Проверь свою почту.', false);
            document.getElementById('authForm').reset();
        }
    } catch (err) {
        showAuthMessage(err.message, true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    updateHeader();

    document.getElementById('loginBtn')?.addEventListener('click', () => openAuthModal('login'));
    document.getElementById('closeAuthModal')?.addEventListener('click', closeAuthModal);

    document.getElementById('authSwitchBtn')?.addEventListener('click', () => {
        openAuthModal(authMode === 'login' ? 'register' : 'login');
    });

    document.getElementById('authForgotBtn')?.addEventListener('click', () => openAuthModal('forgot'));
    document.getElementById('authBackToLoginBtn')?.addEventListener('click', () => openAuthModal('login'));

    document.getElementById('authForm')?.addEventListener('submit', handleAuthSubmit);

    document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('authModal');
        if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
            closeAuthModal();
        }
    });

    // Глазики
    document.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', function () {
            const input = document.getElementById(this.getAttribute('data-target'));
            if (input.type === 'password') {
                input.type = 'text';
                this.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
                this.classList.add('text-brand');
            } else {
                input.type = 'password';
                this.innerHTML = '<i class="fa-solid fa-eye"></i>';
                this.classList.remove('text-brand');
            }
        });
    });
});