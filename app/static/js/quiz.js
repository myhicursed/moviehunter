// ============================================
// СОСТОЯНИЕ
// ============================================

const state = {
    questions: [],
    currentIndex: 0,
    correctCount: 0,
    totalPoints: 0,
    answered: false,
    isDaily: false,
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

    document.getElementById('currentQuestion').textContent = state.currentIndex + 1;
    document.getElementById('currentScore').textContent = state.totalPoints;

    const progress = ((state.currentIndex) / state.questions.length) * 100;
    document.getElementById('progressBar').style.width = `${progress}%`;

    const badge = document.getElementById('difficultyBadge');
    const difficultyMap = {
        easy: { text: 'Легко', class: 'bg-green-500/20 text-green-400 border border-green-500' },
        medium: { text: 'Средне', class: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500' },
        hard: { text: 'Сложно', class: 'bg-red-500/20 text-red-400 border border-red-500' },
    };
    const diff = difficultyMap[q.difficulty] || difficultyMap.medium;
    badge.textContent = diff.text;
    badge.className = `inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${diff.class}`;

    const video = document.getElementById('videoPlayer');
    video.src = `/media/movies/${q.filename}`;
    video.load();

    const container = document.getElementById('optionsContainer');
    container.innerHTML = q.options.map(option => `
        <button 
            class="option-btn group text-left px-6 py-4 bg-dark-800 hover:bg-dark-700 border border-dark-600 hover:border-brand transition rounded-xl font-semibold"
            data-answer="${escapeHtml(option)}"
        >
            <span class="text-brand mr-2 opacity-0 group-hover:opacity-100 transition">▶</span>
            ${escapeHtml(option)}
        </button>
    `).join('');

    container.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => handleAnswer(btn, q));
    });

    document.getElementById('nextButtonContainer').classList.add('hidden');
}


// ============================================
// ОБРАБОТКА ОТВЕТА
// ============================================

async function handleAnswer(button, question) {
    if (state.answered) return;
    state.answered = true;

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

    document.getElementById('nextButton').addEventListener('click', nextQuestion);
    document.getElementById('playAgainBtn').addEventListener('click', loadQuiz);
    document.getElementById('guestLoginBtn').addEventListener('click', () => {
        openAuthModal('register');
    });
});