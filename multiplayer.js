(() => {
    if (window.createMultiplayerManager) {
        return;
    }

    const STYLE_ID = 'albix-mp-style';

    function ensureStyles() {
        if (document.getElementById(STYLE_ID)) {
            return;
        }
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
.mp-btn{position:fixed;top:20px;left:20px;padding:10px 16px;border:none;border-radius:999px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;font-weight:600;cursor:pointer;z-index:2000;box-shadow:0 10px 25px rgba(102,126,234,0.35);}
.mp-btn:hover{opacity:0.92;}
.mp-panel{position:fixed;top:80px;left:20px;width:300px;max-width:90vw;background:rgba(17,17,26,0.95);color:#fff;border-radius:16px;padding:16px;border:1px solid rgba(255,255,255,0.12);display:none;z-index:2000;font-size:14px;line-height:1.4;}
body.light-theme .mp-panel{background:#ffffff;color:#222;border-color:rgba(0,0,0,0.12);}
.mp-panel h2{margin:0 0 10px;font-size:18px;}
.mp-status{margin:0 0 12px;font-size:13px;opacity:0.75;}
.mp-actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;}
.mp-btn-small{flex:1 1 45%;padding:8px;border-radius:10px;border:none;font-weight:600;cursor:pointer;background:rgba(255,255,255,0.12);color:inherit;}
body.light-theme .mp-btn-small{background:rgba(0,0,0,0.08);}
.mp-btn-small.primary{background:linear-gradient(135deg,#764ba2,#667eea);color:#fff;}
.mp-btn-small.danger{background:#b33939;color:#fff;}
.mp-form{display:flex;flex-direction:column;gap:8px;margin-bottom:12px;}
.mp-form input{padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:rgba(0,0,0,0.25);color:inherit;font-size:14px;}
body.light-theme .mp-form input{background:rgba(0,0,0,0.05);border-color:rgba(0,0,0,0.15);}
.mp-form button{padding:8px;border-radius:8px;border:none;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;font-weight:600;cursor:pointer;}
.mp-session{border-top:1px solid rgba(255,255,255,0.15);padding-top:10px;font-size:13px;display:flex;flex-direction:column;gap:8px;}
body.light-theme .mp-session{border-color:rgba(0,0,0,0.1);}
.mp-session.hidden{display:none;}
.mp-session-row{display:flex;gap:6px;align-items:center;}
.mp-session-link{flex:1;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:rgba(0,0,0,0.25);color:inherit;padding:6px 8px;}
body.light-theme .mp-session-link{background:rgba(0,0,0,0.05);border-color:rgba(0,0,0,0.12);}
.mp-copy-link{padding:6px 10px;border-radius:8px;border:none;background:#4444dd;color:#fff;cursor:pointer;font-weight:600;}
.mp-board{position:fixed;top:20px;right:20px;width:220px;max-width:80vw;background:rgba(16,16,26,0.92);color:#fff;border-radius:16px;padding:14px;border:1px solid rgba(255,255,255,0.12);z-index:1900;font-size:13px;backdrop-filter:blur(10px);}
body.light-theme .mp-board{background:rgba(255,255,255,0.95);color:#222;border-color:rgba(0,0,0,0.08);}
.mp-board-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-weight:600;}
.mp-connection{font-size:11px;text-transform:uppercase;letter-spacing:0.6px;opacity:0.75;}
.mp-connection.online{color:#2ed573;opacity:1;}
.mp-connection.host{color:#f1c40f;opacity:1;}
.mp-board-label{font-size:12px;opacity:0.75;margin-bottom:6px;}
.mp-board-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;}
.mp-player{display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border-radius:10px;background:rgba(255,255,255,0.1);}
body.light-theme .mp-player{background:rgba(0,0,0,0.06);}
.mp-player.me{background:rgba(102,126,234,0.4);}
body.light-theme .mp-player.me{background:rgba(102,126,234,0.25);}
.mp-hidden{display:none !important;}
@media (max-width:640px){
    .mp-btn{bottom:20px;top:auto;}
    .mp-panel{top:auto;bottom:80px;}
    .mp-board{top:auto;bottom:20px;}
}
`;
        document.head.appendChild(style);
    }

    function randomCode(length = 5) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        while (result.length < length) {
            result += chars[Math.floor(Math.random() * chars.length)];
        }
        return result;
    }

    function cleanName(value) {
        const trimmed = (value || '').trim();
        return trimmed ? trimmed.slice(0, 18) : 'Player';
    }

    function formatScore(value) {
        return typeof value === 'number' && !Number.isNaN(value) ? value.toLocaleString() : '0';
    }

    class MultiplayerManager {
        constructor(config = {}) {
            ensureStyles();
            this.gameId = config.gameId || 'albix-game';
            this.scoreLabel = config.scoreLabel || 'Score';
            this.score = typeof config.initialScore === 'number' ? config.initialScore : 0;
            this.players = new Map();
            this.connections = new Map();
            this.peer = null;
            this.primaryConnection = null;
            this.sessionId = null;
            this.localPlayerId = null;
            this.nickname = '';
            this.isHost = false;
            this.connecting = false;
            this.listeners = new Map();
            this.buildUI();
            this.bindEvents();
            this.updateScore(this.score);
            this.readUrl();
        }

        buildUI() {
            this.toggleButton = document.createElement('button');
            this.toggleButton.type = 'button';
            this.toggleButton.className = 'mp-btn';
            this.toggleButton.textContent = 'Multiplayer';
            document.body.appendChild(this.toggleButton);

            this.panel = document.createElement('div');
            this.panel.className = 'mp-panel';
            this.panel.innerHTML = `
                <h2>Multiplayer</h2>
                <p class="mp-status">Sessione non attiva.</p>
                <div class="mp-actions">
                    <button type="button" class="mp-btn-small primary mp-open-host">Crea sessione</button>
                    <button type="button" class="mp-btn-small mp-open-join">Unisciti</button>
                    <button type="button" class="mp-btn-small danger mp-leave mp-hidden">Esci</button>
                </div>
                <form class="mp-form mp-form-host mp-hidden">
                    <label>Nickname</label>
                    <input type="text" name="nickname" maxlength="24" placeholder="Il tuo nickname" required>
                    <button type="submit">Avvia</button>
                </form>
                <form class="mp-form mp-form-join mp-hidden">
                    <label>Codice sessione</label>
                    <input type="text" name="code" maxlength="32" placeholder="Es. TETRIS-AB123" required>
                    <label>Nickname</label>
                    <input type="text" name="nickname" maxlength="24" placeholder="Il tuo nickname" required>
                    <button type="submit">Entra</button>
                </form>
                <div class="mp-session mp-hidden">
                    <div class="mp-session-row">Codice: <span class="mp-session-code"></span></div>
                    <div class="mp-session-row">
                        <input type="text" class="mp-session-link" readonly>
                        <button type="button" class="mp-copy-link">Copia</button>
                    </div>
                </div>
            `;
            document.body.appendChild(this.panel);

            this.board = document.createElement('div');
            this.board.className = 'mp-board';
            this.board.innerHTML = `
                <div class="mp-board-header">
                    <span>Leaderboard</span>
                    <span class="mp-connection">Offline</span>
                </div>
                <div class="mp-board-label"></div>
                <ul class="mp-board-list"></ul>
            `;
            document.body.appendChild(this.board);

            this.statusLabel = this.panel.querySelector('.mp-status');
            this.hostButton = this.panel.querySelector('.mp-open-host');
            this.joinButton = this.panel.querySelector('.mp-open-join');
            this.leaveButton = this.panel.querySelector('.mp-leave');
            this.hostForm = this.panel.querySelector('.mp-form-host');
            this.joinForm = this.panel.querySelector('.mp-form-join');
            this.sessionBox = this.panel.querySelector('.mp-session');
            this.sessionCodeEl = this.panel.querySelector('.mp-session-code');
            this.sessionLinkInput = this.panel.querySelector('.mp-session-link');
            this.copyButton = this.panel.querySelector('.mp-copy-link');
            this.connectionLabel = this.board.querySelector('.mp-connection');
            this.boardLabel = this.board.querySelector('.mp-board-label');
            this.playerList = this.board.querySelector('.mp-board-list');

            this.boardLabel.textContent = this.scoreLabel;
        }

        bindEvents() {
            this.toggleButton.addEventListener('click', () => this.togglePanel());
            this.hostButton.addEventListener('click', () => this.showHostForm());
            this.joinButton.addEventListener('click', () => this.showJoinForm());
            this.leaveButton.addEventListener('click', () => this.disconnect());
            this.copyButton.addEventListener('click', () => this.copyLink());

            this.hostForm.addEventListener('submit', (event) => {
                event.preventDefault();
                if (this.connecting) return;
                const nickname = cleanName(event.target.nickname.value);
                if (!nickname) {
                    event.target.nickname.focus();
                    return;
                }
                this.startHosting(nickname);
            });

            this.joinForm.addEventListener('submit', (event) => {
                event.preventDefault();
                if (this.connecting) return;
                const code = (event.target.code.value || '').trim();
                const nickname = cleanName(event.target.nickname.value);
                if (!code) {
                    event.target.code.focus();
                    return;
                }
                this.joinSession(code, nickname);
            });
        }

        togglePanel(forceOpen = null) {
            const shouldOpen = forceOpen !== null ? forceOpen : this.panel.style.display !== 'block';
            this.panel.style.display = shouldOpen ? 'block' : 'none';
        }

        showHostForm() {
            this.togglePanel(true);
            this.hostForm.classList.remove('mp-hidden');
            this.joinForm.classList.add('mp-hidden');
            this.sessionBox.classList.toggle('mp-hidden', !this.isHost || !this.sessionId);
            this.hostForm.nickname.value = this.nickname;
            this.hostForm.nickname.focus();
        }

        showJoinForm(prefill = '') {
            this.togglePanel(true);
            this.joinForm.classList.remove('mp-hidden');
            this.hostForm.classList.add('mp-hidden');
            this.sessionBox.classList.add('mp-hidden');
            this.joinForm.code.value = prefill || '';
            this.joinForm.nickname.value = this.nickname;
            this.joinForm.code.focus();
        }

        ensurePeer() {
            if (window.Peer) return true;
            this.setStatus('PeerJS non disponibile. Controlla la connessione.');
            return false;
        }

        generateSessionId() {
            const base = (this.gameId || 'ALBIX').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'ALBIX';
            return base + '-' + randomCode(5);
        }

        startHosting(nickname) {
            if (!this.ensurePeer()) return;
            this.disconnect();
            this.connecting = true;
            this.isHost = true;
            this.nickname = nickname;
            this.sessionId = this.generateSessionId();
            this.peer = new Peer(this.sessionId, { debug: 0 });
            this.leaveButton.classList.remove('mp-hidden');
            this.registerPeerEvents();
            this.setConnectionState('host');
            this.setStatus('Creazione sessione...');
        }

        joinSession(code, nickname) {
            if (!this.ensurePeer()) return;
            this.disconnect();
            this.connecting = true;
            this.isHost = false;
            this.nickname = nickname;
            this.sessionId = code;
            this.peer = new Peer(null, { debug: 0 });
            this.leaveButton.classList.remove('mp-hidden');
            this.registerPeerEvents();
            this.setConnectionState('offline');
            this.setStatus('Connessione in corso...');
        }

        registerPeerEvents() {
            if (!this.peer) return;

            this.peer.on('open', (id) => {
                this.localPlayerId = id;
                this.connecting = false;
                this.addOrUpdatePlayer(id, this.nickname || 'Player', this.score);
                if (this.isHost) {
                    this.setStatus('Sessione pronta.');
                    this.setConnectionState('host');
                    this.showSessionDetails();
                } else {
                    this.openConnectionToHost();
                }
                this.renderPlayers();
                this.emit('localReady', { id });
            });

            this.peer.on('connection', (conn) => {
                if (!this.isHost) {
                    conn.close();
                    return;
                }
                this.handleHostConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.error('[Multiplayer] peer error', err);
                this.setStatus('Errore di connessione.');
                this.setConnectionState('offline');
            });

            this.peer.on('close', () => {
                this.setStatus('Sessione chiusa.');
                this.setConnectionState('offline');
                this.reset();
            });
        }

        openConnectionToHost() {
            if (!this.peer || !this.sessionId) return;
            const connection = this.peer.connect(this.sessionId, { reliable: true });
            this.primaryConnection = connection;

            connection.on('open', () => {
                this.setConnectionState('online');
                this.setStatus('Connesso alla sessione.');
                this.send(connection, {
                    type: 'join',
                    payload: {
                        id: this.localPlayerId,
                        nickname: this.nickname,
                        score: this.score,
                    },
                });
            });

            connection.on('data', (data) => this.handleMessage(connection, data));

            const handleClose = () => {
                this.setStatus('Disconnesso dalla sessione.');
                this.setConnectionState('offline');
                this.players.clear();
                this.renderPlayers();
            };

            connection.on('close', handleClose);
            connection.on('error', handleClose);
        }

        handleHostConnection(conn) {
            this.connections.set(conn.peer, conn);
            conn.on('data', (data) => this.handleMessage(conn, data));

            const cleanup = () => {
                this.connections.delete(conn.peer);
                this.players.delete(conn.peer);
                this.broadcast({ type: 'playerLeft', payload: { id: conn.peer } });
                this.renderPlayers();
                this.emit('playerLeft', { id: conn.peer });
            };

            conn.on('close', cleanup);
            conn.on('error', cleanup);
        }

        handleMessage(conn, data) {
            if (!data || typeof data !== 'object') return;
            const { type, payload } = data;
            const senderId = conn && conn.peer ? conn.peer : null;
            let handled = true;

            switch (type) {
                case 'join':
                    if (this.isHost && payload) {
                        this.addOrUpdatePlayer(payload.id, payload.nickname, payload.score);
                        this.send(conn, {
                            type: 'sessionState',
                            payload: {
                                sessionId: this.sessionId,
                                players: this.serializePlayers(),
                                scoreLabel: this.scoreLabel,
                            },
                        });
                        this.broadcast({ type: 'playerJoined', payload }, payload.id);
                        this.renderPlayers();
                        this.emit('playerJoined', payload);
                    }
                    break;
                case 'sessionState':
                    if (!this.isHost && payload) {
                        this.applySession(payload);
                        this.setConnectionState('online');
                        this.setStatus('Sessione sincronizzata.');
                        if (payload.scoreLabel) {
                            this.boardLabel.textContent = payload.scoreLabel;
                        }
                        this.emit('sessionState', payload);
                    }
                    break;
                case 'playerJoined':
                    if (payload) {
                        this.addOrUpdatePlayer(payload.id, payload.nickname, payload.score);
                        this.renderPlayers();
                        this.emit('playerJoined', payload);
                    }
                    break;
                case 'playerLeft':
                    if (payload && payload.id) {
                        this.players.delete(payload.id);
                        this.renderPlayers();
                        this.emit('playerLeft', payload);
                    }
                    break;
                case 'scoreUpdate':
                    if (payload && payload.id) {
                        this.addOrUpdatePlayer(payload.id, payload.nickname, payload.score);
                        if (this.isHost) {
                            this.broadcast({ type: 'scoreUpdate', payload }, payload.id);
                        }
                        this.renderPlayers();
                        this.emit('scoreUpdate', payload);
                    }
                    break;
                case 'hostClosing':
                    this.setStatus('L\'host ha chiuso la sessione.');
                    this.disconnect();
                    this.emit('hostClosing', payload || {});
                    break;
                default:
                    handled = false;
                    break;
            }

            if (!handled) {
                this.emit('message', { type, payload, senderId });
            }
        }

        addOrUpdatePlayer(id, nickname, score) {
            const safeName = cleanName(nickname);
            const safeScore = typeof score === 'number' && !Number.isNaN(score) ? score : 0;
            this.players.set(id, { nickname: safeName, score: safeScore });
        }

        serializePlayers() {
            const entries = Array.from(this.players.entries()).map(([id, info]) => ({
                id,
                nickname: info.nickname,
                score: info.score,
            }));
            if (this.localPlayerId && !entries.some((item) => item.id === this.localPlayerId)) {
                entries.push({ id: this.localPlayerId, nickname: this.nickname || 'Player', score: this.score || 0 });
            }
            return entries;
        }

        renderPlayers() {
            this.playerList.innerHTML = '';
            const entries = this.serializePlayers();
            if (entries.length === 0) {
                const item = document.createElement('li');
                item.className = 'mp-player';
                item.textContent = 'Nessun giocatore connesso.';
                this.playerList.appendChild(item);
                this.emit('playersChanged', entries);
                return;
            }
            entries.sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname));
            entries.forEach((player, index) => {
                const item = document.createElement('li');
                item.className = 'mp-player';
                if (player.id === this.localPlayerId) {
                    item.classList.add('me');
                }
                const name = document.createElement('span');
                name.textContent = (index + 1) + '. ' + player.nickname;
                const score = document.createElement('span');
                score.textContent = formatScore(player.score);
                item.appendChild(name);
                item.appendChild(score);
                this.playerList.appendChild(item);
            });
            this.emit('playersChanged', entries);
        }

        on(eventName, handler) {
            if (typeof handler !== 'function') {
                return () => {};
            }
            if (!this.listeners.has(eventName)) {
                this.listeners.set(eventName, new Set());
            }
            const bucket = this.listeners.get(eventName);
            bucket.add(handler);
            return () => {
                bucket.delete(handler);
                if (bucket.size === 0) {
                    this.listeners.delete(eventName);
                }
            };
        }

        emit(eventName, detail) {
            const bucket = this.listeners.get(eventName);
            if (!bucket || bucket.size === 0) {
                return;
            }
            bucket.forEach((listener) => {
                try {
                    listener(detail);
                } catch (error) {
                    console.error('[Multiplayer] listener error', error);
                }
            });
        }

        getLocalPlayerId() {
            return this.localPlayerId;
        }

        getPlayers() {
            return this.serializePlayers();
        }

        isConnected() {
            if (this.isHost) {
                return this.connections.size > 0;
            }
            return !!(this.primaryConnection && this.primaryConnection.open);
        }

        sendMessage(type, payload = {}, options = {}) {
            const message = { type, payload };
            if (this.isHost) {
                if (options.target && this.connections.has(options.target)) {
                    this.send(this.connections.get(options.target), message);
                } else {
                    this.broadcast(message, options.excludeId);
                }
            } else if (this.primaryConnection) {
                this.send(this.primaryConnection, message);
            }
        }

        broadcast(message, excludeId = null) {
            this.connections.forEach((connection, peerId) => {
                if (excludeId && peerId === excludeId) return;
                this.send(connection, message);
            });
        }

        send(connection, message) {
            if (!connection || connection.open === false) return;
            try {
                connection.send(message);
            } catch (error) {
                console.error('[Multiplayer] send error', error);
            }
        }

        updateScore(score) {
            const safeScore = typeof score === 'number' && !Number.isNaN(score) ? score : 0;
            this.score = safeScore;
            if (this.localPlayerId) {
                this.addOrUpdatePlayer(this.localPlayerId, this.nickname || 'Player', safeScore);
            }
            this.renderPlayers();
            const updateMessage = {
                type: 'scoreUpdate',
                payload: {
                    id: this.localPlayerId,
                    nickname: this.nickname,
                    score: safeScore,
                },
            };
            if (this.isHost) {
                this.broadcast(updateMessage, this.localPlayerId);
            } else if (this.primaryConnection) {
                this.send(this.primaryConnection, updateMessage);
            }
        }

        applySession(payload) {
            this.sessionId = payload.sessionId || this.sessionId;
            this.players.clear();
            (payload.players || []).forEach((player) => {
                this.players.set(player.id, {
                    nickname: cleanName(player.nickname),
                    score: typeof player.score === 'number' ? player.score : 0,
                });
            });
            this.renderPlayers();
        }

        showSessionDetails() {
            if (!this.sessionId) return;
            this.sessionBox.classList.remove('mp-hidden');
            this.sessionCodeEl.textContent = this.sessionId;
            this.sessionLinkInput.value = this.buildShareLink();
        }

        buildShareLink() {
            const url = new URL(window.location.href);
            url.searchParams.set('session', this.sessionId);
            return url.toString();
        }

        async copyLink() {
            if (!this.sessionId) return;
            const value = this.sessionLinkInput.value;
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(value);
                } else {
                    this.sessionLinkInput.select();
                    document.execCommand('copy');
                }
                this.setStatus('Link copiato negli appunti.');
            } catch (error) {
                this.setStatus('Copia non riuscita, copia manualmente.');
            }
        }

        setStatus(message) {
            this.statusLabel.textContent = message;
        }

        setConnectionState(state) {
            this.connectionLabel.classList.remove('online', 'host');
            if (state === 'online') {
                this.connectionLabel.textContent = 'Online';
                this.connectionLabel.classList.add('online');
            } else if (state === 'host') {
                this.connectionLabel.textContent = 'Hosting';
                this.connectionLabel.classList.add('host');
            } else {
                this.connectionLabel.textContent = 'Offline';
            }
            this.emit('connectionState', state);
        }

        readUrl() {
            const params = new URLSearchParams(window.location.search);
            const session = params.get('session');
            if (session) {
                this.showJoinForm(session);
            }
        }

        reset() {
            this.players.clear();
            this.sessionId = null;
            this.localPlayerId = null;
            this.peer = null;
            this.primaryConnection = null;
            this.connections.clear();
            this.isHost = false;
            this.connecting = false;
            this.leaveButton.classList.add('mp-hidden');
            this.sessionBox.classList.add('mp-hidden');
            this.renderPlayers();
        }

        disconnect() {
            if (this.isHost && this.connections.size) {
                this.broadcast({ type: 'hostClosing' });
            }
            this.connections.forEach((conn) => {
                try { conn.close(); } catch (_) {}
            });
            this.connections.clear();
            if (this.primaryConnection) {
                try { this.primaryConnection.close(); } catch (_) {}
                this.primaryConnection = null;
            }
            if (this.peer) {
                try { this.peer.destroy(); } catch (_) {}
                this.peer = null;
            }
            this.setStatus('Connessione terminata.');
            this.setConnectionState('offline');
            this.reset();
        }
    }

    window.createMultiplayerManager = (config) => new MultiplayerManager(config || {});
})();
