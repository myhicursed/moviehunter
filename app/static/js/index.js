// ============================================
// ИКОНКИ ЖАНРОВ
// ============================================
const GENRE_ICONS = {
    action: '💥', comedy: '😂', drama: '🎭', horror: '👻',
    scifi: '🚀', thriller: '🔪', romance: '💕', sport: '⚽',
    war: '💂', adventures: '🧭'
};

// ============================================
// ЗАГРУЗКА ЖАНРОВ
// ============================================
async function loadGenresInto(gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    try {
        const response = await fetch('/api/quiz/genres');
        if (!response.ok) throw new Error('Не удалось загрузить жанры');

        const genres = await response.json();

        grid.innerHTML = genres.map(genre => `
            <a href="/quiz?genre=${genre.code}" class="glass-card flex flex-col items-center justify-center p-4 rounded-xl hover:-translate-y-1 transition-all duration-300 text-center group">
                <div class="text-3xl mb-2 group-hover:scale-110 transition-transform">
                    ${GENRE_ICONS[genre.code] || '🎬'}
                </div>
                <div class="font-bold text-sm text-gray-300 group-hover:text-white transition-colors">${genre.name}</div>
            </a>
        `).join('');
    } catch (err) {
        grid.innerHTML = `<div class="text-center text-gray-500 col-span-full py-6">❌ ${err.message}</div>`;
    }
}

// ============================================
// ЗАГРУЗКА ТОПА ИГРОКОВ
// ============================================
async function loadLeaderboardInto(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const response = await fetch('/api/leaderboard/?limit=10');
        if (!response.ok) throw new Error('Не удалось загрузить топ');

        const players = await response.json();

        if (players.length === 0) {
            container.innerHTML = `<div class="text-center text-gray-500 py-6">Пока никого 🎯</div>`;
            return;
        }

        const medals = ['🥇', '🥈', '🥉'];

        // Компактный дизайн для боковой панели
        container.innerHTML = players.slice(0, 8).map((p, i) => {
            const medal = medals[i] || `<span class="text-gray-500 text-xs font-bold w-6 text-center">#${p.position}</span>`;
            const highlightClass = i < 3 ? 'bg-white/5' : '';

            return `
                <a href="/profile/${p.user_id}" class="flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 transition ${highlightClass}">
                    <div class="text-lg w-6 text-center flex-shrink-0">${medal}</div>
                    <img src="/static/avatars/${p.avatar}.png" alt="${p.username}" class="w-8 h-8 rounded-full border border-white/10 object-cover" onerror="this.src='/static/avatars/default.png'">
                    <div class="flex-1 min-w-0">
                        <div class="font-semibold text-xs text-white truncate">${p.username}</div>
                    </div>
                    <div class="text-brand font-black text-sm flex-shrink-0">${p.total_points}</div>
                </a>
            `;
        }).join('');

    } catch (err) {
        container.innerHTML = `<div class="text-center text-gray-500 py-6">❌ ${err.message}</div>`;
    }
}

// ============================================
// ПРИВЕТСТВИЕ И СТРИК
// ============================================
function updateDashboardHeader() {
    const user = getStoredUser();
    if (!user) return;

    // Обновляем имя
    const welcomeName = document.getElementById('welcomeName');
    if (welcomeName) welcomeName.textContent = user.username;

    // Обновляем аватар в карточке
    const dashboardAvatar = document.getElementById('dashboardAvatar');
    if (dashboardAvatar) {
        dashboardAvatar.src = `/static/avatars/${user.avatar}.png`;
        dashboardAvatar.onerror = () => { dashboardAvatar.src = '/static/avatars/default.png'; };
    }

    // Обновляем огненный бейдж стрика
    const badge = document.getElementById('streakDaysBadge');
    if (badge) badge.textContent = user.current_streak || 0;
}

// Экспортируем глобально, чтобы auth.js мог её вызвать при загрузке профиля
window.renderStreak = updateDashboardHeader;

// ============================================
// МОДАЛКА ЖАНРОВ
// ============================================
let genresLoaded = false;

async function openGenresModal() {
    const modal = document.getElementById('genresModal');
    if (!modal) return;

    modal.classList.remove('hidden');

    if (!genresLoaded) {
        await loadGenresInto('genresModalGrid');
        genresLoaded = true;
    }
}

function closeGenresModal() {
    const modal = document.getElementById('genresModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Закрытие модалки по клику вне окна и по ESC
document.addEventListener('DOMContentLoaded', () => {
    const genresModal = document.getElementById('genresModal');
    if (genresModal) {
        genresModal.addEventListener('click', (e) => {
            if (e.target === genresModal) closeGenresModal();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && genresModal && !genresModal.classList.contains('hidden')) {
            closeGenresModal();
        }
    });
});

// ============================================
// СТАТУС DAILY
// ============================================
async function loadDailyStatus() {
    const loading = document.getElementById('dailyLoading');
    const playBlock = document.getElementById('dailyPlay');
    const playBtn = document.getElementById('dailyPlayBtn'); // 🆕
    const completedBlock = document.getElementById('dailyCompleted');
    const noQuizBlock = document.getElementById('dailyNoQuiz');

    try {
        const response = await apiRequest('/api/quiz/daily');
        if (!response.ok) throw new Error();
        const data = await response.json();

        if (loading) loading.classList.add('hidden');

        if (data.status === 'no_quiz') {
            if (noQuizBlock) noQuizBlock.classList.remove('hidden');
        } else if (data.status === 'completed') {
            if (completedBlock) completedBlock.classList.remove('hidden');
            const earnedEl = document.getElementById('dailyEarned');
            if (earnedEl) earnedEl.textContent = data.bonus_earned;
        } else if (data.status === 'playing') {
            if (playBlock) playBlock.classList.remove('hidden');
            if (playBtn) playBtn.classList.remove('hidden'); // 🆕 показываем синюю кнопку
            if (playBtn) playBtn.classList.add('inline-flex'); // 🆕
        }
    } catch (err) {
        if (loading) loading.classList.add('hidden');
        if (noQuizBlock) noQuizBlock.classList.remove('hidden');
    }
}

// ============================================
// УПРАВЛЕНИЕ ЭФФЕКТАМИ (АНИМАЦИЯМИ)
// ============================================

// ============================================
// УПРАВЛЕНИЕ ЭФФЕКТАМИ (АНИМАЦИЯМИ)
// ============================================

function initEffectsToggle() {
    const isFxDisabled = localStorage.getItem('moviehunter_disable_fx') === 'true';
    const body = document.body;

    // Применяем сохраненное состояние при загрузке
    if (isFxDisabled) {
        body.classList.add('disable-fx');
        updateFxButtons(false);
    } else {
        updateFxButtons(true);
    }

    // Повесим событие на ВЕСЬ документ (делегирование) — сработает для любой кнопки .toggle-fx-btn!
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.toggle-fx-btn');
        if (!btn) return;

        const currentlyDisabled = body.classList.contains('disable-fx');

        if (currentlyDisabled) {
            // Включаем эффекты
            body.classList.remove('disable-fx');
            localStorage.removeItem('moviehunter_disable_fx');
            updateFxButtons(true);
        } else {
            // Выключаем эффекты
            body.classList.add('disable-fx');
            localStorage.setItem('moviehunter_disable_fx', 'true');
            updateFxButtons(false);
        }
    });

    function updateFxButtons(isFxOn) {
        const fxButtons = document.querySelectorAll('.toggle-fx-btn');
        fxButtons.forEach(btn => {
            const icon = btn.querySelector('i');
            const text = btn.querySelector('.fx-text');

            if (text) text.textContent = isFxOn ? 'Эффекты: ВКЛ' : 'Эффекты: ВЫКЛ';
            if (icon) {
                if (isFxOn) {
                    icon.classList.remove('text-gray-500');
                    icon.classList.add('text-brand');
                } else {
                    icon.classList.remove('text-brand');
                    icon.classList.add('text-gray-500');
                }
            }
        });
    }
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // В зависимости от того, авторизован юзер или нет...
    if (localStorage.getItem('moviehunter_token')) {
        updateDashboardHeader();
        loadLeaderboardInto('leaderboardUser', true); // <-- не забудь передать true
        initGenresToggle();
        loadDailyStatus();
    } else {
        loadLeaderboardInto('leaderboard', false);
    }

    // Включаем логику кнопок эффектов для всех
    initEffectsToggle();
});