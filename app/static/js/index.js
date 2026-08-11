// ============================================
// ИКОНКИ ЖАНРОВ (общие)
// ============================================

const GENRE_ICONS = {
    action: '💥',
    comedy: '😂',
    drama: '🎭',
    horror: '👻',
    scifi: '🚀',
    thriller: '🔪',
    romance: '💕',
    sport: '⚽',
    war: '💂',
    adventures: '🧭'
};


// ============================================
// ЗАГРУЗКА ЖАНРОВ (общая функция)
// ============================================

async function loadGenresInto(gridId, itemClass) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    try {
        const response = await fetch('/api/quiz/genres');
        if (!response.ok) throw new Error('Не удалось загрузить жанры');

        const genres = await response.json();

        grid.innerHTML = genres.map(genre => `
            <a 
                href="/quiz?genre=${genre.code}" 
                class="${itemClass}"
            >
                <div class="text-3xl mb-1">${GENRE_ICONS[genre.code] || '🎬'}</div>
                <div class="font-semibold text-sm">${genre.name}</div>
            </a>
        `).join('');
    } catch (err) {
        grid.innerHTML = `<div class="text-center text-gray-500 col-span-full py-6">❌ ${err.message}</div>`;
    }
}


// ============================================
// ЗАГРУЗКА ТОПА (общая функция)
// ============================================

async function loadLeaderboardInto(containerId, compact = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const response = await fetch('/api/leaderboard/');
        if (!response.ok) throw new Error('Не удалось загрузить топ');

        const players = await response.json();

        if (players.length === 0) {
            container.innerHTML = `<div class="text-center text-gray-500 py-6">Пока никого 🎯</div>`;
            return;
        }

        const medals = ['🥇', '🥈', '🥉'];

        if (compact) {
            // Компактный вид для авторизованных
            container.innerHTML = players.slice(0, 5).map((p, i) => {
                const medal = medals[i] || `<span class="text-gray-500 text-sm">#${p.position}</span>`;
                return `
                    <a href="/profile/${p.user_id}" class="flex items-center gap-3 p-3 bg-dark-800 hover:bg-dark-700 transition rounded-lg border border-dark-600">
                        <div class="text-xl w-8 text-center">${medal}</div>
                        <img src="/static/avatars/${p.avatar}.png" alt="${p.username}" class="w-8 h-8 rounded-full border-2 border-brand object-cover" onerror="this.src='/static/avatars/default.png'">
                        <div class="flex-1 font-semibold text-sm truncate">${p.username}</div>
                        <div class="text-brand font-black">${p.total_points}</div>
                    </a>
                `;
            }).join('');
        } else {
            // Полный вид для гостей
            container.innerHTML = players.map((p, i) => {
                const medal = medals[i] || `<span class="text-gray-500">#${p.position}</span>`;
                return `
                    <a href="/profile/${p.user_id}" class="flex items-center gap-4 p-4 bg-dark-700 hover:bg-dark-600 transition rounded-xl border border-dark-600">
                        <div class="text-2xl w-12 text-center">${medal}</div>
                        <img src="/static/avatars/${p.avatar}.png" alt="${p.username}" class="w-12 h-12 rounded-full border-2 border-brand object-cover" onerror="this.src='/static/avatars/default.png'">
                        <div class="flex-1">
                            <div class="font-bold text-lg">${p.username}</div>
                        </div>
                        <div class="text-right">
                            <div class="text-2xl font-black text-brand">${p.total_points}</div>
                            <div class="text-xs text-gray-400">очков</div>
                        </div>
                    </a>
                `;
            }).join('');
        }
    } catch (err) {
        container.innerHTML = `<div class="text-center text-gray-500 py-6">❌ ${err.message}</div>`;
    }
}


// ============================================
// ПРИВЕТСТВИЕ ДЛЯ АВТОРИЗОВАННЫХ
// ============================================


// ============================================
// ПОКАЗ БЛОКА ЖАНРОВ (для авторизованных)
// ============================================

function initGenresToggle() {
    const btn = document.getElementById('showGenresBtn');
    const block = document.getElementById('genresBlock');

    if (!btn || !block) return;

    let loaded = false;

    btn.addEventListener('click', async () => {
        block.classList.toggle('hidden');

        // Прокрутка к блоку
        if (!block.classList.contains('hidden')) {
            // Загружаем жанры только один раз
            if (!loaded) {
                await loadGenresInto(
                    'genresGridUser',
                    'group flex flex-col items-center justify-center p-4 bg-dark-700 hover:bg-brand transition rounded-lg border border-dark-600 hover:border-brand text-center'
                );
                loaded = true;
            }
            setTimeout(() => {
                block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        }
    });
}

// ============================================
// ЗАГРУЗКА СТАТУСА ЕЖЕДНЕВНОГО КВИЗА
// ============================================

async function loadDailyStatus() {
    // Только для авторизованных
    if (!isAuthenticated()) return;

    const loading = document.getElementById('dailyLoading');
    const playBlock = document.getElementById('dailyPlay');
    const completedBlock = document.getElementById('dailyCompleted');
    const noQuizBlock = document.getElementById('dailyNoQuiz');
    const streakBlock = document.getElementById('dailyStreak');

    try {
        const response = await apiRequest('/api/quiz/daily');
        const data = await response.json();

        // Скрываем загрузку
        if (loading) loading.classList.add('hidden');

        if (data.status === 'no_quiz') {
            noQuizBlock.classList.remove('hidden');

        } else if (data.status === 'completed') {
            completedBlock.classList.remove('hidden');
            document.getElementById('dailyEarned').textContent = data.bonus_earned;


        } else if (data.status === 'playing') {
            playBlock.classList.remove('hidden');

        }
    } catch (err) {
        console.error('Ошибка загрузки ежедневного:', err);
        if (loading) loading.classList.add('hidden');
        if (noQuizBlock) noQuizBlock.classList.remove('hidden');
    }
}

// ============================================
// ОТРИСОВКА СТРИКА
// ============================================

function renderStreak() {
    const user = getStoredUser();
    if (!user) return;

    const streak = user.current_streak || 0;
    const grid = document.getElementById('streakDaysGrid');
    const daysEl = document.getElementById('streakDays');
    const hint = document.getElementById('streakHint');

    if (!grid) return;

    // Обновить число
    daysEl.textContent = streak;

    // Рассчитать прогресс внутри недели (1-7)
    const weekProgress = streak === 0
        ? 0
        : (streak % 7 === 0 ? 7 : streak % 7);

    // Подсказка
    if (streak === 0) {
        hint.innerHTML = 'Начни серию сегодня! За 7 дней подряд — <span class="text-yellow-400 font-bold">+50 очков</span>';
    } else if (weekProgress === 7) {
        hint.innerHTML = '🎉 Отличная неделя! Следующий бонус — через 7 дней';
    } else {
        const left = 7 - weekProgress;
        hint.innerHTML = `Осталось <span class="text-yellow-400 font-bold">${left} дн.</span> до бонуса +50 очков`;
    }

    // Отрисовать 7 квадратов
    const squares = [];
    for (let i = 1; i <= 7; i++) {
        const isCompleted = i <= weekProgress;
        const isGift = i === 7;

        let classes = 'aspect-square flex items-center justify-center rounded-lg font-black text-lg border-2 transition ';
        let content = '';

        if (isGift && isCompleted) {
            // Подарок раскрыт
            classes += 'bg-gradient-to-br from-yellow-500 to-yellow-600 border-yellow-400 text-white shadow-lg shadow-yellow-500/50';
            content = '🎁';
        } else if (isGift) {
            // Подарок закрыт
            classes += 'bg-dark-800 border-yellow-500/30 text-yellow-400';
            content = '🎁';
        } else if (isCompleted) {
            // Пройденный день
            classes += 'bg-gradient-to-br from-brand to-brand-dark border-brand text-white shadow-md shadow-brand/30';
            content = '<i class="fa-solid fa-check"></i>';
        } else {
            // Будущий день
            classes += 'bg-dark-800 border-dark-600 text-gray-500';
            content = i;
        }

        squares.push(`<div class="${classes}">${content}</div>`);
    }

    grid.innerHTML = squares.join('');
}

// ============================================
// ЗАПУСК
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Для гостей
    loadGenresInto(
        'genresGrid',
        'group flex flex-col items-center justify-center p-6 bg-dark-700 hover:bg-brand transition rounded-xl border border-dark-600 hover:border-brand'
    );
    loadLeaderboardInto('leaderboard', false);

    // Для авторизованных
    loadLeaderboardInto('leaderboardUser', true);
    initGenresToggle();
    loadDailyStatus();
});