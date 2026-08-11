// ============================================
// КОНФИГ (передан через data-атрибуты)
// ============================================

const config = document.getElementById('profileConfig');
const isOwnProfile = config.dataset.isOwn === 'true';
const targetUserId = config.dataset.userId || null;

// Список доступных аватаров (синхронизируй с бекендом)
const AVAILABLE_AVATARS = ['default', 'avatar_1', 'avatar_2', 'avatar_3'];


// ============================================
// ЭКРАНЫ
// ============================================

function showProfileScreen(id) {
    ['profileLoading', 'profileError', 'profileContent'].forEach(s => {
        document.getElementById(s).classList.add('hidden');
    });
    document.getElementById(id).classList.remove('hidden');
}


// ============================================
// ЗАГРУЗКА ПРОФИЛЯ
// ============================================

async function loadProfile() {
    showProfileScreen('profileLoading');

    // Если свой профиль, но не авторизован — редирект на главную
    if (isOwnProfile && !isAuthenticated()) {
        window.location.href = '/';
        return;
    }

    // URL для API
    const url = isOwnProfile
        ? '/api/profile/me'
        : `/api/profile/${targetUserId}`;

    try {
        const response = isOwnProfile
            ? await apiRequest(url)
            : await fetch(url);

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Пользователь не найден');
            }
            throw new Error('Не удалось загрузить профиль');
        }

        const user = await response.json();
        renderProfile(user);
        showProfileScreen('profileContent');

    } catch (err) {
        document.getElementById('profileErrorMsg').textContent = err.message;
        showProfileScreen('profileError');
    }
}


// ============================================
// ОТРИСОВКА ПРОФИЛЯ
// ============================================

function renderProfile(user) {
    // Аватар
    const avatar = document.getElementById('profileAvatar');
    avatar.src = `/static/avatars/${user.avatar}.png`;
    avatar.onerror = () => { avatar.src = '/static/avatars/default.png'; };

    // Ник
    document.getElementById('profileUsername').textContent = user.username;

    // Дата регистрации
    const date = new Date(user.created_at);
    const dateStr = date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
    document.getElementById('profileCreatedAt').textContent = dateStr;

    // Статистика
    const stats = user.stats;
    document.getElementById('statPoints').textContent = stats.total_points;
    document.getElementById('statCorrect').textContent = stats.correct_answers;
    document.getElementById('statWrong').textContent = stats.wrong_answers;
    document.getElementById('statAccuracy').textContent = `${stats.accuracy}%`;

    // Любимый жанр
    if (stats.favorite_genre) {
        const genreNames = {
            action: '💥 Боевик',
            comedy: '😂 Комедия',
            drama: '🎭 Драма',
            horror: '👻 Ужасы',
            scifi: '🚀 Фантастика',
            thriller: '🔪 Триллер',
            romance: '💕 Мелодрама',
            sport: '⚽ Спорт',
            war: '💂 Военные',
            adventures: '🧭 Приключения'
        };
        document.getElementById('favoriteGenre').textContent =
            genreNames[stats.favorite_genre] || stats.favorite_genre;
        document.getElementById('favoriteGenreBlock').classList.remove('hidden');
    }

    // Если никогда не играл — покажем блок
    if (stats.total_answers === 0) {
        document.getElementById('noStatsBlock').classList.remove('hidden');
    }

    // На своей странице — показать кнопки управления
    if (isOwnProfile) {
        document.getElementById('changeAvatarBtn').classList.remove('hidden');
        document.getElementById('logoutBtn').classList.remove('hidden');
    }
}


// ============================================
// СМЕНА АВАТАРА
// ============================================

function openAvatarModal() {
    const grid = document.getElementById('avatarsGrid');
    grid.innerHTML = AVAILABLE_AVATARS.map(avatar => `
        <button 
            class="avatar-choice group relative aspect-square rounded-full overflow-hidden border-4 border-dark-600 hover:border-brand transition"
            data-avatar="${avatar}"
        >
            <img 
                src="/static/avatars/${avatar}.png" 
                alt="${avatar}" 
                class="w-full h-full object-cover group-hover:scale-110 transition"
                onerror="this.src='/static/avatars/default.png'"
            >
        </button>
    `).join('');

    grid.querySelectorAll('.avatar-choice').forEach(btn => {
        btn.addEventListener('click', () => changeAvatar(btn.dataset.avatar));
    });

    document.getElementById('avatarModal').classList.remove('hidden');
}

function closeAvatarModal() {
    document.getElementById('avatarModal').classList.add('hidden');
}

async function changeAvatar(avatar) {
    try {
        const response = await apiRequest('/api/profile/me/avatar', {
            method: 'PATCH',
            body: JSON.stringify({ avatar }),
        });

        if (!response.ok) {
            throw new Error('Не удалось сменить аватар');
        }

        const user = await response.json();

        // Обновить аватар на странице
        document.getElementById('profileAvatar').src = `/static/avatars/${user.avatar}.png`;

        // Обновить кэш
        setStoredUser(user);

        // Обновить шапку
        await updateHeader();

        closeAvatarModal();
    } catch (err) {
        alert('Ошибка: ' + err.message);
    }
}


// ============================================
// ЛОГАУТ
// ============================================

function logout() {
    if (!confirm('Точно выйти?')) return;

    removeToken();
    window.location.href = '/';
}


// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    loadProfile();

    // Кнопка смены аватара
    document.getElementById('changeAvatarBtn').addEventListener('click', openAvatarModal);
    document.getElementById('closeAvatarModal').addEventListener('click', closeAvatarModal);

    // Клик по фону модалки — закрыть
    document.getElementById('avatarModal').addEventListener('click', (e) => {
        if (e.target.id === 'avatarModal') closeAvatarModal();
    });

    // Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAvatarModal();
    });

    // Кнопка "Выйти"
    document.getElementById('logoutBtn').addEventListener('click', logout);
});