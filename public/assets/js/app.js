const state = {
    streams: [],
    selectedIds: new Set(),
    statuses: new Map(),
    metadata: new Map(),
    cards: new Map(),
    players: new Map(),
    muted: new Set(),
    soloId: null,
    monitoring: false,
    refreshingStatus: false,
    refreshingMetadata: false,
    statusTimer: null,
    metadataTimer: null,
    zoom: 1,
    columns: 2,
    lastStatus: new Map(),
    timerSeconds: 0,
};

const els = {
    grid: document.querySelector('#stream-grid'),
    playAll: document.querySelector('#play-all'),
    muteAll: document.querySelector('#mute-all'),
    reconnectAll: document.querySelector('#reconnect-all'),
    toggleColumns: document.querySelector('#toggle-columns'),
    filterToggle: document.querySelector('#filter-toggle'),
    filterMenu: document.querySelector('#filter-menu'),
    filterOptions: document.querySelector('#filter-options'),
    filterCount: document.querySelector('#filter-count'),
    applyFilter: document.querySelector('#apply-filter'),
    resetFilter: document.querySelector('#reset-filter'),
    zoomReset: document.querySelector('#zoom-reset'),
    zoomOut: document.querySelector('#zoom-out'),
    zoomIn: document.querySelector('#zoom-in'),
    shell: document.querySelector('#monitor-shell'),
    toastStack: document.querySelector('#toast-stack'),
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
    bindToolbar();
    await loadStreams();
    renderFilterOptions();
    renderCards();
    requestAnimationFrame(animate);
    setInterval(() => {
        if (state.monitoring) {
            state.timerSeconds++;
        }
    }, 1000);
}

function bindToolbar() {
    els.playAll.addEventListener('click', playAll);
    els.muteAll.addEventListener('click', muteAll);
    els.reconnectAll.addEventListener('click', reconnectAll);
    els.toggleColumns.addEventListener('click', cycleColumns);
    els.filterToggle.addEventListener('click', () => {
        els.filterMenu.hidden = !els.filterMenu.hidden;
    });
    els.applyFilter.addEventListener('click', applyFilter);
    els.resetFilter.addEventListener('click', resetFilter);
    els.zoomReset.addEventListener('click', () => setZoom(1));
    els.zoomOut.addEventListener('click', () => setZoom(Math.max(0.7, state.zoom - 0.1)));
    els.zoomIn.addEventListener('click', () => setZoom(Math.min(1.4, state.zoom + 0.1)));

    document.addEventListener('click', (event) => {
        if (!els.filterMenu.hidden && !event.target.closest('.filter-box')) {
            els.filterMenu.hidden = true;
        }
    });
}

async function loadStreams() {
    const response = await fetch('api/streams.php', { cache: 'no-store' });
    const payload = await response.json();
    state.streams = payload.streams || [];
    state.selectedIds = new Set(state.streams.map((stream) => stream.id));
}

function renderFilterOptions() {
    els.filterOptions.innerHTML = state.streams.map((stream) => `
        <label class="filter-option">
            <input type="checkbox" value="${escapeHtml(stream.id)}" checked>
            <span>${escapeHtml(stream.name)} - ${escapeHtml(stream.city)} / ${escapeHtml(stream.state)}</span>
        </label>
    `).join('');
    updateFilterCount();

    els.filterOptions.querySelectorAll('input').forEach((input) => {
        input.addEventListener('change', updateFilterCount);
    });
}

function renderCards() {
    const streams = visibleStreams();
    state.cards.clear();

    if (streams.length === 0) {
        els.grid.innerHTML = '<div class="empty-state">Nenhuma radio selecionada para monitoramento.</div>';
        return;
    }

    els.grid.innerHTML = streams.map(renderCard).join('');

    streams.forEach((stream) => {
        const card = els.grid.querySelector(`[data-stream-id="${cssEscape(stream.id)}"]`);
        const canvas = card.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        state.cards.set(stream.id, {
            element: card,
            canvas,
            ctx,
            currentL: 0,
            currentR: 0,
            targetL: 0,
            targetR: 0,
            phase: Math.random() * Math.PI * 2,
        });

        card.querySelector('.volume-slider').addEventListener('input', (event) => setVolume(stream.id, Number(event.target.value)));
        card.addEventListener('click', (e) => {
             if (!e.target.closest('.volume-slider')) {
                 soloStream(stream.id);
             }
        });
    });

    applyKnownStateToCards();
}

function renderCard(stream) {
    const city = `${stream.city} - ${stream.state}`;
    return `
        <article class="stream-card checking" data-stream-id="${escapeHtml(stream.id)}">
            <div class="meter-column">
                <div class="vu-wrap">
                    <div class="vu-labels"><span>L</span><span>R</span></div>
                    <div class="vu-meter" aria-label="Audio meter">
                        <div class="vu-channel left">${renderSegments()}</div>
                        <div class="vu-channel right">${renderSegments()}</div>
                    </div>
                </div>
                <div class="fader">
                    <span class="volume-value">100%</span>
                    <div class="fader-track"></div>
                    <input class="volume-slider" type="range" min="0" max="100" value="100" aria-label="Volume ${escapeHtml(city)}">
                </div>
            </div>

            <div class="card-main">
                <div class="card-title-row">
                    <div class="status-dot"></div>
                    <h2 class="stream-title">${escapeHtml(stream.name)}</h2>
                    <span class="frequency">${escapeHtml(stream.frequency)}</span>
                    <span class="city-state">${escapeHtml(city)}</span>
                    <span class="online-count"></span>
                </div>
                <div class="metadata">
                    <span class="song">${escapeHtml(stream.station)} - ${escapeHtml(city)}</span>
                </div>
                <canvas class="waveform" width="720" height="120"></canvas>
                <div class="card-footer">
                    <span class="status-text">Tocando</span>
                    <span class="timer">00:00</span>
                </div>
            </div>
        </article>
    `;
}

function renderSegments() {
    return Array.from({ length: 18 }, (_, index) => `<span class="vu-segment" data-index="${index}"></span>`).join('');
}

async function startMonitoring() {
    if (state.monitoring) return;
    state.monitoring = true;
    await refreshStatus();
    await refreshMetadata();
    state.statusTimer = setInterval(refreshStatus, 5000);
    state.metadataTimer = setInterval(refreshMetadata, 30000);
}

async function playAll() {
    startMonitoring();
    const streams = visibleStreams();
    for (const stream of streams) {
        const player = ensurePlayer(stream.id);
        player.muted = false;
        state.muted.delete(stream.id);
        player.play().catch(err => console.error("Erro ao reproduzir:", stream.id, err));
    }
    showToast("Iniciando reprodução de todos os streams.", "online");
}

async function refreshStatus(ids = visibleStreams().map((stream) => stream.id)) {
    if (state.refreshingStatus || ids.length === 0) return;
    state.refreshingStatus = true;
    try {
        const query = new URLSearchParams({ ids: ids.join(',') });
        const response = await fetch(`api/status.php?${query.toString()}`, { cache: 'no-store' });
        const payload = await response.json();
        (payload.statuses || []).forEach((status) => {
            const previous = state.statuses.get(status.id);
            state.statuses.set(status.id, status);
            applyStatus(status);
            notifyStatusChange(status, previous);
        });
    } catch (error) {
        showToast('Falha ao consultar status.', 'offline');
    } finally {
        state.refreshingStatus = false;
    }
}

async function refreshMetadata(ids = visibleStreams().map((stream) => stream.id)) {
    if (state.refreshingMetadata || ids.length === 0) return;
    state.refreshingMetadata = true;
    try {
        const query = new URLSearchParams({ ids: ids.join(',') });
        const response = await fetch(`api/now-playing.php?${query.toString()}`, { cache: 'no-store' });
        const payload = await response.json();
        (payload.items || []).forEach((item) => {
            state.metadata.set(item.id, item);
            applyMetadata(item);
        });
    } catch (error) {
        showToast('Falha ao consultar metadata.', 'offline');
    } finally {
        state.refreshingMetadata = false;
    }
}

function applyStatus(status) {
    const cardState = state.cards.get(status.id);
    if (!cardState) return;
    const { element } = cardState;
    const online = status.status === 'online';
    cardState.targetL = online ? Number(status.levelL || 0) : 0;
    cardState.targetR = online ? Number(status.levelR || 0) : 0;

    element.classList.toggle('online', online);
    element.classList.toggle('offline', !online);
    element.classList.remove('checking');

    const statusText = element.querySelector('.status-text');
    statusText.textContent = online ? 'Tocando' : `Desconectado. Tentando novamente em 3s...`;

    const countEl = element.querySelector('.online-count');
    if (countEl && status.listeners !== undefined) {
        countEl.textContent = `${status.listeners} online`;
    }
}

function applyMetadata(item) {
    const card = state.cards.get(item.id)?.element;
    if (!card) return;
    const stream = state.streams.find((s) => s.id === item.id);
    const fallback = stream ? `${stream.station} - ${stream.city} / ${stream.state}` : '';
    card.querySelector('.song').textContent = item.song || fallback;
}

function applyKnownStateToCards() {
    state.statuses.forEach(applyStatus);
    state.metadata.forEach(applyMetadata);
}

function notifyStatusChange(status, previous) {
    if (!previous || previous.status === status.status) return;
    const stream = state.streams.find((item) => item.id === status.id);
    const name = stream ? `${stream.name} - ${stream.city}` : status.id;
    const online = status.status === 'online';
    const message = online ? `${name} voltou a ficar online.` : `${name} ficou offline.`;

    showToast(message, online ? 'online' : 'offline');
    registerIncident(status.id, online ? 'recovery' : 'outage', status.status, message);
}

function registerIncident(streamId, type, status, message) {
    fetch('api/incidents.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamId, type, status, message }),
    }).catch(() => {});
}

function ensurePlayer(id) {
    if (state.players.has(id)) return state.players.get(id);
    const audio = new Audio(`api/audio.php?id=${encodeURIComponent(id)}&r=${Date.now()}`);
    audio.preload = 'none';
    audio.volume = getVolume(id);
    audio.muted = state.muted.has(id);
    state.players.set(id, audio);
    return audio;
}

async function soloStream(id) {
    const isSameSolo = state.soloId === id;
    pauseAllPlayers();
    if (isSameSolo) {
        state.soloId = null;
        return;
    }
    state.soloId = id;
    const player = ensurePlayer(id);
    player.muted = false;
    state.muted.delete(id);
    player.play().catch(() => showToast(`Erro ao reproduzir stream.`, 'offline'));
}

function pauseAllPlayers() {
    state.players.forEach(p => p.pause());
}

function muteAll() {
    visibleStreams().forEach((stream) => {
        const player = ensurePlayer(stream.id);
        player.muted = true;
        state.muted.add(stream.id);
    });
    showToast('Todos os players mutados.', 'offline');
}

async function reconnectStream(id) {
    const player = state.players.get(id);
    if (player) {
        player.pause();
        player.src = `api/audio.php?id=${encodeURIComponent(id)}&r=${Date.now()}`;
        player.load();
        if (state.soloId === id) player.play().catch(()=>{});
    }
    await refreshStatus([id]);
}

function reconnectAll() {
    visibleStreams().forEach((stream) => reconnectStream(stream.id));
}

function setVolume(id, value) {
    const volume = value / 100;
    localStorage.setItem(`volume:${id}`, String(volume));
    const player = state.players.get(id);
    if (player) player.volume = volume;
    const card = state.cards.get(id)?.element;
    if (card) {
        card.querySelector('.volume-value').textContent = `${value}%`;
        card.querySelector('.fader-track').style.setProperty('--volume-percent', `${value}%`);
    }
}

function getVolume(id) {
    const stored = Number(localStorage.getItem(`volume:${id}`));
    return Number.isFinite(stored) ? stored : 1;
}

function cycleColumns() {
    let next = (state.columns % 4) + 1;
    setColumns(next);
}

function setColumns(columns) {
    state.columns = columns;
    els.grid.className = `stream-grid cols-${columns}`;
    els.toggleColumns.textContent = `Alterar modo (${columns} colunas)`;
}

function setZoom(value) {
    state.zoom = Number(value.toFixed(2));
    document.documentElement.style.setProperty('--zoom', state.zoom);
    els.zoomReset.textContent = `${Math.round(state.zoom * 100)}%`;
}

function animate() {
    state.cards.forEach((cardState, id) => {
        const status = state.statuses.get(id);
        const online = status?.status === 'online';
        const time = performance.now() / 1000;
        const movement = online ? 0.08 + Math.sin(time * 3 + cardState.phase) * 0.045 : 0;
        cardState.currentL = approach(cardState.currentL, Math.max(0, cardState.targetL + movement), 0.075);
        cardState.currentR = approach(cardState.currentR, Math.max(0, cardState.targetR + movement * 0.8), 0.075);
        renderVu(cardState.element, cardState.currentL, cardState.currentR);
        drawWaveform(cardState, online);

        const timerEl = cardState.element.querySelector('.timer');
        if (timerEl) {
            const min = Math.floor(state.timerSeconds / 60).toString().padStart(2, '0');
            const sec = (state.timerSeconds % 60).toString().padStart(2, '0');
            timerEl.textContent = `${min}:${sec}`;
        }
    });
    requestAnimationFrame(animate);
}

function renderVu(card, levelL, levelR) {
    updateChannel(card.querySelector('.vu-channel.left'), levelL);
    updateChannel(card.querySelector('.vu-channel.right'), levelR);
}

function updateChannel(channel, level) {
    const segments = channel.querySelectorAll('.vu-segment');
    const activeCount = Math.round(Math.max(0, Math.min(1, level)) * segments.length);
    segments.forEach((segment, index) => {
        const active = index < activeCount;
        segment.className = 'vu-segment';
        if (active) {
            segment.classList.add('active');
            segment.classList.add(index > 15 ? 'red' : index > 12 ? 'yellow' : 'green');
        }
    });
}

function drawWaveform(cardState, online) {
    const { canvas, ctx, currentL, currentR, phase } = cardState;
    const width = canvas.width;
    const height = canvas.height;
    const center = height / 2;
    const level = Math.max(currentL, currentR);
    ctx.clearRect(0, 0, width, height);
    if (!online) {
        ctx.strokeStyle = 'rgba(236, 101, 118, 0.5)';
        ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.moveTo(0, center); ctx.lineTo(width, center); ctx.stroke();
        ctx.setLineDash([]);
        return;
    }
    const bars = 100;
    const gap = 2;
    const barWidth = (width / bars) - gap;
    ctx.fillStyle = '#666';
    for (let i = 0; i < bars; i++) {
        const x = i * (barWidth + gap);
        const h = 5 + (level * height * 0.6) * (0.5 + 0.5 * Math.sin(i * 0.2 + phase + performance.now()/500));
        ctx.fillRect(x, center - h/2, barWidth, h);
    }
}

function approach(current, target, factor) {
    return current + (target - current) * factor;
}

function showToast(message, type = '') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    els.toastStack.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

function cssEscape(value) {
    return window.CSS?.escape ? CSS.escape(value) : String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function applyFilter() {
    const checked = Array.from(els.filterOptions.querySelectorAll('input:checked')).map(i => i.value);
    state.selectedIds = new Set(checked);
    els.filterMenu.hidden = true;
    renderCards();
    if (state.monitoring) { refreshStatus(); refreshMetadata(); }
}

function resetFilter() {
    state.selectedIds = new Set(state.streams.map(s => s.id));
    els.filterOptions.querySelectorAll('input').forEach(i => i.checked = true);
    updateFilterCount();
    els.filterMenu.hidden = true;
    renderCards();
    if (state.monitoring) { refreshStatus(); refreshMetadata(); }
}

function updateFilterCount() {
    const total = els.filterOptions.querySelectorAll('input').length;
    const checked = els.filterOptions.querySelectorAll('input:checked').length;
    els.filterCount.textContent = `${checked}/${total} selecionadas`;
}

function visibleStreams() {
    return state.streams.filter(s => state.selectedIds.has(s.id));
}
