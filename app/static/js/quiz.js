// ============================================
// СОСТОЯНИЕ
// ============================================

const ANSWER_TIME_LIMIT = 10; // секунд на ответ

const state = {
    questions: [],
    currentIndex: 0,
    correctCount: 0,
    totalPoints: 0,
    answered: false,
    isDaily: false,
    videoWatched: false,     // видео полностью просмотрено
    timerInterval: null,     // ID интервала таймера
    timerRemaining: 0,       // сколько секунд осталось
};


// ============================================
// ЭКРАНЫ
// ============================================

function showScreen(id) {
    if (id !== 'gameScreen') {
        stopVideo();
    }

    ['loadingScreen', 'errorScreen', 'gameScreen', 'resultScreen'].forEach(s => {
        document.getElementById(s).classList.add('hidden');
    });
    document.getElementById(id).classList.remove('hidden');
}

function showError(message) {
    document.getElementById('errorMessage').textContent = message;
    showScreen('errorScreen');
}


// ============================================
// ЗАГРУЗКА КВИЗА
// ============================================

async function loadQuiz() {
    stopVideo();
    showScreen('loadingScreen');

    const params = new URLSearchParams(window.location.search);
    const genre = params.get('genre');
    const mode = params.get('mode');

    state.isDaily = (mode === 'daily');

    // Определяем URL
    let url;
    if (state.isDaily) {
        url = '/api/quiz/daily';
    } else {
        url = '/api/quiz/start';
        if (genre) url += `?genre=${genre}`;
    }

    try {
        // Для daily — нужен токен
        const response = state.isDaily
            ? await apiRequest(url)
            : await fetch(url);

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Не удалось загрузить квиз');
        }

        const data = await response.json();

        // Daily возвращает обёртку {status, questions, ...}
        if (state.isDaily) {
            if (data.status === 'no_quiz') {
                throw new Error(data.message || 'На сегодня квиза нет');
            }
            if (data.status === 'completed') {
                // Уже прошёл — показываем результат
                showDailyAlreadyCompleted(data);
                return;
            }
            // status === 'playing'
            state.questions = data.questions;
            state.currentIndex = data.current_question || 0;
        } else {
            state.questions = data;
            state.currentIndex = 0;
        }

        state.correctCount = 0;
        state.totalPoints = 0;

        document.getElementById('totalQuestions').textContent = state.questions.length;

        showQuestion();
        showScreen('gameScreen');
    } catch (err) {
        showError(err.message);
    }
}


// ============================================
// ПОКАЗАТЬ ВОПРОС
// ============================================

function showQuestion() {
    const q = state.questions[state.currentIndex];
    state.answered = false;
    state.videoWatched = false;

    // Останавливаем предыдущий таймер если был
    clearTimer();

    // Прогресс
    document.getElementById('currentQuestion').textContent = state.currentIndex + 1;
    document.getElementById('currentScore').textContent = state.totalPoints;

    const progress = ((state.currentIndex) / state.questions.length) * 100;
    document.getElementById('progressBar').style.width = `${progress}%`;

    // Сложность
    const badge = document.getElementById('difficultyBadge');
    const difficultyMap = {
        easy: { text: 'Легко', class: 'bg-green-500/20 text-green-400 border border-green-500' },
        medium: { text: 'Средне', class: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500' },
        hard: { text: 'Сложно', class: 'bg-red-500/20 text-red-400 border border-red-500' },
    };
    const diff = difficultyMap[q.difficulty] || difficultyMap.medium;
    badge.textContent = diff.text;
    badge.className = `inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${diff.class}`;

    // Статус: показать "смотри", скрыть таймер
    document.getElementById('watchingStatus').classList.remove('hidden');
    document.getElementById('timerStatus').classList.add('hidden');

    // Видео
    const video = document.getElementById('videoPlayer');
    video.src = `/media/movies/${q.filename}`;
    video.load();

    video.onpause = () => {
        if (!video.ended && !state.answered) {
            video.play().catch(() => { });
        }
    };

    video.onended = () => {
        state.videoWatched = true;
        unlockOptions();
        startTimer();
    };

    const container = document.getElementById('optionsContainer');
    container.innerHTML = q.options.map(option => `
        <button 
            class="option-btn locked group text-left px-6 py-4 bg-dark-800 border border-dark-600 rounded-xl font-semibold opacity-50 cursor-not-allowed"
            data-answer="${escapeHtml(option)}"
            disabled
        >
            <span class="text-brand mr-2 opacity-0">▶</span>
            ${escapeHtml(option)}
        </button>
    `).join('');

    document.getElementById('nextButtonContainer').classList.add('hidden');
}


// ============================================
// РАЗБЛОКИРОВАТЬ ВАРИАНТЫ
// ============================================

function unlockOptions() {
    const container = document.getElementById('optionsContainer');
    container.querySelectorAll('.option-btn').forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('locked', 'opacity-50', 'cursor-not-allowed');
        btn.classList.add('hover:bg-dark-700', 'hover:border-brand', 'transition', 'cursor-pointer');

        const q = state.questions[state.currentIndex];
        btn.addEventListener('click', () => handleAnswer(btn, q));
    });

    document.getElementById('watchingStatus').classList.add('hidden');
    document.getElementById('timerStatus').classList.remove('hidden');
}


// ============================================
// ТАЙМЕР
// ============================================

function startTimer() {
    state.timerRemaining = ANSWER_TIME_LIMIT;
    updateTimerDisplay();

    state.timerInterval = setInterval(() => {
        state.timerRemaining--;
        updateTimerDisplay();

        if (state.timerRemaining <= 0) {
            timeExpired();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const el = document.getElementById('timerSeconds');
    if (el) el.textContent = state.timerRemaining;

    // Красный цвет когда осталось мало
    const timerBlock = document.getElementById('timerStatus');
    if (state.timerRemaining <= 3) {
        timerBlock.classList.add('animate-pulse');
    }
}

function clearTimer() {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
    const timerBlock = document.getElementById('timerStatus');
    if (timerBlock) timerBlock.classList.remove('animate-pulse');
}


// ============================================
// ВРЕМЯ ИСТЕКЛО
// ============================================

async function timeExpired() {
    if (state.answered) return;
    state.answered = true;
    clearTimer();

    const q = state.questions[state.currentIndex];

    // Заблокировать все кнопки
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.disabled = true;
        btn.classList.add('cursor-not-allowed');
    });

    // Спросим у бекенда правильный ответ (отправим специальный маркер)
    try {
        const response = await apiRequest('/api/quiz/answer', {
            method: 'POST',
            body: JSON.stringify({
                movie_id: q.movie_id,
                user_answer: '__timeout__',
            }),
        });

        if (response.ok) {
            const result = await response.json();

            // Подсветить правильный
            document.querySelectorAll('.option-btn').forEach(btn => {
                if (btn.dataset.answer === result.correct_answer) {
                    btn.classList.remove('bg-dark-800', 'border-dark-600');
                    btn.classList.add('bg-green-500/20', 'border-green-500', 'text-green-300');
                }
            });
        }
    } catch (err) {
        console.error('Ошибка запроса правильного ответа:', err);
    }

    // Обновить статус
    const timerStatus = document.getElementById('timerStatus');
    timerStatus.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation text-red-400"></i>
        <span class="text-red-400 font-bold">Время вышло!</span>
    `;
    timerStatus.classList.remove('animate-pulse', 'border-brand', 'bg-brand/20');
    timerStatus.classList.add('border-red-500', 'bg-red-500/20');

    // Показать кнопку "Далее"
    const nextBtn = document.getElementById('nextButton');
    nextBtn.innerHTML = state.currentIndex < state.questions.length - 1
        ? 'Дальше <i class="fa-solid fa-arrow-right"></i>'
        : 'Показать результат <i class="fa-solid fa-trophy"></i>';
    document.getElementById('nextButtonContainer').classList.remove('hidden');
}


// ============================================
// ОБРАБОТКА ОТВЕТА
// ============================================

async function handleAnswer(button, question) {
    if (state.answered) return;
    state.answered = true;
    clearTimer();

    const userAnswer = button.dataset.answer;

    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.disabled = true;
        btn.classList.add('cursor-not-allowed');
    });

    try {
        const response = await apiRequest('/api/quiz/answer', {
            method: 'POST',
            body: JSON.stringify({
                movie_id: question.movie_id,
                user_answer: userAnswer,
            }),
        });

        if (!response.ok) {
            throw new Error('Ошибка проверки ответа');
        }

        const result = await response.json();

        document.querySelectorAll('.option-btn').forEach(btn => {
            const answer = btn.dataset.answer;
            if (answer === result.correct_answer) {
                btn.classList.remove('bg-dark-800', 'hover:bg-dark-700', 'border-dark-600');
                btn.classList.add('bg-green-500/20', 'border-green-500', 'text-green-300');
            } else if (answer === userAnswer && !result.correct) {
                btn.classList.remove('bg-dark-800', 'hover:bg-dark-700', 'border-dark-600');
                btn.classList.add('bg-red-500/20', 'border-red-500', 'text-red-300');
            }
        });

        if (result.correct) {
            state.correctCount++;
            state.totalPoints += result.points;
            document.getElementById('currentScore').textContent = state.totalPoints;
        }

        const nextBtn = document.getElementById('nextButton');
        nextBtn.innerHTML = state.currentIndex < state.questions.length - 1
            ? 'Дальше <i class="fa-solid fa-arrow-right"></i>'
            : 'Показать результат <i class="fa-solid fa-trophy"></i>';
        document.getElementById('nextButtonContainer').classList.remove('hidden');

    } catch (err) {
        alert('Ошибка: ' + err.message);
    }
}


// ============================================
// СЛЕДУЮЩИЙ ВОПРОС
// ============================================

function nextQuestion() {
    clearTimer();
    state.currentIndex++;
    if (state.currentIndex >= state.questions.length) {
        showResult();
    } else {
        showQuestion();
    }
}


// ============================================
// ЭКРАН РЕЗУЛЬТАТОВ
// ============================================

async function showResult() {
    stopVideo();
    clearTimer();
    const total = state.questions.length;
    const percent = Math.round((state.correctCount / total) * 100);

    document.getElementById('resultCorrect').textContent = state.correctCount;
    document.getElementById('resultTotal').textContent = total;
    document.getElementById('resultPoints').textContent = state.totalPoints;

    let emoji, title, subtitle;
    if (percent === 100) {
        emoji = '🏆'; title = 'Идеально!'; subtitle = 'Ты настоящий киноман!';
    } else if (percent >= 80) {
        emoji = '🎬'; title = 'Отлично!'; subtitle = 'Ты хорошо знаешь кино';
    } else if (percent >= 50) {
        emoji = '👍'; title = 'Неплохо!'; subtitle = 'Есть куда расти';
    } else if (percent >= 20) {
        emoji = '🤔'; title = 'Так себе...'; subtitle = 'Пересмотри пару классных фильмов';
    } else {
        emoji = '😅'; title = 'Ой...'; subtitle = 'Может, стоит начать с классики?';
    }

    document.getElementById('resultEmoji').textContent = emoji;
    document.getElementById('resultTitle').textContent = title;
    document.getElementById('resultSubtitle').textContent = subtitle;

    if (!isAuthenticated()) {
        document.getElementById('guestMessage').classList.remove('hidden');
    }

    showScreen('resultScreen');

    // Если это daily — завершаем на бекенде и обновляем результат
    if (state.isDaily && isAuthenticated()) {
        await finishDailyQuiz();
    }
}


async function finishDailyQuiz() {
    try {
        const response = await apiRequest('/api/quiz/daily/finish', {
            method: 'POST',
            body: JSON.stringify({
                correct_count: state.correctCount,
            }),
        });

        if (response.ok) {
            const data = await response.json();

            // Обновить очки с учётом бонуса
            const totalWithBonus = state.totalPoints + data.bonus_earned;
            document.getElementById('resultPoints').textContent = totalWithBonus;

            // Обновить подпись
            const subtitle = document.getElementById('resultSubtitle');
            subtitle.innerHTML += `<br><span class="text-yellow-400 font-bold">+${data.bonus_earned} бонус</span> · 🔥 Стрик: ${data.current_streak} дн.`;

            // 🆕 Обновить юзера в localStorage
            const cachedUser = getStoredUser();
            if (cachedUser) {
                cachedUser.current_streak = data.current_streak;
                setStoredUser(cachedUser);
            }
        }
    } catch (err) {
        console.error('Ошибка завершения daily:', err);
    }
}


function showDailyAlreadyCompleted(data) {
    stopVideo();

    document.getElementById('resultEmoji').textContent = '✅';
    document.getElementById('resultTitle').textContent = 'Уже пройдено!';
    document.getElementById('resultSubtitle').innerHTML =
        `Ты уже прошёл ежедневный квиз сегодня.<br>🔥 Стрик: ${data.current_streak} дн.`;

    document.getElementById('resultCorrect').textContent = data.correct_count;
    document.getElementById('resultTotal').textContent = data.total_questions;
    document.getElementById('resultPoints').textContent = data.bonus_earned;

    showScreen('resultScreen');
}


// ============================================
// УТИЛИТЫ
// ============================================

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function stopVideo() {
    const video = document.getElementById('videoPlayer');
    video.pause();
    video.src = '';
}


// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    loadQuiz();

    const video = document.getElementById('videoPlayer');
    if (video) {
        video.addEventListener('contextmenu', e => e.preventDefault());
    }
    document.getElementById('nextButton').addEventListener('click', nextQuestion);
    document.getElementById('playAgainBtn').addEventListener('click', loadQuiz);
    document.getElementById('guestLoginBtn').addEventListener('click', () => {
        openAuthModal('register');
    });
});