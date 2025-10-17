(() => {
    const MAX_PLAYERS = 5;
    const COLORS = ['rosso', 'giallo', 'verde', 'blu']; // for messaging only
    const COLOR_CODES = ['red', 'yellow', 'green', 'blue'];
    const NUMBER_VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const ACTION_VALUES = ['skip', 'reverse', 'draw2'];
    const WILD_VALUES = ['wild', 'wild4'];

    const TEXT = {
        waitingPlayers: 'In attesa di giocatori...',
        waitingStart: "In attesa che l'host avvii la partita...",
        needPlayers: 'Servono almeno due giocatori per iniziare.',
        yourTurn: 'È il tuo turno!',
        opponentTurn: (name) => `Turno di ${name}...`,
        chooseColor: 'Scegli un colore per la carta jolly.',
        notYourTurn: 'Non è il tuo turno.',
        invalidCard: 'Non puoi giocare questa carta.',
        drawTaken: (name) => `${name} pesca una carta.`,
        deckEmpty: 'Mazzo esaurito, rimescolo...',
        youWon: 'Hai vinto il round!',
        playerWon: (name) => `${name} ha vinto il round!`,
        colorChanged: (color) => `Colore impostato su ${color}.`,
        drawHint: 'Clicca sul mazzo per pescare.',
        removed: 'Sei stato rimosso dalla sessione.',
        opponentsLabel: (count) => `Avversari: ${count}`,
        handLabel: (count) => `Le tue carte: ${count}`,
        gameReady: 'Partita avviata!',
        roundEnded: 'Round concluso. Avvia una nuova partita.',
    };

    const elements = {};
    const client = {
        localId: null,
        isHost: false,
        state: createEmptySnapshot(),
        hands: {},
        statusMessage: null,
    };
    const hostState = {
        players: [],
        deck: [],
        discard: [],
        direction: 1,
        currentPlayerIndex: 0,
        awaitingColor: false,
        pendingWildPlayerId: null,
        pendingWildValue: null,
        started: false,
        winnerId: null,
        nextStartIndex: 0,
    };

    let manager = null;
    let colorPickerVisible = false;

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        cacheElements();
        hideUnusedControls();
        attachUIEvents();
        setupMultiplayer();
        render();
    }

    function cacheElements() {
        elements.playerHand = document.getElementById('player-hand');
        elements.opponentList = document.getElementById('ai-hand');
        elements.status = document.getElementById('status-display');
        elements.drawPile = document.getElementById('draw-pile');
        elements.discardPile = document.getElementById('discard-pile');
        elements.playerCount = document.getElementById('player-card-count');
        elements.opponentCount = document.getElementById('ai-card-count');
        elements.newGameBtn = document.getElementById('new-game-btn');
        elements.langBtn = document.getElementById('lang-toggle-btn');
        elements.themeBtn = document.getElementById('theme-toggle-btn');
        elements.difficultySelect = document.getElementById('difficulty-select');
        elements.difficultyDisplay = document.getElementById('difficulty-display');
        elements.colorPicker = document.getElementById('color-picker-modal');
        elements.colorButtons = Array.from(document.querySelectorAll('.color-btn'));
        elements.colorTitle = document.getElementById('color-picker-title');
    }

    function hideUnusedControls() {
        if (elements.langBtn) elements.langBtn.style.display = 'none';
        if (elements.themeBtn) elements.themeBtn.style.display = 'none';
        if (elements.difficultySelect) elements.difficultySelect.style.display = 'none';
        if (elements.difficultyDisplay) elements.difficultyDisplay.style.display = 'none';
    }

    function attachUIEvents() {
        if (elements.newGameBtn) {
            elements.newGameBtn.addEventListener('click', () => {
                if (!client.isHost) return;
                startRound();
            });
        }
        if (elements.drawPile) {
            elements.drawPile.addEventListener('click', () => {
                if (!client.state.started) return;
                if (!isLocalTurn() && !client.isHost) {
                    client.statusMessage = TEXT.notYourTurn;
                    render();
                    return;
                }
                if (client.state.awaitingColor && client.state.pendingWildPlayerId === client.localId) {
                    showColorPicker();
                    return;
                }
                if (client.isHost) {
                    hostDrawCard(client.localId);
                } else {
                    sendAction('draw');
                }
            });
        }
        elements.colorButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const color = button.dataset.color;
                if (!color) return;
                hideColorPicker();
                if (client.isHost) {
                    hostResolveWild(client.localId, color);
                } else {
                    sendAction('chooseColor', { color });
                }
            });
        });
    }

    function setupMultiplayer() {
        manager = window.createMultiplayerManager({
            gameId: 'uno',
            scoreLabel: 'Vittorie',
            maxPlayers: MAX_PLAYERS,
        });

        manager.on('localReady', ({ id }) => {
            client.localId = id;
            client.isHost = !!manager.isHost;
            if (client.isHost) {
                ensureHostPlayer(id, clientNickname());
                syncHostPlayers(manager.getPlayers());
            }
            render();
        });

        manager.on('connectionState', () => {
            client.isHost = !!manager.isHost;
            render();
        });

        manager.on('playersChanged', (players) => {
            if (client.isHost) {
                syncHostPlayers(players || []);
                broadcastState();
            } else {
                client.state.players = mapPlayers(players || []);
                render();
            }
        });

        manager.on('playerJoined', (player) => {
            if (!client.isHost) return;
            ensureHostPlayer(player.id, player.nickname);
            broadcastState();
        });

        manager.on('playerLeft', ({ id }) => {
            if (client.isHost) {
                removeHostPlayer(id);
                broadcastState();
            } else {
                client.state.players = (client.state.players || []).filter((p) => p.id !== id);
                render();
            }
        });

        manager.on('kicked', () => {
            client.statusMessage = TEXT.removed;
            render();
        });

        manager.on('message', (message) => {
            if (!message) return;
            if (client.isHost) {
                handleHostMessage(message);
                return;
            }
            if (message.type === 'uno:state') {
                applyClientState(message.payload || {});
            } else if (message.type === 'uno:error' && message.payload) {
                client.statusMessage = message.payload.message || TEXT.invalidCard;
                render();
            }
        });
    }

    function createEmptySnapshot() {
        return {
            started: false,
            players: [],
            deckCount: 0,
            discardTop: null,
            currentPlayerId: null,
            currentColor: null,
            currentValue: null,
            awaitingColor: false,
            pendingWildPlayerId: null,
            winnerId: null,
        };
    }

    function startRound() {
        if (!client.isHost) return;
        if (hostState.players.length < 2) {
            client.statusMessage = TEXT.needPlayers;
            render();
            return;
        }
        hostState.deck = createDeck();
        shuffle(hostState.deck);
        hostState.discard = [];
        hostState.direction = 1;
        hostState.awaitingColor = false;
        hostState.pendingWildPlayerId = null;
        hostState.pendingWildValue = null;
        hostState.winnerId = null;
        hostState.started = true;

        hostState.players.forEach((player) => {
            player.hand = [];
        });

        for (let i = 0; i < 7; i += 1) {
            hostState.players.forEach((player) => {
                const card = drawCardFromDeck();
                if (card) player.hand.push(card);
            });
        }

        let firstCard = null;
        do {
            firstCard = drawCardFromDeck();
        } while (firstCard && firstCard.color === 'wild');
        if (!firstCard) firstCard = { color: 'red', value: '0' };
        hostState.discard.push(firstCard);
        hostState.currentPlayerIndex = hostState.nextStartIndex % hostState.players.length;
        hostState.currentPlayerIndex = clampIndex(hostState.currentPlayerIndex);
        hostState.nextStartIndex = (hostState.currentPlayerIndex + 1) % hostState.players.length;

        hostState.currentColor = firstCard.color;
        hostState.currentValue = firstCard.value;
        broadcastState();
    }

    function ensureHostPlayer(id, nickname) {
        let record = hostState.players.find((p) => p.id === id);
        if (!record) {
            record = { id, nickname: nickname || 'Giocatore', hand: [], wins: 0 };
            hostState.players.push(record);
        } else {
            record.nickname = nickname || record.nickname;
        }
        return record;
    }

    function syncHostPlayers(players) {
        const seen = new Set();
        (players || []).forEach((entry) => {
            const record = ensureHostPlayer(entry.id, entry.nickname);
            record.wins = typeof entry.score === 'number' ? entry.score : record.wins || 0;
            seen.add(entry.id);
        });
        hostState.players = hostState.players.filter((player) => seen.has(player.id));
        if (hostState.currentPlayerIndex >= hostState.players.length) {
            hostState.currentPlayerIndex = clampIndex(hostState.currentPlayerIndex);
        }
    }

    function removeHostPlayer(id) {
        const idx = hostState.players.findIndex((player) => player.id === id);
        if (idx === -1) return;
        hostState.players.splice(idx, 1);
        if (hostState.players.length < 2) {
            hostState.started = false;
            hostState.winnerId = null;
        }
        hostState.currentPlayerIndex = clampIndex(hostState.currentPlayerIndex);
    }

    function handleHostMessage(message) {
        const { type, payload, senderId } = message;
        if (type === 'uno:action') {
            hostHandleAction(senderId, payload || {});
        } else if (type === 'uno:requestStart') {
            if (!hostState.started) startRound();
        } else if (type === 'uno:state') {
            applyClientState(payload || {});
        }
    }

    function hostHandleAction(playerId, action) {
        if (!client.isHost || !action || !action.type) return;
        switch (action.type) {
            case 'draw':
                hostDrawCard(playerId);
                break;
            case 'play':
                hostPlayCard(playerId, action.card);
                break;
            case 'chooseColor':
                hostResolveWild(playerId, action.color);
                break;
            default:
                break;
        }
    }

    function hostDrawCard(playerId) {
        if (!client.isHost || !hostState.started) return;
        if (!isHostTurn(playerId)) return sendError(playerId, TEXT.notYourTurn);
        const player = getHostPlayer(playerId);
        if (!player) return;
        const card = drawCardFromDeck();
        if (!card) {
            client.statusMessage = TEXT.deckEmpty;
            broadcastState();
            return;
        }
        player.hand.push(card);
        client.statusMessage = TEXT.drawTaken(player.nickname);
        advanceTurn(false);
        broadcastState();
    }

    function hostPlayCard(playerId, rawCard) {
        if (!client.isHost || !hostState.started || !rawCard) return;
        if (!isHostTurn(playerId)) return sendError(playerId, TEXT.notYourTurn);
        const player = getHostPlayer(playerId);
        if (!player) return;
        const index = player.hand.findIndex(
            (card) => card.color === rawCard.color && card.value === rawCard.value,
        );
        if (index === -1) return sendError(playerId, TEXT.invalidCard);
        const card = player.hand[index];
        if (!isCardPlayable(card)) return sendError(playerId, TEXT.invalidCard);
        player.hand.splice(index, 1);
        hostState.discard.push(card);
        hostState.currentValue = card.value;

        if (player.hand.length === 0) {
            hostDeclareWinner(player);
            return;
        }

        if (card.color === 'wild') {
            hostState.awaitingColor = true;
            hostState.pendingWildPlayerId = playerId;
            hostState.pendingWildValue = card.value;
            hostState.currentColor = null;
            broadcastState();
            if (playerId === client.localId) showColorPicker();
            return;
        }

        hostState.currentColor = card.color;
        applyCardEffect(card);
        broadcastState();
    }

    function hostResolveWild(playerId, color) {
        if (!client.isHost) return;
        if (!hostState.awaitingColor || hostState.pendingWildPlayerId !== playerId) return;
        if (!COLOR_CODES.includes(color)) return;
        hostState.awaitingColor = false;
        hostState.pendingWildPlayerId = null;
        hostState.currentColor = color;
        if (hostState.pendingWildValue === 'wild4') {
            const target = getNextPlayer();
            if (target) {
                drawMany(target, 4);
                advanceTurn(true);
            } else {
                advanceTurn(false);
            }
        } else {
            advanceTurn(false);
        }
        hostState.pendingWildValue = null;
        broadcastState();
    }

    function hostDeclareWinner(player) {
        hostState.started = false;
        hostState.winnerId = player.id;
        player.wins = (player.wins || 0) + 1;
        manager.setPlayerScore(player.id, player.wins, player.nickname);
        broadcastState();
    }

    function applyCardEffect(card) {
        let skipNext = false;
        switch (card.value) {
            case 'draw2': {
                const target = getNextPlayer();
                if (target) drawMany(target, 2);
                skipNext = true;
                break;
            }
            case 'reverse':
                if (hostState.players.length === 2) {
                    skipNext = true;
                } else {
                    hostState.direction *= -1;
                }
                break;
            case 'skip':
                skipNext = true;
                break;
            default:
                break;
        }
        advanceTurn(skipNext);
    }

    function drawMany(player, amount) {
        for (let i = 0; i < amount; i += 1) {
            const card = drawCardFromDeck();
            if (!card) break;
            player.hand.push(card);
        }
    }

    function advanceTurn(skip) {
        if (hostState.players.length === 0) return;
        const step = skip ? 2 : 1;
        const count = hostState.players.length;
        hostState.currentPlayerIndex = ((hostState.currentPlayerIndex + (hostState.direction * step)) % count + count) % count;
    }

    function isHostTurn(playerId) {
        if (!hostState.started) return false;
        const current = hostState.players[hostState.currentPlayerIndex];
        return current && current.id === playerId;
    }

    function getHostPlayer(id) {
        return hostState.players.find((player) => player.id === id) || null;
    }

    function getNextPlayer() {
        if (hostState.players.length === 0) return null;
        const count = hostState.players.length;
        const nextIndex = ((hostState.currentPlayerIndex + hostState.direction) % count + count) % count;
        return hostState.players[nextIndex] || null;
    }

    function isCardPlayable(card) {
        if (!card) return false;
        if (card.color === 'wild') return true;
        if (card.color === hostState.currentColor) return true;
        if (card.value === hostState.currentValue) return true;
        return false;
    }

    function createDeck() {
        const deck = [];
        COLOR_CODES.forEach((color) => {
            NUMBER_VALUES.forEach((value, index) => {
                deck.push({ color, value });
                if (index !== 0) deck.push({ color, value });
            });
            ACTION_VALUES.forEach((value) => {
                deck.push({ color, value });
                deck.push({ color, value });
            });
        });
        WILD_VALUES.forEach((value) => {
            for (let i = 0; i < 4; i += 1) {
                deck.push({ color: 'wild', value });
            }
        });
        return deck;
    }

    function drawCardFromDeck() {
        if (hostState.deck.length === 0) refillDeck();
        return hostState.deck.pop() || null;
    }

    function refillDeck() {
        if (hostState.discard.length <= 1) return;
        const top = hostState.discard.pop();
        hostState.deck = shuffle(hostState.discard.slice());
        hostState.discard = [top];
    }

    function shuffle(cards) {
        for (let i = cards.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [cards[i], cards[j]] = [cards[j], cards[i]];
        }
        return cards;
    }

    function serializeHostState() {
        const players = hostState.players.map((player) => ({
            id: player.id,
            nickname: player.nickname,
            cardCount: player.hand.length,
            score: player.wins || 0,
        }));
        const hands = {};
        hostState.players.forEach((player) => {
            hands[player.id] = player.hand.map((card) => ({ color: card.color, value: card.value }));
        });
        return {
            started: hostState.started,
            players,
            deckCount: hostState.deck.length,
            discardTop: hostState.discard[hostState.discard.length - 1] || null,
            currentPlayerId: hostState.players.length
                ? hostState.players[hostState.currentPlayerIndex].id
                : null,
            currentColor: hostState.currentColor,
            currentValue: hostState.currentValue,
            awaitingColor: hostState.awaitingColor,
            pendingWildPlayerId: hostState.pendingWildPlayerId,
            winnerId: hostState.winnerId,
            hands,
        };
    }

    function broadcastState() {
        if (!client.isHost) return;
        const snapshot = serializeHostState();
        applyClientState(snapshot);
        manager.sendMessage('uno:state', snapshot);
    }

    function applyClientState(snapshot) {
        client.state = Object.assign(createEmptySnapshot(), snapshot || {});
        client.hands = snapshot && snapshot.hands ? snapshot.hands : {};
        render();
    }

    function render() {
        renderPlayerHand();
        renderOpponents();
        renderDiscard();
        updateStatus();
        updateCounts();
    }

    function renderPlayerHand() {
        if (!elements.playerHand) return;
        elements.playerHand.innerHTML = '';
        const hand = client.hands[client.localId] || [];
        hand.forEach((card) => {
            const cardEl = createCardElement(card);
            if (!isCardPlayableClient(card)) cardEl.classList.add('disabled');
            cardEl.addEventListener('click', () => {
                if (!client.state.started) return;
                if (!isCardPlayableClient(card)) {
                    client.statusMessage = TEXT.invalidCard;
                    updateStatus();
                    return;
                }
                if (client.isHost) {
                    hostPlayCard(client.localId, card);
                } else {
                    sendAction('play', { card });
                }
            });
            elements.playerHand.appendChild(cardEl);
        });
    }

    function renderOpponents() {
        if (!elements.opponentList) return;
        const list = (client.state.players || []).filter((p) => p.id !== client.localId);
        elements.opponentList.innerHTML = '';
        list.forEach((player) => {
            const row = document.createElement('div');
            row.className = 'card-count opponent-row';
            if (player.id === client.state.currentPlayerId) row.classList.add('active');
            row.textContent = `${player.nickname || 'Giocatore'}: ${player.cardCount || 0}`;
            elements.opponentList.appendChild(row);
        });
    }

    function renderDiscard() {
        if (!elements.discardPile) return;
        elements.discardPile.innerHTML = '';
        const top = client.state.discardTop;
        if (!top) return;
        const cardEl = createCardElement(top);
        if (client.state.currentColor && (top.color === 'wild' || client.state.currentColor !== top.color)) {
            const indicator = document.createElement('div');
            indicator.className = 'color-indicator';
            indicator.style.backgroundColor = `var(--c-${client.state.currentColor})`;
            cardEl.appendChild(indicator);
        }
        elements.discardPile.appendChild(cardEl);
    }

    function updateStatus() {
        if (!elements.status) return;
        if (client.statusMessage) {
            elements.status.textContent = client.statusMessage;
            client.statusMessage = null;
            return;
        }
        if (!client.state.started) {
            if (client.isHost) {
                if (hostState.players.length < 2) {
                    elements.status.textContent = TEXT.needPlayers;
                } else if (hostState.winnerId) {
                    elements.status.textContent = hostState.winnerId === client.localId
                        ? TEXT.youWon
                        : TEXT.playerWon(getPlayerName(hostState.winnerId));
                } else {
                    elements.status.textContent = TEXT.waitingPlayers;
                }
            } else {
                elements.status.textContent = TEXT.waitingStart;
            }
            hideColorPicker();
            return;
        }
        if (client.state.awaitingColor && client.state.pendingWildPlayerId === client.localId) {
            elements.status.textContent = TEXT.chooseColor;
            showColorPicker();
            return;
        }
        if (client.state.currentPlayerId === client.localId) {
            elements.status.textContent = TEXT.yourTurn;
            hideColorPicker();
            return;
        }
        elements.status.textContent = TEXT.opponentTurn(getPlayerName(client.state.currentPlayerId));
        hideColorPicker();
    }

    function updateCounts() {
        if (elements.playerCount) {
            const hand = client.hands[client.localId] || [];
            elements.playerCount.textContent = TEXT.handLabel(hand.length);
        }
        if (elements.opponentCount) {
            const opponents = (client.state.players || []).filter((p) => p.id !== client.localId);
            elements.opponentCount.textContent = TEXT.opponentsLabel(opponents.length);
        }
        if (elements.newGameBtn) {
            elements.newGameBtn.disabled = !client.isHost;
        }
    }

    function showColorPicker() {
        if (!elements.colorPicker || colorPickerVisible) return;
        elements.colorPicker.style.display = 'flex';
        colorPickerVisible = true;
    }

    function hideColorPicker() {
        if (!elements.colorPicker || !colorPickerVisible) return;
        elements.colorPicker.style.display = 'none';
        colorPickerVisible = false;
    }

    function createCardElement(card) {
        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        if (card.color) cardEl.classList.add(card.color);
        const inner = document.createElement('div');
        inner.className = 'card-inner';
        inner.textContent = getCardDisplay(card);
        cardEl.appendChild(inner);
        return cardEl;
    }

    function getCardDisplay(card) {
        if (!card) return '';
        switch (card.value) {
            case 'skip':
                return '⛔';
            case 'reverse':
                return '⟲';
            case 'draw2':
                return '+2';
            case 'wild':
                return '★';
            case 'wild4':
                return '+4';
            default:
                return card.value;
        }
    }

    function isLocalTurn() {
        return client.state.started && client.state.currentPlayerId === client.localId && !client.state.awaitingColor;
    }

    function isCardPlayableClient(card) {
        if (!client.state.started) return false;
        if (card.color === 'wild') return true;
        if (!client.state.currentColor) return true;
        if (card.color === client.state.currentColor) return true;
        if (card.value === client.state.currentValue) return true;
        return false;
    }

    function sendAction(type, payload = {}) {
        manager.sendMessage('uno:action', Object.assign({ type }, payload));
    }

    function sendError(playerId, message) {
        manager.sendMessage('uno:error', { message }, { target: playerId });
    }

    function clampIndex(index) {
        if (hostState.players.length === 0) return 0;
        return ((index % hostState.players.length) + hostState.players.length) % hostState.players.length;
    }

    function mapPlayers(players) {
        return players.map((player) => ({
            id: player.id,
            nickname: player.nickname,
            cardCount: 0,
        }));
    }

    function getPlayerName(id) {
        const player = (client.state.players || []).find((p) => p.id === id);
        return player ? player.nickname : 'Giocatore';
    }

    function clientNickname() {
        const players = manager.getPlayers() || [];
        const self = players.find((p) => p.id === client.localId);
        return self ? self.nickname : 'Giocatore';
    }
})();
