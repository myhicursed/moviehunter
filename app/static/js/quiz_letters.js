// ============================================
// СОСТОЯНИЕ
// ============================================

const state = {
    questions: [],
    currentIndex: 0,
    correctCount: 0,
    totalPoints: 0,
    answered: false,
    answerSlots: [],
    poolLetters: [],
    lockedSlots: [],   // буквы, угаданные на правильных местах
    attemptsUsed: 0,
    maxAttempts: 3,
    videoWatched: false,
    timerInterval: null,
    timerRemaining: 0,
    lettersLocked: true,
};
const LETTERS_TIME_LIMIT = 30;


// ============================================
// ЭКРАНЫ
// ============================================

function showScreen(id) {
    if (id !== 'gameScreen') stopVideo();

    ['loadingScreen', 'errorScreen', 'gameScreen', 'resultScreen', 'reloadScreen'].forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.add('hidden');
    });
    document.getElementById(id).classList.remove('hidden');
}

function showError(message) {
    document.getElementById('errorMessage').textContent = message;
    showScreen('errorScreen');
}


// ============================================
// УПРАВЛЕНИЕ КНОПКАМИ
// ============================================

function setActionButtons(disabled) {
    ['shuffleBtn', 'surrenderBtn', 'clearBtn', 'hintBtn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = disabled;
    });
}


// ============================================
// ЗАГРУЗКА КВИЗА
// ============================================

async function loadQuiz() {
    stopVideo();
    showScreen('loadingScreen');

    try {
        const response = await fetch('/api/quiz/letters');

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Не удалось загрузить квиз');
        }

        state.questions = await response.json();
        state.currentIndex = 0;
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
    state.attemptsUsed = 0;

    // Прогресс
    document.getElementById('currentQuestion').textContent = state.currentIndex + 1;
    document.getElementById('currentScore').textContent = state.totalPoints;
    document.getElementById('attemptsUsed').textContent = state.attemptsUsed;
    document.getElementById('attemptsMax').textContent = state.maxAttempts;

    const progress = (state.currentIndex / state.questions.length) * 100;
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

    // Видео
    const video = document.getElementById('videoPlayer');
    video.src = `/media/movies/${q.filename}`;
    video.load();

    // Защита от паузы
    video.onpause = () => {
        if (!video.ended && !state.answered) {
            video.play().catch(() => { });
        }
    };

    // Когда видео закончится — разблокировать буквы и запустить таймер
    video.onended = () => {
        state.videoWatched = true;
        enableLetters();
        startLettersTimer();
    };

    // Инициализация слотов, пула и локов
    state.answerSlots = new Array(q.answer_length).fill(null);
    state.lockedSlots = new Array(q.answer_length).fill(false);

    for (const spaceIdx of q.spaces) {
        state.answerSlots[spaceIdx] = ' ';
    }

    state.poolLetters = q.letters.map((char, idx) => ({
        char,
        id: idx,
        used: false,
    }));

    renderSlots();
    renderPool();

    // Сброс кнопок
    document.getElementById('checkBtn').disabled = true;
    setActionButtons(true);   // 🆕 блокируем сразу
    document.getElementById('nextButtonContainer').classList.add('hidden');
    document.getElementById('resultMessage').classList.add('hidden');

    // Статус
    document.getElementById('lettersWatchingStatus').classList.remove('hidden');
    document.getElementById('lettersTimerStatus').classList.add('hidden');

    state.lettersLocked = true;
    // Сброс таймера
    state.videoWatched = false;
    clearLettersTimer();
}


// ============================================
// ОТРИСОВКА СЛОТОВ
// ============================================

function renderSlots() {
    const container = document.getElementById('answerSlots');
    const q = state.questions[state.currentIndex];

    // Определяем размер квадратов по длине слова
    const totalLen = q.answer_length;
    let slotSize, slotClass;

    if (totalLen <= 10) {
        slotSize = 'w-10 h-12 md:w-12 md:h-14 text-lg md:text-xl';
    } else if (totalLen <= 16) {
        slotSize = 'w-8 h-10 md:w-10 md:h-12 text-base md:text-lg';
    } else if (totalLen <= 22) {
        slotSize = 'w-7 h-9 md:w-9 md:h-11 text-sm md:text-base';
    } else {
        slotSize = 'w-6 h-8 md:w-8 md:h-10 text-xs md:text-sm';
    }

    // Разбиваем на слова по пробелам
    const words = [];
    let currentWord = [];

    state.answerSlots.forEach((letter, idx) => {
        if (q.spaces.includes(idx)) {
            if (currentWord.length > 0) words.push(currentWord);
            currentWord = [];
        } else {
            currentWord.push({ letter, idx });
        }
    });
    if (currentWord.length > 0) words.push(currentWord);

    // Рендерим каждое слово отдельным блоком
    container.innerHTML = words.map(word => `
        <div class="flex justify-center gap-1 md:gap-2 flex-wrap w-full">
            ${word.map(({ letter, idx }) => {
        const isFilled = letter !== null && letter !== ' ';
        const isLocked = state.lockedSlots[idx];

        let classes = `${slotSize} flex items-center justify-center rounded-lg font-black border-2 transition `;

        if (isLocked) {
            classes += 'bg-green-500/30 border-green-500 text-green-300 cursor-default';
            return `<div class="${classes}">${letter}</div>`;
        }

        if (isFilled) {
            classes += 'bg-brand border-brand text-white cursor-pointer';
        } else {
            classes += 'bg-dark-800 border-dark-600 text-gray-500';
        }

        return `
                    <button 
                        class="slot-btn ${classes}"
                        data-slot="${idx}"
                        ${!isFilled ? 'disabled' : ''}
                    >
                        ${isFilled ? letter : ''}
                    </button>
                `;
    }).join('')}
        </div>
    `).join('');

    // Клик по заполненному слоту — вернуть букву в пул
    container.querySelectorAll('.slot-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => {
            const slotIdx = parseInt(btn.dataset.slot);
            returnLetterToPool(slotIdx);
        });
    });

    // Активировать "Проверить" если все слоты заполнены
    const allFilled = state.answerSlots.every(s => s !== null);
    document.getElementById('checkBtn').disabled = !allFilled || state.answered;
}


// ============================================
// ОТРИСОВКА ПУЛА
// ============================================

function renderPool() {
    const container = document.getElementById('lettersPool');

    container.innerHTML = state.poolLetters.map(letter => {
        const isDisabled = letter.used || state.lettersLocked;
        const disabledClass = isDisabled
            ? 'opacity-30 cursor-not-allowed'
            : 'hover:bg-brand hover:border-brand cursor-pointer';

        return `
            <button 
                class="letter-btn w-10 h-12 md:w-12 md:h-14 flex items-center justify-center rounded-lg font-black text-lg md:text-xl bg-dark-700 border-2 border-dark-500 transition ${disabledClass}"
                data-letter-id="${letter.id}"
                ${isDisabled ? 'disabled' : ''}
            >
                ${letter.char}
            </button>
        `;
    }).join('');

    container.querySelectorAll('.letter-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => {
            const letterId = parseInt(btn.dataset.letterId);
            placeLetterInSlot(letterId);
        });
    });
}


// ============================================
// РАЗМЕСТИТЬ БУКВУ В СЛОТ
// ============================================

function placeLetterInSlot(letterId) {
    if (state.answered) return;
    if (state.lettersLocked) return;

    // Найти первый пустой НЕзалоченный слот
    const q = state.questions[state.currentIndex];
    const emptyIdx = state.answerSlots.findIndex((s, idx) =>
        s === null && !state.lockedSlots[idx]
    );
    if (emptyIdx === -1) return;

    const letter = state.poolLetters.find(l => l.id === letterId);
    if (!letter || letter.used) return;

    state.answerSlots[emptyIdx] = letter.char;
    letter.used = true;

    renderSlots();
    renderPool();
}


// ============================================
// ВЕРНУТЬ БУКВУ В ПУЛ
// ============================================

function returnLetterToPool(slotIdx) {
    if (state.answered) return;
    if (state.lockedSlots[slotIdx]) return;   // залоченные не трогаем

    const q = state.questions[state.currentIndex];
    if (q.spaces.includes(slotIdx)) return;

    const char = state.answerSlots[slotIdx];
    if (!char || char === ' ') return;

    const letter = state.poolLetters.find(l => l.char === char && l.used);
    if (letter) letter.used = false;

    state.answerSlots[slotIdx] = null;

    renderSlots();
    renderPool();
}


// ============================================
// ОЧИСТИТЬ (кроме залоченных)
// ============================================

function clearAnswer() {
    if (state.answered) return;

    const q = state.questions[state.currentIndex];

    state.answerSlots = state.answerSlots.map((val, idx) => {
        if (state.lockedSlots[idx]) return val;   // залоченные оставляем
        if (q.spaces.includes(idx)) return ' ';
        return null;
    });

    // Освободить буквы, которые не в залоченных слотах
    const usedInLocked = state.answerSlots
        .filter((v, i) => state.lockedSlots[i] && v && v !== ' ');

    state.poolLetters.forEach(l => {
        // Считаем, сколько раз символ используется в залоченных
        const neededCount = usedInLocked.filter(c => c === l.char).length;
        // Сколько уже помечено как used с этим символом
        const currentUsed = state.poolLetters.filter(x => x.char === l.char && x.used).length;

        // Если избыток — освобождаем текущую букву
        if (l.used && currentUsed > neededCount) {
            l.used = false;
        }
    });

    renderSlots();
    renderPool();
}


// ============================================
// ПЕРЕМЕШАТЬ БУКВЫ
// ============================================

function shuffleLetters() {
    if (state.answered) return;

    const unused = state.poolLetters.filter(l => !l.used);

    for (let i = unused.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [unused[i], unused[j]] = [unused[j], unused[i]];
    }

    let unusedIdx = 0;
    state.poolLetters = state.poolLetters.map(l => {
        if (l.used) return l;
        return unused[unusedIdx++];
    });

    renderPool();
}


// ============================================
// ПОДСКАЗКА
// ============================================

function useHint() {
    alert('Подсказка пока в разработке. Скоро!');
}


// ============================================
// ПРОВЕРКА ОТВЕТА
// ============================================

async function checkAnswer() {
    if (state.answered) return;

    const q = state.questions[state.currentIndex];
    const userAnswer = state.answerSlots.join('');

    // Блокируем на время запроса
    document.getElementById('checkBtn').disabled = true;
    setActionButtons(true);

    try {
        const response = await apiRequest('/api/quiz/answer', {
            method: 'POST',
            body: JSON.stringify({
                movie_id: q.movie_id,
                user_answer: userAnswer,
                mode: 'letters',
            }),
        });

        if (!response.ok) throw new Error('Ошибка проверки');

        const result = await response.json();
        const msgBlock = document.getElementById('resultMessage');
        const msgText = document.getElementById('resultMessageText');

        if (result.correct) {
            // === ПРАВИЛЬНО ===
            state.answered = true;
            clearLettersTimer();   // 🆕 остановить таймер

            state.lockedSlots = state.lockedSlots.map(() => true);
            renderSlots();

            msgText.textContent = '✅ Верно!';
            msgText.className = 'text-2xl font-black text-green-400';
            msgBlock.classList.remove('hidden');

            state.correctCount++;
            state.totalPoints += result.points;
            document.getElementById('currentScore').textContent = state.totalPoints;

            showNextButton();

        } else {
            // === НЕПРАВИЛЬНО ===
            state.attemptsUsed++;
            document.getElementById('attemptsUsed').textContent = state.attemptsUsed;

            const slots = document.querySelectorAll('.slot-btn');
            slots.forEach(btn => btn.classList.add('shake'));

            if (result.letter_matches) {
                slots.forEach((btn) => {
                    const slotIdx = parseInt(btn.dataset.slot);
                    if (result.letter_matches[slotIdx]) {
                        btn.classList.add('bg-green-500/30', 'border-green-500', 'text-green-300');
                    } else {
                        btn.classList.add('bg-red-500/30', 'border-red-500', 'text-red-300');
                    }
                });
            }

            if (state.attemptsUsed >= state.maxAttempts) {
                // === ПОПЫТКИ ЗАКОНЧИЛИСЬ ===
                state.answered = true;
                clearLettersTimer();   // 🆕 остановить таймер

                msgText.textContent = '💔 Ты не угадал';
                msgText.className = 'text-2xl font-black text-red-400';
                msgBlock.classList.remove('hidden');

                setTimeout(() => {
                    showCorrectAnswer(result.correct_answer);
                    document.querySelectorAll('.slot-btn').forEach(btn => {
                        btn.classList.remove('shake');
                    });
                    showNextButton();
                }, 1000);

            } else {
                // === ЕЩЁ ЕСТЬ ПОПЫТКИ ===
                const left = state.maxAttempts - state.attemptsUsed;
                msgText.textContent = `❌ Неверно! Осталось попыток: ${left}`;
                msgText.className = 'text-2xl font-black text-red-400';
                msgBlock.classList.remove('hidden');

                setTimeout(() => {
                    if (result.letter_matches) {
                        result.letter_matches.forEach((isCorrect, idx) => {
                            if (isCorrect) state.lockedSlots[idx] = true;
                        });

                        state.answerSlots.forEach((letter, idx) => {
                            if (q.spaces.includes(idx)) return;
                            if (state.lockedSlots[idx]) return;

                            if (letter && letter !== ' ') {
                                const poolLetter = state.poolLetters.find(l => l.char === letter && l.used);
                                if (poolLetter) poolLetter.used = false;
                            }
                            state.answerSlots[idx] = null;
                        });
                    }

                    renderSlots();
                    renderPool();

                    setActionButtons(false);
                    msgBlock.classList.add('hidden');
                }, 1200);
            }
        }

    } catch (err) {
        alert('Ошибка: ' + err.message);
        document.getElementById('checkBtn').disabled = false;
        setActionButtons(false);
    }
}


function showCorrectAnswer(correctAnswer) {
    const pool = document.getElementById('lettersPool');
    pool.innerHTML = `
        <div class="text-center w-full">
            <p class="text-gray-400 text-sm mb-2">Правильный ответ:</p>
            <p class="text-2xl font-black text-green-400">${correctAnswer}</p>
        </div>
    `;
}


function showNextButton() {
    const nextBtn = document.getElementById('nextButton');
    nextBtn.innerHTML = state.currentIndex < state.questions.length - 1
        ? 'Дальше <i class="fa-solid fa-arrow-right"></i>'
        : 'Показать результат <i class="fa-solid fa-trophy"></i>';
    document.getElementById('nextButtonContainer').classList.remove('hidden');
}


// ============================================
// СДАТЬСЯ
// ============================================

async function surrender() {
    if (state.answered) return;

    const q = state.questions[state.currentIndex];

    state.answered = true;
    clearLettersTimer();   // 🆕 остановить таймер
    document.getElementById('checkBtn').disabled = true;
    setActionButtons(true);

    try {
        const response = await apiRequest('/api/quiz/answer', {
            method: 'POST',
            body: JSON.stringify({
                movie_id: q.movie_id,
                user_answer: '__surrender__',
                mode: 'letters',
            }),
        });

        const result = await response.json();

        showCorrectAnswer(result.correct_answer);

        const msgBlock = document.getElementById('resultMessage');
        const msgText = document.getElementById('resultMessageText');
        msgText.textContent = '🏳️ Сдался';
        msgText.className = 'text-2xl font-black text-gray-400';
        msgBlock.classList.remove('hidden');

        document.querySelectorAll('.slot-btn').forEach(btn => {
            btn.classList.remove('bg-brand', 'border-brand');
            btn.classList.add('bg-dark-700', 'border-dark-500', 'text-gray-500');
        });

        showNextButton();

    } catch (err) {
        alert('Ошибка: ' + err.message);
    }
}


// ============================================
// СЛЕДУЮЩИЙ ВОПРОС
// ============================================

function nextQuestion() {
    clearLettersTimer();
    state.currentIndex++;
    if (state.currentIndex >= state.questions.length) {
        showResult();
    } else {
        showQuestion();
    }
}


// ============================================
// РЕЗУЛЬТАТ
// ============================================

function showResult() {
    clearLettersTimer();
    stopVideo();
    const total = state.questions.length;
    const percent = Math.round((state.correctCount / total) * 100);

    document.getElementById('resultCorrect').textContent = state.correctCount;
    document.getElementById('resultTotal').textContent = total;
    document.getElementById('resultPoints').textContent = state.totalPoints;

    let emoji, title, subtitle;
    if (percent === 100) {
        emoji = '🏆'; title = 'Легенда букв!'; subtitle = 'Идеально!';
    } else if (percent >= 80) {
        emoji = '🔤'; title = 'Мастер!'; subtitle = 'Ты классно собираешь слова';
    } else if (percent >= 50) {
        emoji = '👍'; title = 'Неплохо!'; subtitle = 'Есть куда расти';
    } else if (percent >= 20) {
        emoji = '🤔'; title = 'Так себе...'; subtitle = 'Тренируйся ещё';
    } else {
        emoji = '😅'; title = 'Ой...'; subtitle = 'Попробуй режим с вариантами';
    }

    document.getElementById('resultEmoji').textContent = emoji;
    document.getElementById('resultTitle').textContent = title;
    document.getElementById('resultSubtitle').textContent = subtitle;

    if (!isAuthenticated()) {
        document.getElementById('guestMessage').classList.remove('hidden');
    }

    showScreen('resultScreen');
}


// ============================================
// УТИЛИТЫ
// ============================================

function stopVideo() {
    const video = document.getElementById('videoPlayer');
    if (video) {
        video.pause();
        video.src = '';
    }
}

// ============================================
// РАЗБЛОКИРОВКА БУКВ ПОСЛЕ ВИДЕО
// ============================================

function enableLetters() {
    document.getElementById('lettersWatchingStatus').classList.add('hidden');
    document.getElementById('lettersTimerStatus').classList.remove('hidden');

    // 🆕 Разблокировать буквы
    state.lettersLocked = false;

    setActionButtons(false);
    renderPool();
}


// ============================================
// ТАЙМЕР ДЛЯ РЕЖИМА БУКВ
// ============================================

function startLettersTimer() {
    state.timerRemaining = LETTERS_TIME_LIMIT;
    updateLettersTimerDisplay();

    state.timerInterval = setInterval(() => {
        state.timerRemaining--;
        updateLettersTimerDisplay();

        if (state.timerRemaining <= 0) {
            lettersTimeExpired();
        }
    }, 1000);
}

function updateLettersTimerDisplay() {
    const el = document.getElementById('lettersTimerSeconds');
    if (el) el.textContent = state.timerRemaining;

    const timerBlock = document.getElementById('lettersTimerStatus');
    if (state.timerRemaining <= 5) {
        timerBlock?.classList.add('animate-pulse');
    }
}

function clearLettersTimer() {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
    const timerBlock = document.getElementById('lettersTimerStatus');
    if (timerBlock) timerBlock.classList.remove('animate-pulse');
}


// ============================================
// ВРЕМЯ ИСТЕКЛО В РЕЖИМЕ БУКВ
// ============================================

async function lettersTimeExpired() {
    if (state.answered) return;
    state.answered = true;
    clearLettersTimer();

    const q = state.questions[state.currentIndex];

    // Заблокировать всё
    setActionButtons(true);
    document.getElementById('checkBtn').disabled = true;

    // Получить правильный ответ через сдачу
    try {
        const response = await apiRequest('/api/quiz/answer', {
            method: 'POST',
            body: JSON.stringify({
                movie_id: q.movie_id,
                user_answer: '__surrender__',
                mode: 'letters',
            }),
        });

        if (response.ok) {
            const result = await response.json();
            showCorrectAnswer(result.correct_answer);
        }
    } catch (err) {
        console.error('Ошибка при таймауте:', err);
    }

    // Сообщение
    const msgBlock = document.getElementById('resultMessage');
    const msgText = document.getElementById('resultMessageText');
    msgText.textContent = '⏱ Время вышло!';
    msgText.className = 'text-2xl font-black text-red-400';
    msgBlock.classList.remove('hidden');

    // Изменить стиль таймера
    const timerBlock = document.getElementById('lettersTimerStatus');
    timerBlock.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation text-red-400"></i>
        <span class="text-red-400 font-bold">Время вышло!</span>
    `;
    timerBlock.classList.remove('animate-pulse', 'border-brand', 'bg-brand/20');
    timerBlock.classList.add('border-red-500', 'bg-red-500/20');

    showNextButton();
}


// ============================================
// ПРОВЕРКА ОБНОВЛЕНИЯ СТРАНИЦЫ
// ============================================

function checkIfPageReloaded() {
    try {
        const navEntries = performance.getEntriesByType('navigation');
        if (navEntries.length > 0) {
            return navEntries[0].type === 'reload';
        }
    } catch (e) {
        console.warn('Performance API недоступен:', e);
    }
    return false;
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Проверка обновления страницы
    const isReload = checkIfPageReloaded();

    if (isReload) {
        showScreen('reloadScreen');
    } else {
        loadQuiz();
    }

    // Кнопка "Начать заново"
    const reloadBtn = document.getElementById('reloadStartBtn');
    if (reloadBtn) {
        reloadBtn.addEventListener('click', loadQuiz);
    }

    // Защита от правого клика на видео
    const video = document.getElementById('lettersVideoPlayer');
    if (video) {
        video.addEventListener('contextmenu', e => e.preventDefault());
    }

    document.getElementById('checkBtn').addEventListener('click', checkAnswer);
    document.getElementById('clearBtn').addEventListener('click', clearAnswer);
    document.getElementById('hintBtn').addEventListener('click', useHint);
    document.getElementById('shuffleBtn').addEventListener('click', shuffleLetters);
    document.getElementById('surrenderBtn').addEventListener('click', surrender);
    document.getElementById('nextButton').addEventListener('click', nextQuestion);
    document.getElementById('playAgainBtn').addEventListener('click', loadQuiz);
    document.getElementById('guestLoginBtn').addEventListener('click', () => {
        openAuthModal('register');
    });
});