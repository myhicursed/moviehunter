const filmsState = {
    page: 1,
    pages: 1,
    limit: 24,
    genre: '',
    search: '',
};

let filmsSearchTimer = null;


function escapeFilmsHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
}


function getReactionTotal(reactions) {
    return Object.values(reactions || {})
        .reduce(
            (sum, value) =>
                sum + Number(value || 0),
            0
        );
}


function createFilmCard(movie) {
    const poster = movie.poster_url
        ? `
            <img
                src="${escapeFilmsHtml(movie.poster_url)}"
                alt="${escapeFilmsHtml(movie.title)}"
                loading="lazy"
                class="w-full h-full object-cover
                       group-hover:scale-105
                       transition-transform duration-500">
        `
        : `
            <div
                class="w-full h-full
                       flex flex-col
                       items-center justify-center
                       bg-[#15151b]
                       text-gray-600">

                <i class="fa-solid fa-film text-4xl mb-2"></i>

                <span class="text-[10px]">
                    Постера пока нет
                </span>

            </div>
        `;


    const reactions =
        getReactionTotal(
            movie.reactions
        );


    const guessed =
        movie.stats?.guessed_percent;


    const guessedText =
        guessed === null ||
            guessed === undefined
            ? '—'
            : `${Math.round(guessed)}%`;


    const wantToWatch =
        movie.stats?.want_to_watch || 0;


    const featuredBadge =
        movie.is_featured_movie
            ? `
                <div
                    class="absolute
                           top-2 left-2
                           z-10
                           px-2 py-1
                           rounded-full
                           bg-orange-500
                           text-white
                           text-[8px] sm:text-[9px]
                           font-black
                           uppercase
                           shadow-[0_0_15px_rgba(249,115,22,0.45)]">

                    🔥 Фильм дня

                </div>
            `
            : '';


    return `
        <a
            href="/film/${movie.id}"
            class="glass-card
                   group
                   rounded-xl
                   overflow-hidden">

            <!-- ВАЖНО:
                 relative нужен, чтобы бейдж
                 позиционировался внутри постера -->
            <div
                class="relative
                       aspect-[2/3]
                       overflow-hidden
                       bg-[#15151b]">

                ${featuredBadge}

                ${poster}

            </div>


            <div class="p-3">

                <h2
                    class="font-bold
                           text-sm
                           leading-tight
                           text-white
                           line-clamp-2
                           min-h-[2.5rem]">

                    ${escapeFilmsHtml(movie.title)}

                </h2>


                <div class="mt-2">

                    <div
                        class="flex
                               items-center
                               justify-between
                               gap-2">

                        <span class="text-xs text-gray-500">
                            ${movie.year}
                        </span>


                        <span
                            class="text-xs
                                   text-gray-500
                                   flex items-center gap-1">

                            ❤️ ${reactions}

                        </span>

                    </div>


                    <div
                        class="flex
                               items-center
                               justify-between
                               gap-2
                               mt-2
                               pt-2
                               border-t border-white/5">

                        <span
                            class="text-[10px] sm:text-xs
                                   text-gray-400"
                            title="Процент правильных ответов">

                            🎯 ${guessedText}

                        </span>


                        <span
                            class="text-[10px] sm:text-xs
                                   text-gray-400"
                            title="Хотят посмотреть">

                            🔖 ${wantToWatch}

                        </span>

                    </div>

                </div>

            </div>

        </a>
    `;
}


async function loadFilms() {
    const loading =
        document.getElementById('filmsLoading');

    const grid =
        document.getElementById('filmsGrid');

    const empty =
        document.getElementById('filmsEmpty');

    loading.classList.remove('hidden');
    grid.classList.add('hidden');
    empty.classList.add('hidden');


    const params = new URLSearchParams({
        page: filmsState.page,
        limit: filmsState.limit,
    });

    if (filmsState.search) {
        params.set(
            'search',
            filmsState.search
        );
    }

    if (filmsState.genre) {
        params.set(
            'genre',
            filmsState.genre
        );
    }


    try {
        const response = await fetch(
            `/api/movies?${params}`
        );

        if (!response.ok) {
            throw new Error(
                'Не удалось загрузить фильмы'
            );
        }

        const data =
            await response.json();

        filmsState.pages =
            data.pages;

        loading.classList.add('hidden');

        document.getElementById(
            'filmsCount'
        ).textContent =
            `Найдено фильмов: ${data.total}`;


        if (data.items.length === 0) {
            empty.classList.remove('hidden');
            updatePagination();
            return;
        }


        grid.innerHTML =
            data.items
                .map(createFilmCard)
                .join('');

        grid.classList.remove('hidden');

        updatePagination();

    } catch (error) {
        loading.classList.add('hidden');

        empty.classList.remove('hidden');

        empty.querySelector('h2').textContent =
            'Не удалось загрузить фильмы';

        console.error(error);
    }
}


function updatePagination() {
    const container =
        document.getElementById(
            'filmsPagination'
        );

    const prev =
        document.getElementById(
            'filmsPrev'
        );

    const next =
        document.getElementById(
            'filmsNext'
        );

    const page =
        document.getElementById(
            'filmsPage'
        );


    if (filmsState.pages <= 1) {
        container.classList.add('hidden');
        return;
    }


    container.classList.remove('hidden');

    prev.disabled =
        filmsState.page <= 1;

    next.disabled =
        filmsState.page >=
        filmsState.pages;

    page.textContent =
        `${filmsState.page} / ${filmsState.pages}`;
}


document.addEventListener(
    'DOMContentLoaded',
    () => {

        loadFilms();


        document
            .getElementById('filmsSearch')
            .addEventListener(
                'input',
                event => {

                    clearTimeout(
                        filmsSearchTimer
                    );

                    filmsSearchTimer =
                        setTimeout(() => {

                            filmsState.search =
                                event.target.value.trim();

                            filmsState.page = 1;

                            loadFilms();

                        }, 350);
                }
            );


        document
            .querySelectorAll(
                '.genre-filter'
            )
            .forEach(button => {

                button.addEventListener(
                    'click',
                    () => {

                        document
                            .querySelectorAll(
                                '.genre-filter'
                            )
                            .forEach(item =>
                                item.classList.remove(
                                    'active'
                                )
                            );

                        button.classList.add(
                            'active'
                        );

                        filmsState.genre =
                            button.dataset.genre;

                        filmsState.page = 1;

                        loadFilms();
                    }
                );

            });


        document
            .getElementById('filmsPrev')
            .addEventListener(
                'click',
                () => {

                    if (filmsState.page > 1) {
                        filmsState.page--;

                        loadFilms();

                        window.scrollTo({
                            top: 0,
                            behavior: 'smooth',
                        });
                    }
                }
            );


        document
            .getElementById('filmsNext')
            .addEventListener(
                'click',
                () => {

                    if (
                        filmsState.page <
                        filmsState.pages
                    ) {
                        filmsState.page++;

                        loadFilms();

                        window.scrollTo({
                            top: 0,
                            behavior: 'smooth',
                        });
                    }
                }
            );

    }
);