// ============================================
// ЗАГРУЗКА ТОПА ДОНАТЕРОВ
// ============================================

async function loadDonators() {
    const container = document.getElementById('donatorsList');
    if (!container) return;

    try {
        const response = await fetch('/api/donations/top?limit=20');
        if (!response.ok) throw new Error('Не удалось загрузить список');

        const donators = await response.json();

        if (donators.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <div class="text-4xl mb-2">💝</div>
                    <p>Пока никто не задонатил.<br>Будь первым! ❤️</p>
                </div>
            `;
            return;
        }

        // Медали для топ-3
        const medals = ['🥇', '🥈', '🥉'];

        container.innerHTML = donators.map((d, i) => {
            const medal = medals[i] || `<span class="text-gray-500 text-sm w-8 text-center inline-block">#${i + 1}</span>`;
            const countLabel = d.donations_count > 1
                ? `<span class="text-xs text-gray-500 ml-1">× ${d.donations_count}</span>`
                : '';

            return `
        <div class="flex items-center gap-3 p-3 bg-dark-700/50 hover:bg-dark-700 transition rounded-lg border border-dark-600">
            <div class="text-2xl w-10 text-center flex-shrink-0">${medal}</div>
            
            <div class="flex-1 min-w-0">
                <div class="font-bold truncate">
                    ${escapeHtml(d.nickname)}${countLabel}
                    ${d.last_message ? `<span class="text-xs text-gray-400 font-normal italic ml-2">— ${escapeHtml(d.last_message)}</span>` : ''}
                </div>
            </div>
            
            <div class="text-right flex-shrink-0">
                <div class="text-lg font-black text-pink-400">${d.total_amount} ₽</div>
            </div>
        </div>
    `;
        }).join('');
    } catch (err) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-6">
                ❌ ${err.message}
            </div>
        `;
    }
}


function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}


document.addEventListener('DOMContentLoaded', () => {
    loadDonators();
});