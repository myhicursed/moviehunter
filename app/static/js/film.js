// ============================================
// КОНФИГ
// ============================================

const filmConfig =
    document.getElementById('filmConfig');

const filmId =
    Number(filmConfig.dataset.movieId);


// ============================================
// СОСТОЯНИЕ
// ============================================

let filmData = null;

let reactionLoading = false;
let libraryLoading = false;


// ============================================
// ЗАГРУЗКА ФИЛЬМА
// ============================================

async function loadFilm() {
    try {
        /*
         * apiRequest можно использовать и гостю.
         * Если токена нет — Authorization просто
         * не будет добавлен.
         */
        const response =
            await apiRequest(
                `/api/movies/${filmId}`
            );


        if (!response.ok) {
            throw new Error(
                'Фильм не найден'
            );
        }


        filmData =
            await response.json();


        renderFilm();


        document
            .getElementById('filmLoading')
            .classList
            .add('hidden');


        document
            .getElementById('filmContent')
            .classList
            .remove('hidden');


    } catch (error) {

        console.error(
            'Ошибка загрузки фильма:',
            error
        );


        document
            .getElementById('filmLoading')
            .classList
            .add('hidden');


        document
            .getElementById('filmError')
            .classList
            .remove('hidden');
    }
}


// ============================================
// ОТРИСОВКА ФИЛЬМА
// ============================================

function renderFilm() {

    // Название
    document
        .getElementById('filmTitle')
        .textContent =
        filmData.title;


    // Год
    document
        .getElementById('filmYear')
        .textContent =
        filmData.year;


    // Режиссёр
    document
        .getElementById('filmDirector')
        .textContent =
        filmData.director || 'Не указан';



    const featuredBadge =
        document.getElementById(
            'filmFeaturedBadge'
        );

    if (
        featuredBadge &&
        filmData.is_featured_movie
    ) {
        featuredBadge.classList.remove(
            'hidden'
        );

        featuredBadge.classList.add(
            'flex'
        );
    }

    // ============================================
    // ПОСТЕР
    // ============================================

    const poster =
        document.getElementById(
            'filmPoster'
        );


    if (filmData.poster_url) {

        poster.innerHTML = `
            <img
                src="${escapeFilmHtml(filmData.poster_url)}"
                alt="${escapeFilmHtml(filmData.title)}"
                class="w-full h-full object-cover"
            >
        `;

    } else {

        poster.innerHTML = `
            <div
                class="w-full h-full
                       flex flex-col
                       items-center justify-center
                       bg-gradient-to-br
                       from-[#15151b]
                       to-[#0d0d11]
                       text-gray-600">

                <i
                    class="fa-solid fa-film
                           text-6xl
                           mb-3">
                </i>

                <span class="text-sm">
                    Постера пока нет
                </span>

            </div>
        `;
    }


    // ============================================
    // ЖАНРЫ
    // ============================================

    const genres =
        document.getElementById(
            'filmGenres'
        );


    if (
        filmData.genres &&
        filmData.genres.length > 0
    ) {

        genres.innerHTML =
            filmData.genres
                .map(genre => `
                    <span
                        class="px-3 py-1
                               rounded-full
                               bg-white/5
                               border border-white/10
                               text-xs
                               font-semibold
                               text-gray-300">

                        ${escapeFilmHtml(genre)}

                    </span>
                `)
                .join('');

    } else {

        genres.innerHTML = `
            <span
                class="text-xs
                       text-gray-600">
                Жанр не указан
            </span>
        `;
    }


    // ============================================
    // СТАТИСТИКА
    // ============================================

    renderMovieStats();


    // ============================================
    // БИБЛИОТЕКА
    // ============================================

    updateLibraryButton();


    // ============================================
    // РЕАКЦИИ
    // ============================================

    updateReactions();


    // Подсказка гостю
    if (!isAuthenticated()) {

        document
            .getElementById(
                'filmGuestHint'
            )
            .classList
            .remove('hidden');
    }
}


// ============================================
// СТАТИСТИКА ФИЛЬМА
// ============================================

function renderMovieStats() {

    const stats =
        filmData.stats || {};


    const guessedPercent =
        document.getElementById(
            'filmGuessedPercent'
        );


    const attempts =
        document.getElementById(
            'filmAttempts'
        );


    const wantToWatch =
        document.getElementById(
            'filmWantToWatch'
        );


    /*
     * Если ещё никто не отвечал,
     * показываем не "0%", а "—".
     */
    if (
        stats.guessed_percent === null ||
        stats.guessed_percent === undefined ||
        Number(stats.attempts || 0) === 0
    ) {

        guessedPercent.textContent =
            '—';

        attempts.textContent =
            'Пока нет попыток';

    } else {

        guessedPercent.textContent =
            `${Math.round(
                stats.guessed_percent
            )}%`;


        attempts.textContent =
            `Ответов: ${stats.attempts}`;
    }


    wantToWatch.textContent =
        stats.want_to_watch || 0;
}


// ============================================
// КНОПКА "ХОЧУ ПОСМОТРЕТЬ"
// ============================================

function updateLibraryButton() {

    const button =
        document.getElementById(
            'filmLibraryBtn'
        );


    const text =
        document.getElementById(
            'filmLibraryText'
        );


    const icon =
        document.getElementById(
            'filmLibraryIcon'
        );


    if (filmData.in_library === true) {

        button.classList.add(
            'bg-brand/10',
            'border-brand/40'
        );


        text.textContent =
            'В моей фильмотеке';


        icon.className =
            'fa-solid fa-bookmark text-brand';

    } else {

        button.classList.remove(
            'bg-brand/10',
            'border-brand/40'
        );


        text.textContent =
            'Хочу посмотреть';


        icon.className =
            'fa-regular fa-bookmark text-brand';
    }
}


// ============================================
// ДОБАВИТЬ / УДАЛИТЬ ИЗ ФИЛЬМОТЕКИ
// ============================================

async function toggleLibrary() {

    /*
     * Для гостя открываем регистрацию.
     */
    if (!isAuthenticated()) {

        openAuthModal('register');

        return;
    }


    if (
        libraryLoading ||
        !filmData
    ) {
        return;
    }


    libraryLoading = true;


    const button =
        document.getElementById(
            'filmLibraryBtn'
        );


    const text =
        document.getElementById(
            'filmLibraryText'
        );


    const wasInLibrary =
        filmData.in_library === true;


    button.disabled = true;


    const oldText =
        text.textContent;


    text.textContent =
        'Подождите...';


    try {

        const response =
            await apiRequest(
                `/api/library/${filmId}`,
                {
                    method:
                        wasInLibrary
                            ? 'DELETE'
                            : 'POST',
                }
            );


        if (!response.ok) {

            throw new Error(
                'Не удалось изменить фильмотеку'
            );
        }


        const result =
            await response.json();


        filmData.in_library =
            result.in_library;


        // ============================================
        // ОБНОВЛЯЕМ СЧЁТЧИК БЕЗ ПЕРЕЗАГРУЗКИ
        // ============================================

        if (
            wasInLibrary !==
            result.in_library
        ) {

            if (result.in_library) {

                filmData.stats.want_to_watch =
                    Number(
                        filmData.stats
                            .want_to_watch || 0
                    ) + 1;

            } else {

                filmData.stats.want_to_watch =
                    Math.max(
                        0,
                        Number(
                            filmData.stats
                                .want_to_watch || 0
                        ) - 1
                    );
            }
        }


        updateLibraryButton();

        renderMovieStats();


    } catch (error) {

        console.error(
            'Ошибка изменения фильмотеки:',
            error
        );


        text.textContent =
            oldText;

    } finally {

        button.disabled =
            false;

        libraryLoading =
            false;
    }
}


// ============================================
// РЕАКЦИИ
// ============================================

function updateReactions() {

    const reactions =
        filmData.reactions || {};


    /*
     * Обновляем числа.
     */
    [
        'love',
        'fire',
        'funny',
        'sad',
        'wow'
    ].forEach(name => {

        const element =
            document.querySelector(
                `[data-count="${name}"]`
            );


        if (element) {

            element.textContent =
                reactions[name] || 0;
        }
    });


    /*
     * Подсвечиваем выбранную
     * пользователем реакцию.
     */
    document
        .querySelectorAll(
            '.reaction-btn'
        )
        .forEach(button => {

            const active =
                button.dataset.reaction ===
                filmData.user_reaction;


            button.classList.toggle(
                'active',
                active
            );
        });
}


// ============================================
// ОТПРАВКА РЕАКЦИИ
// ============================================

async function reactToMovie(reaction) {

    /*
     * Гость → регистрация.
     */
    if (!isAuthenticated()) {

        openAuthModal('register');

        return;
    }


    if (
        reactionLoading ||
        !filmData
    ) {
        return;
    }


    reactionLoading =
        true;


    const buttons =
        document.querySelectorAll(
            '.reaction-btn'
        );


    buttons.forEach(button => {
        button.disabled = true;
    });


    try {

        const response =
            await apiRequest(
                `/api/movies/${filmId}/reaction`,
                {
                    method: 'POST',

                    body: JSON.stringify({
                        reaction: reaction
                    }),
                }
            );


        if (!response.ok) {

            let message =
                'Не удалось сохранить реакцию';


            try {

                const data =
                    await response.json();


                if (data.detail) {
                    message =
                        data.detail;
                }

            } catch (_) {
                // ignore
            }


            throw new Error(
                message
            );
        }


        const result =
            await response.json();


        filmData.user_reaction =
            result.user_reaction;


        filmData.reactions =
            result.reactions;


        updateReactions();


    } catch (error) {

        console.error(
            'Ошибка реакции:',
            error
        );

    } finally {

        reactionLoading =
            false;


        buttons.forEach(button => {
            button.disabled = false;
        });
    }
}


// ============================================
// БЕЗОПАСНЫЙ HTML
// ============================================

function escapeFilmHtml(value) {

    const div =
        document.createElement(
            'div'
        );


    div.textContent =
        String(value ?? '');


    return div.innerHTML;
}


// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================

document.addEventListener(
    'DOMContentLoaded',
    () => {

        // Загрузить фильм
        loadFilm();


        // Хочу посмотреть
        document
            .getElementById(
                'filmLibraryBtn'
            )
            ?.addEventListener(
                'click',
                toggleLibrary
            );


        // Реакции
        document
            .querySelectorAll(
                '.reaction-btn'
            )
            .forEach(button => {

                button.addEventListener(
                    'click',
                    () => {

                        reactToMovie(
                            button.dataset.reaction
                        );
                    }
                );

            });

    }
);