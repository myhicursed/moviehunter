// ============================================
// КОНФИГ
// ============================================

const profileConfig = document.getElementById('profileConfig');
const targetUserId = profileConfig?.dataset.userId ? Number(profileConfig.dataset.userId) : null;

const AVAILABLE_AVATARS = ['default', 'avatar_1', 'avatar_2', 'avatar_3'];

// ============================================
// СОСТОЯНИЕ
// ============================================

let profileUser = null;
let isOwnProfile = false;
let libraryMovies = [];

// ============================================
// ЭКРАНЫ
// ============================================

function showProfileScreen(id) {
    ['profileLoading', 'profileError', 'profileContent'].forEach(screenId => {
        const el = document.getElementById(screenId);
        if (el) el.classList.add('hidden');
    });

    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden');
}

function detectOwnProfile(loadedUser) {
    if (targetUserId === null) return true;
    if (!isAuthenticated()) return false;
    const currentUser = getStoredUser();
    if (currentUser && Number(currentUser.id) === Number(loadedUser.id)) return true;
    return false;
}

// ============================================
// ЗАГРУЗКА ПРОФИЛЯ
// ============================================

async function loadProfile() {
    showProfileScreen('profileLoading');

    if (targetUserId === null && !isAuthenticated()) {
        window.location.href = '/';
        return;
    }

    const url = targetUserId === null ? '/api/profile/me' : `/api/profile/${targetUserId}`;

    try {
        const response = targetUserId === null ? await apiRequest(url) : await fetch(url);

        if (!response.ok) {
            if (response.status === 404) throw new Error('Пользователь не найден');
            throw new Error('Не удалось загрузить профиль');
        }

        profileUser = await response.json();
        isOwnProfile = detectOwnProfile(profileUser);

        if (targetUserId !== null && isAuthenticated() && !isOwnProfile) {
            try {
                const meResponse = await apiRequest('/api/profile/me');
                if (meResponse.ok) {
                    const me = await meResponse.json();
                    setStoredUser(me);
                    if (Number(me.id) === Number(profileUser.id)) isOwnProfile = true;
                }
            } catch (e) { }
        }

        renderProfile(profileUser);
        showProfileScreen('profileContent');

        await loadLibrary();

    } catch (err) {
        const msg = document.getElementById('profileErrorMsg');
        if (msg) msg.textContent = err.message;
        showProfileScreen('profileError');
    }
}

// ============================================
// ОТРИСОВКА ПРОФИЛЯ
// ============================================

function renderProfile(user) {
    const avatar = document.getElementById('profileAvatar');
    if (avatar) {
        avatar.src = `/static/avatars/${user.avatar}.png`;
        avatar.onerror = () => { avatar.src = '/static/avatars/default.png'; };
    }

    const username = document.getElementById('profileUsername');
    if (username) username.textContent = user.username;

    // Стрик
    const streak = document.getElementById('profileStreak');
    if (streak) streak.textContent = user.current_streak || 0;

    const dateStr = new Date(user.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    const createdAt = document.getElementById('profileCreatedAt');
    if (createdAt) createdAt.textContent = dateStr;

    // Статистика
    const stats = user.stats;
    document.getElementById('statPoints').textContent = stats.total_points;
    document.getElementById('statCorrect').textContent = stats.correct_answers;
    document.getElementById('statWrong').textContent = stats.wrong_answers;
    document.getElementById('statAccuracy').textContent = `${stats.accuracy}%`;

    if (stats.favorite_genre) {
        const genreNames = {
            action: '💥 Боевик', comedy: '😂 Комедия', drama: '🎭 Драма',
            horror: '👻 Ужасы', scifi: '🚀 Фантастика', thriller: '🔪 Триллер',
            romance: '💕 Мелодрама', sport: '⚽ Спорт', war: '💂 Военные', adventures: '🧭 Приключения'
        };
        document.getElementById('favoriteGenre').textContent = genreNames[stats.favorite_genre] || stats.favorite_genre;
        document.getElementById('favoriteGenreBlock').classList.remove('hidden');
        document.getElementById('favoriteGenreBlock').classList.add('flex');
    }

    if (stats.total_answers === 0) {
        document.getElementById('noStatsBlock').classList.remove('hidden');
    }

    // Приватные данные и табы
    if (isOwnProfile) {
        document.getElementById('changeAvatarBtn')?.classList.remove('hidden');
        document.getElementById('changeAvatarBtn')?.classList.add('flex');
        document.getElementById('logoutBtn')?.classList.remove('hidden');

        // Показываем табы
        document.getElementById('profileTabs')?.classList.remove('hidden');
        document.getElementById('settingsTabBtn')?.classList.remove('hidden');
        document.getElementById('settingsTabBtn')?.classList.add('block');

        // Настройки Email
        if (user.email) {
            document.getElementById('settingsEmail').value = user.email;
            document.getElementById('emailWarningBadge').classList.add('hidden');
        } else {
            document.getElementById('emailWarningBadge').classList.remove('hidden');
            document.getElementById('emailWarningBadge').classList.add('flex');
        }
    }

    const subtitle = document.getElementById('librarySubtitle');
    if (subtitle) subtitle.textContent = isOwnProfile ? 'Фильмы, которые ты хочешь посмотреть' : `Фильмы, которые хочет посмотреть ${user.username}`;
}

// ============================================
// ВКЛАДКИ (ТАБЫ)
// ============================================

function switchProfileTab(tabId) {
    // Меняем активную кнопку
    document.querySelectorAll('.profile-tab').forEach(btn => {
        if (btn.dataset.tab === tabId) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    // Меняем контент
    document.querySelectorAll('.tab-content').forEach(content => {
        if (content.id === `tab-${tabId}`) {
            content.classList.remove('hidden');
            content.classList.add('block');
        } else {
            content.classList.remove('block');
            content.classList.add('hidden');
        }
    });
}

// ============================================
// НАСТРОЙКИ (EMAIL И ПАРОЛЬ)
// ============================================

async function handleEmailUpdate(e) {
    e.preventDefault();
    const btn = document.getElementById('settingsEmailBtn');
    const msg = document.getElementById('settingsEmailMsg');
    const email = document.getElementById('settingsEmail').value.trim().toLowerCase(); // <--- .toLowerCase()

    btn.disabled = true;
    msg.className = "hidden mt-2 text-xs text-center font-bold px-3 py-2 rounded-lg";

    try {
        const response = await apiRequest('/api/profile/me/email', {
            method: 'PATCH',
            body: JSON.stringify({ email })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Ошибка сохранения");
        }

        // Успех
        msg.textContent = "Email успешно сохранён!";
        msg.classList.add('bg-green-500/20', 'text-green-400');
        msg.classList.remove('hidden');
        document.getElementById('emailWarningBadge').classList.add('hidden');

        setTimeout(() => msg.classList.add('hidden'), 3000);
    } catch (error) {
        msg.textContent = error.message;
        msg.classList.add('bg-red-500/20', 'text-red-400');
        msg.classList.remove('hidden');
    } finally {
        btn.disabled = false;
    }
}

async function handlePasswordUpdate(e) {
    e.preventDefault();
    const btn = document.getElementById('settingsPasswordBtn');
    const msg = document.getElementById('settingsPasswordMsg');
    const old_password = document.getElementById('settingsOldPassword').value;
    const new_password = document.getElementById('settingsNewPassword').value;

    btn.disabled = true;
    msg.className = "hidden mt-2 text-xs text-center font-bold px-3 py-2 rounded-lg";

    try {
        const response = await apiRequest('/api/profile/me/password', {
            method: 'PATCH',
            body: JSON.stringify({ old_password, new_password })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Ошибка обновления");
        }

        // Успех
        msg.textContent = "Пароль успешно изменён!";
        msg.classList.add('bg-green-500/20', 'text-green-400');
        msg.classList.remove('hidden');
        document.getElementById('settingsPasswordForm').reset();

        setTimeout(() => msg.classList.add('hidden'), 3000);
    } catch (error) {
        msg.textContent = error.message;
        msg.classList.add('bg-red-500/20', 'text-red-400');
        msg.classList.remove('hidden');
    } finally {
        btn.disabled = false;
    }
}


// --- ВСЯ СТАРАЯ ЛОГИКА ФИЛЬМОТЕКИ И АВАТАРОВ ЗДЕСЬ (Без изменений) ---
// (Оставляю её как есть, чтобы ответ влез)
// ============================================
// БИБЛИОТЕКА
// ============================================

async function loadLibrary() {
    const loading = document.getElementById('libraryLoading');
    if (loading) loading.classList.remove('hidden');

    const url = isOwnProfile ? '/api/library/me' : `/api/library/user/${profileUser.id}`;

    try {
        const response = isOwnProfile ? await apiRequest(url) : await fetch(url);
        if (!response.ok) throw new Error('Не удалось загрузить фильмотеку');
        libraryMovies = await response.json();
        renderLibraryPreview();
    } catch (err) {
        if (loading) {
            loading.innerHTML = `
                <i class="fa-solid fa-triangle-exclamation text-red-400 text-2xl mb-2"></i>
                <div class="text-gray-400">Не удалось загрузить фильмотеку</div>
            `;
        }
    }
}

function getPreviewLimit() { return window.matchMedia('(min-width: 768px)').matches ? 4 : 2; }

function renderLibraryPreview() {
    const loading = document.getElementById('libraryLoading');
    const empty = document.getElementById('libraryEmpty');
    const grid = document.getElementById('libraryPreviewGrid');
    const count = document.getElementById('libraryCount');
    const showAllContainer = document.getElementById('libraryShowAllContainer');
    const showAllText = document.getElementById('libraryShowAllText');

    loading?.classList.add('hidden');
    if (count) count.textContent = libraryMovies.length;

    if (libraryMovies.length === 0) {
        grid?.classList.add('hidden');
        showAllContainer?.classList.add('hidden');
        empty?.classList.remove('hidden');
        const emptyText = document.getElementById('libraryEmptyText');
        if (emptyText) emptyText.textContent = isOwnProfile ? 'Во время игры нажимай «Хочу посмотреть», и фильмы появятся здесь.' : 'Пользователь пока ничего не добавил.';
        return;
    }

    empty?.classList.add('hidden');
    grid?.classList.remove('hidden');

    const limit = getPreviewLimit();
    const preview = libraryMovies.slice(0, limit);
    grid.innerHTML = preview.map(movie => createMovieCard(movie, false)).join('');
    bindRemoveButtons(grid);

    if (libraryMovies.length > limit) {
        showAllContainer?.classList.remove('hidden');
        if (showAllText) showAllText.textContent = `Показать все (${libraryMovies.length})`;
    } else {
        showAllContainer?.classList.add('hidden');
    }
}

function createMovieCard(movie, modal = false) {
    const title = escapeProfileHtml(movie.title);
    const poster = movie.poster_url ? `<img src="${escapeProfileHtml(movie.poster_url)}" alt="${title}" loading="lazy" class="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500">` : `<div class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-dark-700 to-dark-800 text-gray-500"><i class="fa-solid fa-film text-3xl sm:text-4xl mb-2"></i><span class="text-[10px]">Постера пока нет</span></div>`;
    const removeButton = isOwnProfile ? `<button type="button" class="library-remove absolute top-2 right-2 z-10 w-8 h-8 rounded-lg bg-black/75 hover:bg-red-600 border border-white/10 flex items-center justify-center text-white transition backdrop-blur-md" data-movie-id="${movie.movie_id}" title="Удалить"><i class="fa-solid fa-xmark"></i></button>` : '';

    return `
        <article class="library-movie group relative glass-card rounded-xl overflow-hidden" data-movie-id="${movie.movie_id}" data-modal="${modal ? 'true' : 'false'}">
            <a href="/film/${movie.movie_id}" class="block">
                <div class="relative aspect-[2/3] bg-dark-800 overflow-hidden">
                    ${poster}
                    <div class="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none"></div>
                </div>
                <div class="p-2.5 sm:p-3">
                    <h3 class="font-bold text-xs sm:text-sm text-white leading-tight line-clamp-2 min-h-[2rem] sm:min-h-[2.5rem] group-hover:text-brand transition">${title}</h3>
                    <p class="text-[11px] sm:text-xs text-gray-500 mt-1">${movie.year}</p>
                </div>
            </a>
            ${removeButton}
        </article>
    `;
}

function bindRemoveButtons(root) {
    if (!isOwnProfile || !root) return;
    root.querySelectorAll('.library-remove').forEach(button => {
        button.addEventListener('click', () => removeLibraryMovie(Number(button.dataset.movieId)));
    });
}

async function removeLibraryMovie(movieId) {
    if (!isOwnProfile) return;
    const buttons = document.querySelectorAll(`.library-remove[data-movie-id="${movieId}"]`);
    buttons.forEach(button => { button.disabled = true; button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`; });

    try {
        const response = await apiRequest(`/api/library/${movieId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Не удалось удалить фильм');

        libraryMovies = libraryMovies.filter(movie => Number(movie.movie_id) !== Number(movieId));
        renderLibraryPreview();

        const modal = document.getElementById('libraryModal');
        if (modal && !modal.classList.contains('hidden')) renderLibraryModal();
    } catch (err) {
        buttons.forEach(button => { button.disabled = false; button.innerHTML = `<i class="fa-solid fa-xmark"></i>`; });
    }
}

function openLibraryModal() {
    if (libraryMovies.length === 0) return;
    const modal = document.getElementById('libraryModal');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    renderLibraryModal();
}

function closeLibraryModal() {
    document.getElementById('libraryModal')?.classList.add('hidden');
    document.body.style.overflow = '';
}

function renderLibraryModal() {
    const grid = document.getElementById('libraryModalGrid');
    const count = document.getElementById('libraryModalCount');
    if (!grid) return;
    if (count) count.textContent = libraryMovies.length;
    grid.innerHTML = libraryMovies.map(movie => createMovieCard(movie, true)).join('');
    bindRemoveButtons(grid);
}

// ============================================
// АВАТАР
// ============================================

function openAvatarModal() {
    if (!isOwnProfile) return;
    const grid = document.getElementById('avatarsGrid');
    grid.innerHTML = AVAILABLE_AVATARS.map(avatar => `
        <button type="button" class="avatar-choice group relative aspect-square rounded-full overflow-hidden border-4 border-dark-600 hover:border-brand transition" data-avatar="${avatar}">
            <img src="/static/avatars/${avatar}.png" alt="${avatar}" class="w-full h-full object-cover group-hover:scale-110 transition" onerror="this.src='/static/avatars/default.png'">
        </button>
    `).join('');

    grid.querySelectorAll('.avatar-choice').forEach(button => {
        button.addEventListener('click', () => changeAvatar(button.dataset.avatar));
    });
    document.getElementById('avatarModal').classList.remove('hidden');
}

function closeAvatarModal() {
    document.getElementById('avatarModal')?.classList.add('hidden');
}

async function changeAvatar(avatar) {
    if (!isOwnProfile) return;
    try {
        const response = await apiRequest('/api/profile/me/avatar', { method: 'PATCH', body: JSON.stringify({ avatar }) });
        if (!response.ok) throw new Error('Не удалось сменить аватар');
        const user = await response.json();

        document.getElementById('profileAvatar').src = `/static/avatars/${user.avatar}.png`;
        const cached = getStoredUser();
        if (cached) { cached.avatar = user.avatar; setStoredUser(cached); }
        else { setStoredUser(user); }

        await updateHeader();
        closeAvatarModal();
    } catch (err) { alert('Ошибка: ' + err.message); }
}

function logout() {
    if (!confirm('Точно выйти?')) return;
    removeToken();
    window.location.href = '/';
}

function handleEscape(event) {
    if (event.key !== 'Escape') return;
    const libraryModal = document.getElementById('libraryModal');
    if (libraryModal && !libraryModal.classList.contains('hidden')) { closeLibraryModal(); return; }
    const avatarModal = document.getElementById('avatarModal');
    if (avatarModal && !avatarModal.classList.contains('hidden')) closeAvatarModal();
}

function escapeProfileHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    loadProfile();

    document.getElementById('changeAvatarBtn')?.addEventListener('click', openAvatarModal);
    document.getElementById('closeAvatarModal')?.addEventListener('click', closeAvatarModal);
    document.getElementById('libraryShowAllBtn')?.addEventListener('click', openLibraryModal);
    document.getElementById('closeLibraryModal')?.addEventListener('click', closeLibraryModal);
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    document.addEventListener('keydown', handleEscape);

    // ТАБЫ
    document.querySelectorAll('.profile-tab').forEach(btn => {
        btn.addEventListener('click', () => switchProfileTab(btn.dataset.tab));
    });

    // ФОРМЫ НАСТРОЕК
    document.getElementById('settingsEmailForm')?.addEventListener('submit', handleEmailUpdate);
    document.getElementById('settingsPasswordForm')?.addEventListener('submit', handlePasswordUpdate);

    // ГЛАЗИКИ ПАРОЛЕЙ В НАСТРОЙКАХ
    document.querySelectorAll('.toggle-pwd-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const targetId = this.getAttribute('data-target');
            const input = document.getElementById(targetId);
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

    let wasDesktop = window.matchMedia('(min-width: 768px)').matches;
    window.addEventListener('resize', () => {
        const isDesktopNow = window.matchMedia('(min-width: 768px)').matches;
        if (isDesktopNow !== wasDesktop) {
            wasDesktop = isDesktopNow;
            renderLibraryPreview();
        }
    });
});