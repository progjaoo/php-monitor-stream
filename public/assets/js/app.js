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
};

const els = {
    grid: document.querySelector('#stream-grid'),
    start: document.querySelector('#start-monitoring'),
    muteAll: document.querySelector('#mute-all'),
    reconnectAll: document.querySelector('#reconnect-all'),
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
    summaryTotal: document.querySelector('#summary-total'),
    summaryOnline: document.querySelector('#summary-online'),
    summaryOffline: document.querySelector('#summary-offline'),
    summaryUpdated: document.querySelector('#summary-updated'),
    toastStack: document.querySelector('#toast-stack'),
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
    bindToolbar();
    await loadStreams();
    renderFilterOptions();
    renderCards();
    requestAnimationFrame(animate);
}

function bindToolbar() {
    els.start.addEventListener('click', startMonitoring);
    els.muteAll.addEventListener('click', muteAll);
    els.reconnectAll.addEventListener('click', reconnectAll);
    els.filterToggle.addEventListener('click', () => {
        els.filterMenu.hidden = !els.filterMenu.hidden;
    });
    els.applyFilter.addEventListener('click', applyFilter);
    els.resetFilter.addEventListener('click', resetFilter);
    els.zoomReset.addEventListener('click', () => setZoom(1));
    els.zoomOut.addEventListener('click', () => setZoom(Math.max(0.7, state.zoom - 0.1)));
    els.zoomIn.addEventListener('click', () => setZoom(Math.min(1.4, state.zoom + 0.1)));

    document.querySelectorAll('.column-button').forEach((button) => {
        button.addEventListener('click', () => setColumns(Number(button.dataset.cols)));
    });

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
        updateSummary();
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

        card.querySelector('.reconnect').addEventListener('click', () => reconnectStream(stream.id));
        card.querySelector('.mute').addEventListener('click', () => toggleMute(stream.id));
        card.querySelector('.solo').addEventListener('click', () => soloStream(stream.id));
        card.querySelector('.volume-slider').addEventListener('input', (event) => setVolume(stream.id, Number(event.target.value)));
    });

    updateSummary();
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
                    <span class="status-dot" aria-hidden="true">●</span>
                    <h2 class="stream-title">${escapeHtml(stream.name)}</h2>
                    <span class="frequency">${escapeHtml(stream.frequency)}</span>
                </div>
                <div class="metadata">
                    <span class="note">♪</span>
                    <span class="song">${escapeHtml(stream.station)} - ${escapeHtml(city)}</span>
                </div>
                <canvas class="waveform" width="720" height="120"></canvas>
                <div class="card-footer">
                    <span class="status-text">Aguardando monitoramento</span>
                    <span class="latency">--:--</span>
                </div>
            </div>

            <div class="card-actions">
                <button class="wbtn success reconnect">Reconectar</button>
                <button class="wbtn danger mute">Mute</button>
                <button class="wbtn solo">Solo</button>
            </div>
        </article>
    `;
}

function renderSegments() {
    return Array.from({ length: 13 }, (_, index) => `<span class="vu-segment" data-index="${index}"></span>`).join('');
}

async function startMonitoring() {
    if (state.monitoring) {
        return;
    }

    state.monitoring = true;
    els.start.textContent = 'Monitoramento ativo';
    els.start.disabled = true;
    showToast('Monitoramento iniciado. Os medidores continuam ativos mesmo usando Solo.', 'online');

    await refreshStatus();
    await refreshMetadata();
    state.statusTimer = setInterval(refreshStatus, 5000);
    state.metadataTimer = setInterval(refreshMetadata, 30000);
}

async function refreshStatus(ids = visibleStreams().map((stream) => stream.id)) {
    if (state.refreshingStatus) {
        return;
    }

    if (ids.length === 0) {
        return;
    }

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

        updateSummary();
    } catch (error) {
        showToast('Falha ao consultar status dos streamings.', 'offline');
    } finally {
        state.refreshingStatus = false;
    }
}

async function refreshMetadata(ids = visibleStreams().map((stream) => stream.id)) {
    if (state.refreshingMetadata) {
        return;
    }

    if (ids.length === 0) {
        return;
    }

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
        showToast('Falha ao consultar metadata das radios.', 'offline');
    } finally {
        state.refreshingMetadata = false;
    }
}

function applyStatus(status) {
    const cardState = state.cards.get(status.id);
    if (!cardState) {
        return;
    }

    const { element } = cardState;
    const online = status.status === 'online';
    cardState.targetL = online ? Number(status.levelL || 0) : 0;
    cardState.targetR = online ? Number(status.levelR || 0) : 0;

    element.classList.toggle('online', online);
    element.classList.toggle('offline', !online);
    element.classList.remove('checking');

    const statusText = element.querySelector('.status-text');
    statusText.className = `status-text ${online ? 'online' : 'offline'}`;
    statusText.textContent = online
        ? `${status.audioState === 'silence' ? 'Online com nivel baixo' : 'Online'} - ${formatBytes(status.receivedBytes)}`
        : `Offline - ${status.detail || 'sem resposta'}`;

    element.querySelector('.latency').textContent = status.latencyMs ? `${status.latencyMs} ms` : '--:--';
}

function applyMetadata(item) {
    const card = state.cards.get(item.id)?.element;
    if (!card) {
        return;
    }

    const stream = state.streams.find((candidate) => candidate.id === item.id);
    const fallback = stream ? `${stream.station} - ${stream.city} / ${stream.state}` : 'Metadata indisponivel';
    const text = item.song || fallback;
    card.querySelector('.song').textContent = text;
}

function applyKnownStateToCards() {
    state.statuses.forEach(applyStatus);
    state.metadata.forEach(applyMetadata);
}

function notifyStatusChange(status, previous) {
    if (!previous || previous.status === status.status) {
        return;
    }

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
    if (state.players.has(id)) {
        return state.players.get(id);
    }

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
        updateSoloButtons();
        return;
    }

    state.soloId = id;
    const player = ensurePlayer(id);
    player.muted = false;
    state.muted.delete(id);
    try {
        await player.play();
        showToast(`Solo ativo: ${labelFor(id)}.`, 'online');
    } catch (error) {
        showToast(`Nao foi possivel reproduzir ${labelFor(id)}.`, 'offline');
    }

    updateSoloButtons();
    updateMuteButton(id);
}

function pauseAllPlayers() {
    state.players.forEach((player) => {
        player.pause();
    });
}

function toggleMute(id) {
    const player = ensurePlayer(id);
    const muted = !state.muted.has(id);
    player.muted = muted;

    if (muted) {
        state.muted.add(id);
    } else {
        state.muted.delete(id);
    }

    updateMuteButton(id);
}

function muteAll() {
    visibleStreams().forEach((stream) => {
        const player = ensurePlayer(stream.id);
        player.muted = true;
        state.muted.add(stream.id);
        updateMuteButton(stream.id);
    });
    showToast('Todos os players locais foram mutados.', 'offline');
}

async function reconnectStream(id) {
    const player = state.players.get(id);
    if (player) {
        player.pause();
        player.src = `api/audio.php?id=${encodeURIComponent(id)}&r=${Date.now()}`;
        player.load();
    }

    await fetch('api/reconnect.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
    }).catch(() => {});

    await refreshStatus([id]);
    showToast(`Reconexao local solicitada para ${labelFor(id)}.`, 'online');
}

function reconnectAll() {
    visibleStreams().forEach((stream) => reconnectStream(stream.id));
}

function setVolume(id, value) {
    const volume = Math.max(0, Math.min(1, value / 100));
    localStorage.setItem(`volume:${id}`, String(volume));
    const player = state.players.get(id);
    if (player) {
        player.volume = volume;
    }

    const card = state.cards.get(id)?.element;
    if (card) {
        card.querySelector('.volume-value').textContent = `${Math.round(volume * 100)}%`;
    }
}

function getVolume(id) {
    const stored = Number(localStorage.getItem(`volume:${id}`));
    return Number.isFinite(stored) ? stored : 1;
}

function updateMuteButton(id) {
    const button = state.cards.get(id)?.element.querySelector('.mute');
    if (button) {
        button.textContent = state.muted.has(id) ? 'Unmute' : 'Mute';
    }
}

function updateSoloButtons() {
    state.cards.forEach(({ element }, id) => {
        const button = element.querySelector('.solo');
        button.classList.toggle('active', state.soloId === id);
        button.textContent = state.soloId === id ? 'Sair Solo' : 'Solo';
    });
}

function applyFilter() {
    const checked = Array.from(els.filterOptions.querySelectorAll('input:checked')).map((input) => input.value);
    state.selectedIds = new Set(checked);
    els.filterMenu.hidden = true;
    renderCards();
    if (state.monitoring) {
        refreshStatus();
        refreshMetadata();
    }
}

function resetFilter() {
    state.selectedIds = new Set(state.streams.map((stream) => stream.id));
    els.filterOptions.querySelectorAll('input').forEach((input) => {
        input.checked = true;
    });
    updateFilterCount();
    els.filterMenu.hidden = true;
    renderCards();
    if (state.monitoring) {
        refreshStatus();
        refreshMetadata();
    }
}

function updateFilterCount() {
    const total = els.filterOptions.querySelectorAll('input').length;
    const checked = els.filterOptions.querySelectorAll('input:checked').length;
    els.filterCount.textContent = `${checked}/${total} selecionadas`;
}

function visibleStreams() {
    return state.streams.filter((stream) => state.selectedIds.has(stream.id));
}

function setColumns(columns) {
    state.columns = columns;
    els.grid.className = `stream-grid cols-${columns}`;
    document.querySelectorAll('.column-button').forEach((button) => {
        button.classList.toggle('active', Number(button.dataset.cols) === columns);
    });
}

function setZoom(value) {
    state.zoom = Number(value.toFixed(2));
    document.documentElement.style.setProperty('--zoom', state.zoom);
    els.zoomReset.textContent = `${Math.round(state.zoom * 100)}%`;
}

function updateSummary() {
    const visible = visibleStreams();
    const online = visible.filter((stream) => state.statuses.get(stream.id)?.status === 'online').length;
    const offline = visible.filter((stream) => state.statuses.get(stream.id)?.status === 'offline').length;
    const last = Array.from(state.statuses.values())
        .filter((status) => state.selectedIds.has(status.id))
        .map((status) => status.checkedAt)
        .sort()
        .pop();

    els.summaryTotal.textContent = String(visible.length);
    els.summaryOnline.textContent = String(online);
    els.summaryOffline.textContent = String(offline);
    els.summaryUpdated.textContent = last ? new Date(last).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
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
    });

    requestAnimationFrame(animate);
}

function renderVu(card, levelL, levelR) {
    updateChannel(card.querySelector('.vu-channel.left'), levelL);
    updateChannel(card.querySelector('.vu-channel.right'), levelR);
}

function updateChannel(channel, level) {
    const activeCount = Math.round(Math.max(0, Math.min(1, level)) * 13);
    channel.querySelectorAll('.vu-segment').forEach((segment, index) => {
        const active = index < activeCount;
        segment.className = 'vu-segment';
        if (active) {
            segment.classList.add('active');
            segment.classList.add(index > 10 ? 'red' : index > 8 ? 'yellow' : 'green');
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
    ctx.strokeStyle = online ? 'rgba(255, 255, 255, 0.13)' : 'rgba(236, 101, 118, 0.42)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, center);
    ctx.lineTo(width, center);
    ctx.stroke();

    if (!online) {
        ctx.setLineDash([7, 7]);
        ctx.strokeStyle = 'rgba(236, 101, 118, 0.7)';
        ctx.beginPath();
        ctx.moveTo(0, center);
        ctx.lineTo(width, center);
        ctx.stroke();
        ctx.setLineDash([]);
        return;
    }

    const bars = 92;
    const gap = 4;
    const barWidth = Math.max(2, width / bars - gap);
    ctx.fillStyle = 'rgba(210, 214, 222, 0.32)';

    for (let index = 0; index < bars; index += 1) {
        const x = index * (barWidth + gap);
        const envelope = Math.sin(index * 0.23 + phase + performance.now() / 380) * 0.5 + 0.5;
        const pulse = Math.sin(index * 0.61 + performance.now() / 170) * 0.5 + 0.5;
        const barLevel = Math.max(0.05, Math.min(1, level * 0.92 + envelope * 0.18 + pulse * 0.13));
        const barHeight = Math.max(4, barLevel * height * 0.72);
        ctx.fillRect(x, center - barHeight / 2, barWidth, barHeight);
    }
}

function approach(current, target, factor) {
    return current + (target - current) * factor;
}

function labelFor(id) {
    const stream = state.streams.find((item) => item.id === id);
    return stream ? `${stream.name} - ${stream.city}` : id;
}

function showToast(message, type = '') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    els.toastStack.appendChild(toast);
    setTimeout(() => toast.remove(), 5200);
}

function formatBytes(bytes) {
    if (!bytes) {
        return '0 B';
    }
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    return `${Math.round(bytes / 1024)} KB`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function cssEscape(value) {
    if (window.CSS?.escape) {
        return CSS.escape(value);
    }
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}
