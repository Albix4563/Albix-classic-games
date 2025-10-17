(() => {
    const MAX_PLAYERS = 5;
    const STORAGE_KEYS = {
        language: 'unoLanguage',
        theme: 'unoTheme',
    };
    const COLOR_CODES = ['red', 'yellow', 'green', 'blue'];
    const NUMBER_VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const ACTION_VALUES = ['skip', 'reverse', 'draw2'];
    const WILD_VALUES = ['wild', 'wild4'];
    const CARD_SYMBOLS = {
        skip: '?',
        reverse: '?',
        draw2: '+2',
        wild: '?',
        wild4: '+4',
    };

    const translations = {
        en: {
            gameTitle: 'Cosmic Clash',
            newGame: 'New Game',
            langButton: 'IT',
            themeDark: 'Dark',
            themeLight: 'Light',
            waitingPlayers: 'Waiting for players...',
            waitingStart: 'Waiting for the host to start...',
            needPlayers: 'At least two players are required to start.',
            yourTurn: 'Your turn!',
            opponentTurn: ({ name }) => `${name}'s turn...`,
            chooseColor: 'Choose a color for the wild card.',
            choosePrompt: 'Select a color for your wild card.',
            notYourTurn: 'Not your turn.',
            invalidCard: 'You cannot play that card.',
            drawTaken: ({ name }) => `${name} draws a card.`,
            deckEmpty: 'Deck empty, shuffling...',
            youWon: 'You won the round!',
            playerWon: ({ name }) => `${name} won the round!`,
            colorChanged: ({ color }) => `Color set to ${color}.`,
            roundEnded: 'Round finished. Start a new match.',
            removed: 'You have been removed from the session.',
            opponentsLabel: ({ count }) => `Opponents: ${count}`,
            handLabel: ({ count }) => `Your cards: ${count}`,
            directionClockwise: 'Clockwise',
            directionCounter: 'Counter-clockwise',
            drawHint: 'Click the deck to draw a card.',
            cardBack: 'COSMIC\nCLASH',
            colorNames: {
                red: 'Red',
                yellow: 'Yellow',
                green: 'Green',
                blue: 'Blue',
            },
            scoreboardLabel: 'Wins',
        },
        it: {
            gameTitle: 'Cosmic Clash',
            newGame: 'Nuova Partita',
            langButton: 'EN',
            themeDark: 'Scuro',
            themeLight: 'Chiaro',
            waitingPlayers: 'In attesa di giocatori...',
            waitingStart: "In attesa che l'host inizi...",
            needPlayers: 'Servono almeno due giocatori per iniziare.',
            yourTurn: 'È il tuo turno!',
            opponentTurn: ({ name }) => `Turno di ${name}...`,
            chooseColor: 'Scegli un colore per la carta jolly.',
            choosePrompt: 'Seleziona un colore per la tua carta jolly.',
            notYourTurn: 'Non è il tuo turno.',
            invalidCard: 'Non puoi giocare questa carta.',
            drawTaken: ({ name }) => `${name} pesca una carta.`,
            deckEmpty: 'Mazzo esaurito, mescolo...',
            youWon: 'Hai vinto il round!',
            playerWon: ({ name }) => `${name} ha vinto il round!`,
            colorChanged: ({ color }) => `Colore impostato su ${color}.`,
            roundEnded: 'Round concluso. Avvia una nuova partita.',
            removed: 'Sei stato rimosso dalla sessione.',
            opponentsLabel: ({ count }) => `Avversari: ${count}`,
            handLabel: ({ count }) => `Le tue carte: ${count}`,
            directionClockwise: 'Senso orario',
            directionCounter: 'Senso antiorario',
            drawHint: 'Clicca sul mazzo per pescare una carta.',
            cardBack: 'COSMIC\nCLASH',
            colorNames: {
                red: 'Rosso',
                yellow: 'Giallo',
                green: 'Verde',
                blue: 'Blu',
            },
            scoreboardLabel: 'Vittorie',
        },
    };

    const elements = {};
    const client = {
        localId: null,
        isHost: false,
        state: createEmptySnapshot(),
        hand: [],
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
    let particlesCreated = false;
    let currentLanguage = 'en';
    let currentTheme = 'dark';

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        cacheElements();
        attachUIEvents();
        loadPreferences();
        applyTheme();
        applyTranslations();
        setupMultiplayer();
        ensureParticles();
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
        elements.directionLabel = document.getElementById('difficulty-display');
        elements.directionContainer = document.getElementById('difficulty-select');
        elements.colorPicker = document.getElementById('color-picker-modal');
        elements.colorTitle = document.getElementById('color-picker-title');
        elements.colorButtons = Array.from(document.querySelectorAll('.color-btn'));
        elements.cardBackInner = document.querySelector('#draw-pile .card-inner');
        if (elements.directionContainer) {
            elements.directionContainer.style.display = 'none';
        }
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
                if (client.state.awaitingColor && client.state.pendingWildPlayerId === client.localId) {
                    showColorPicker();
                    return;
                }
                if (!isLocalTurn()) {
                    client.statusMessage = t('notYourTurn');
                    render();
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
        if (elements.langBtn) {
            elements.langBtn.addEventListener('click', () => {
                currentLanguage = currentLanguage === 'en' ? 'it' : 'en';
                localStorage.setItem(STORAGE_KEYS.language, currentLanguage);
                applyTranslations();
                render();
                if (manager) {
                    manager.boardLabel = t('scoreboardLabel');
                }
            });
        }
        if (elements.themeBtn) {
            elements.themeBtn.addEventListener('click', () => {
                currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
                localStorage.setItem(STORAGE_KEYS.theme, currentTheme);
                applyTheme();
            });
        }
    }

    function loadPreferences() {
        const storedLang = localStorage.getItem(STORAGE_KEYS.language);
        if (storedLang === 'en' || storedLang === 'it') {
            currentLanguage = storedLang;
        }
        const storedTheme = localStorage.getItem(STORAGE_KEYS.theme);
        if (storedTheme === 'dark' || storedTheme === 'light') {
            currentTheme = storedTheme;
        }
    }

    function applyTheme() {
        const body = document.body;
        if (!body) return;
        if (currentTheme === 'light') {
            body.classList.add('light-theme');
        } else {
            body.classList.remove('light-theme');
        }
        if (elements.themeBtn) {
            elements.themeBtn.textContent = currentTheme === 'light' ? t('themeDark') : t('themeLight');
        }
    }

    function applyTranslations() {
        if (elements.newGameBtn) {
            elements.newGameBtn.textContent = t('newGame');
        }
        if (elements.langBtn) {
            const alt = currentLanguage === 'en' ? translations.it.langButton : translations.en.langButton;
            elements.langBtn.textContent = alt;
        }
        if (elements.colorTitle) {
            elements.colorTitle.textContent = t('choosePrompt');
        }
        if (elements.drawPile) {
            elements.drawPile.title = t('drawHint');
        }
        if (elements.cardBackInner) {
            elements.cardBackInner.innerHTML = t('cardBack').replace('\n', '<br>');
        }
        elements.colorButtons.forEach((button) => {
            const color = button.dataset.color;
            button.title = color ? colorName(color) : '';
        });
        const boardLabel = document.querySelector('.mp-board-label');
        if (boardLabel) {
            boardLabel.textContent = t('scoreboardLabel');
        }
    }
    function setupMultiplayer() {
        manager = window.createMultiplayerManager({
            gameId: 'uno',
            scoreLabel: t('scoreboardLabel'),
            maxPlayers: MAX_PLAYERS,
        });

        manager.on('localReady', ({ id }) => {
            client.localId = id;
            client.isHost = !!manager.isHost;
            if (client.isHost) {
                ensureHostPlayer(id, getPlayerNickname(id));
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
            } else {
                client.state.players = (players || []).map((player) => ({
                    id: player.id,
                    nickname: player.nickname,
                    cardCount: player.score || 0,
                    score: player.score || 0,
                }));
            }
            render();
        });

        manager.on('playerJoined', (player) => {
            if (!client.isHost) return;
            ensureHostPlayer(player.id, player.nickname);
            broadcastState();
        });

        manager.on('playerLeft', ({ id }) => {
            if (!client.isHost) {
                client.state.players = (client.state.players || []).filter((p) => p.id !== id);
                render();
                return;
            }
            removeHostPlayer(id);
            broadcastState('roundEnded');
        });

        manager.on('kicked', () => {
            client.statusMessage = t('removed');
            render();
        });

        manager.on('message', (message) => {
            if (!message) return;
            if (client.isHost) {
                handleHostMessage(message);
                return;
            }
            switch (message.type) {
                case 'uno:state':
                    applyClientState(message.payload || {});
                    break;
                case 'uno:error':
                    if (message.payload && message.payload.key) {
                        client.statusMessage = t(message.payload.key, message.payload.params || {});
                        render();
                    }
                    break;
                default:
                    break;
            }
        });

        applyTranslations();
    }

    function ensureParticles() {
        if (particlesCreated) return;
        const count = window.innerWidth < 768 ? 8 : 15;
        for (let i = 0; i < count; i += 1) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            const size = Math.random() * 10 + 5;
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.animationDelay = `${Math.random() * 15}s`;
            particle.style.animationDuration = `${Math.random() * 10 + 15}s`;
            document.body.appendChild(particle);
        }
        particlesCreated = true;
    }

    function startRound() {
        if (!client.isHost) return;
        if (hostState.players.length < 2) {
            client.statusMessage = t('needPlayers');
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
                const card = drawCard();
                if (card) player.hand.push(card);
            });
        }

        let firstCard = null;
        do {
            firstCard = drawCard();
        } while (firstCard && firstCard.color === 'wild');
        if (!firstCard) firstCard = { color: 'red', value: '0' };
        hostState.discard.push(firstCard);
        hostState.currentColor = firstCard.color;
        hostState.currentValue = firstCard.value;
        hostState.currentPlayerIndex = hostState.nextStartIndex % hostState.players.length;
        hostState.currentPlayerIndex = clampIndex(hostState.currentPlayerIndex);
        hostState.nextStartIndex = (hostState.currentPlayerIndex + 1) % hostState.players.length;

        broadcastState();
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

    function drawCard() {
        if (hostState.deck.length === 0) {
            refillDeck();
        }
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
    function ensureHostPlayer(id, nickname) {
        let record = hostState.players.find((player) => player.id === id);
        if (!record) {
            record = {
                id,
                nickname: nickname || `Player ${hostState.players.length + 1}`,
                hand: [],
                wins: 0,
            };
            hostState.players.push(record);
        } else {
            record.nickname = nickname || record.nickname;
        }
        return record;
    }

    function syncHostPlayers(players) {
        const seen = new Set();
        (players || []).forEach((player) => {
            const record = ensureHostPlayer(player.id, player.nickname);
            record.wins = typeof player.score === 'number' ? player.score : record.wins || 0;
            seen.add(player.id);
        });
        hostState.players = hostState.players.filter((player) => seen.has(player.id));
        hostState.currentPlayerIndex = clampIndex(hostState.currentPlayerIndex);
    }

    function removeHostPlayer(id) {
        const index = hostState.players.findIndex((player) => player.id === id);
        if (index === -1) return;
        hostState.players.splice(index, 1);
        if (hostState.players.length < 2) {
            hostState.started = false;
            hostState.winnerId = null;
        }
        hostState.currentPlayerIndex = clampIndex(hostState.currentPlayerIndex);
    }

    function handleHostMessage(message) {
        const { type, payload, senderId } = message;
        if (type !== 'uno:action' || !senderId) return;
        const action = payload || {};
        switch (action.type) {
            case 'draw':
                hostDrawCard(senderId);
                break;
            case 'play':
                hostPlayCard(senderId, action.payload ? action.payload.card : action.card);
                break;
            case 'chooseColor':
                hostResolveWild(senderId, action.payload ? action.payload.color : action.color);
                break;
            default:
                break;
        }
    }

    function hostDrawCard(playerId) {
        if (!client.isHost || !hostState.started) return;
        if (hostState.awaitingColor) return;
        if (!isHostTurn(playerId)) {
            sendError(playerId, 'notYourTurn');
            return;
        }
        const player = hostState.players.find((p) => p.id === playerId);
        if (!player) return;
        const card = drawCard();
        if (card) {
            player.hand.push(card);
            broadcastState('drawTaken', { name: player.nickname });
        } else {
            broadcastState('deckEmpty');
        }
        advanceTurn(false);
        broadcastState();
    }

    function hostPlayCard(playerId, rawCard) {
        if (!client.isHost || !hostState.started || hostState.awaitingColor) return;
        if (!rawCard || typeof rawCard.color !== 'string' || typeof rawCard.value !== 'string') {
            sendError(playerId, 'invalidCard');
            return;
        }
        if (!isHostTurn(playerId)) {
            sendError(playerId, 'notYourTurn');
            return;
        }
        const player = hostState.players.find((p) => p.id === playerId);
        if (!player) return;
        const index = player.hand.findIndex((card) => card.color === rawCard.color && card.value === rawCard.value);
        if (index === -1) {
            sendError(playerId, 'invalidCard');
            return;
        }
        const card = player.hand[index];
        if (!isCardPlayable(card)) {
            sendError(playerId, 'invalidCard');
            return;
        }
        player.hand.splice(index, 1);
        hostState.discard.push(card);
        hostState.currentValue = card.value;

        if (player.hand.length === 0) {
            declareWinner(player);
            return;
        }

        if (card.color === 'wild') {
            hostState.awaitingColor = true;
            hostState.pendingWildPlayerId = playerId;
            hostState.pendingWildValue = card.value;
            hostState.currentColor = null;
            broadcastState('chooseColor');
            if (playerId === client.localId) {
                showColorPicker();
            }
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
                drawMultiple(target, 4);
                advanceTurn(true);
            } else {
                advanceTurn(false);
            }
        } else {
            advanceTurn(false);
        }
        broadcastState('colorChanged', { color: colorName(color) });
    }

    function declareWinner(player) {
        hostState.started = false;
        hostState.winnerId = player.id;
        player.wins = (player.wins || 0) + 1;
        manager.setPlayerScore(player.id, player.wins, player.nickname);
        hostState.nextStartIndex = hostState.players.indexOf(player);
        const statusKey = player.id === client.localId ? 'youWon' : 'playerWon';
        broadcastState(statusKey, { name: player.nickname });
    }

    function drawMultiple(player, amount) {
        for (let i = 0; i < amount; i += 1) {
            const card = drawCard();
            if (!card) break;
            player.hand.push(card);
        }
    }

    function applyCardEffect(card) {
        let skipNext = false;
        switch (card.value) {
            case 'draw2': {
                const target = getNextPlayer();
                if (target) drawMultiple(target, 2);
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

    function advanceTurn(skip) {
        if (hostState.players.length === 0) return;
        const step = skip ? 2 : 1;
        const count = hostState.players.length;
        hostState.currentPlayerIndex = ((hostState.currentPlayerIndex + (hostState.direction * step)) % count + count) % count;
    }

    function isHostTurn(playerId) {
        if (!hostState.started || hostState.players.length === 0) return false;
        const current = hostState.players[hostState.currentPlayerIndex];
        return current && current.id === playerId;
    }

    function getNextPlayer() {
        if (hostState.players.length === 0) return null;
        const count = hostState.players.length;
        const nextIndex = ((hostState.currentPlayerIndex + hostState.direction) % count + count) % count;
        return hostState.players[nextIndex] || null;
    }

    function broadcastState(statusKey = null, params = null) {
        if (!client.isHost || !manager) return;
        const state = buildPublicState();
        if (statusKey) {
            state.status = { key: statusKey, params };
        }
        const hostPlayer = hostState.players.find((player) => player.id === client.localId);
        const hostSnapshot = Object.assign({}, state, { hand: hostPlayer ? hostPlayer.hand.slice() : [] });
        applyClientState(hostSnapshot);
        hostState.players.forEach((player) => {
            if (player.id === client.localId) return;
            const payload = Object.assign({}, state, { hand: player.hand.map((card) => ({ color: card.color, value: card.value })) });
            manager.sendMessage('uno:state', payload, { target: player.id });
        });
    }

    function buildPublicState() {
        return {
            started: hostState.started,
            players: hostState.players.map((player, index) => ({
                id: player.id,
                nickname: player.nickname,
                cardCount: player.hand.length,
                score: player.wins || 0,
                isCurrent: index === hostState.currentPlayerIndex,
            })),
            deckCount: hostState.deck.length,
            discardTop: hostState.discard[hostState.discard.length - 1] || null,
            currentPlayerId: hostState.players.length ? hostState.players[hostState.currentPlayerIndex].id : null,
            currentColor: hostState.currentColor,
            currentValue: hostState.currentValue,
            direction: hostState.direction,
            awaitingColor: hostState.awaitingColor,
            pendingWildPlayerId: hostState.pendingWildPlayerId,
            winnerId: hostState.winnerId,
        };
    }
    function applyClientState(snapshot) {
        client.state = Object.assign(createEmptySnapshot(), snapshot);
        client.hand = Array.isArray(snapshot.hand)
            ? snapshot.hand.map((card) => ({ color: card.color, value: card.value }))
            : [];
        if (snapshot.status && snapshot.status.key) {
            client.statusMessage = t(snapshot.status.key, snapshot.status.params || {});
        }
        render();
    }

    function render() {
        renderPlayerHand();
        renderPlayers();
        renderDiscard();
        updateStatus();
        updateMeta();
    }

    function renderPlayerHand() {
        if (!elements.playerHand) return;
        elements.playerHand.innerHTML = '';
        client.hand.forEach((card) => {
            const cardEl = createCardElement(card);
            if (!client.state.started || client.state.awaitingColor || !isCardPlayableClient(card)) {
                cardEl.classList.add('disabled');
            }
            cardEl.addEventListener('click', () => {
                if (!client.state.started || client.state.awaitingColor) return;
                if (!isLocalTurn()) {
                    client.statusMessage = t('notYourTurn');
                    render();
                    return;
                }
                if (!isCardPlayableClient(card)) {
                    client.statusMessage = t('invalidCard');
                    render();
                    return;
                }
                if (client.isHost) {
                    hostPlayCard(client.localId, { color: card.color, value: card.value });
                } else {
                    sendAction('play', { card: { color: card.color, value: card.value } });
                }
            });
            elements.playerHand.appendChild(cardEl);
        });
    }

    function renderPlayers() {
        if (!elements.opponentList) return;
        elements.opponentList.innerHTML = '';
        (client.state.players || []).forEach((player) => {
            const row = document.createElement('div');
            row.className = 'card-count opponent-row';
            if (player.id === client.state.currentPlayerId) {
                row.classList.add('active');
            }
            row.textContent = `${player.nickname || 'Player'}: ${player.cardCount || 0}`;
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
            indicator.title = colorName(client.state.currentColor);
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
                    elements.status.textContent = t('needPlayers');
                } else if (client.state.winnerId) {
                    elements.status.textContent = client.state.winnerId === client.localId
                        ? t('youWon')
                        : t('playerWon', { name: getPlayerName(client.state.winnerId) });
                } else {
                    elements.status.textContent = t('waitingPlayers');
                }
            } else {
                elements.status.textContent = t('waitingStart');
            }
            hideColorPicker();
            return;
        }
        if (client.state.awaitingColor && client.state.pendingWildPlayerId === client.localId) {
            elements.status.textContent = t('chooseColor');
            showColorPicker();
            return;
        }
        if (client.state.awaitingColor) {
            elements.status.textContent = t('chooseColor');
            hideColorPicker();
            return;
        }
        if (isLocalTurn()) {
            elements.status.textContent = t('yourTurn');
            hideColorPicker();
            return;
        }
        elements.status.textContent = t('opponentTurn', { name: getPlayerName(client.state.currentPlayerId) });
        hideColorPicker();
    }

    function updateMeta() {
        if (elements.playerCount) {
            elements.playerCount.textContent = t('handLabel', { count: client.hand.length });
        }
        if (elements.opponentCount) {
            const opponents = (client.state.players || []).filter((player) => player.id !== client.localId);
            elements.opponentCount.textContent = t('opponentsLabel', { count: opponents.length });
        }
        if (elements.newGameBtn) {
            elements.newGameBtn.disabled = !client.isHost;
        }
        if (elements.directionLabel) {
            const key = client.state.direction === 1 ? 'directionClockwise' : 'directionCounter';
            elements.directionLabel.textContent = t(key);
        }
    }

    function createCardElement(card) {
        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        if (card.color) {
            cardEl.classList.add(card.color);
        }
        const inner = document.createElement('div');
        inner.className = 'card-inner';
        inner.textContent = getCardLabel(card);
        cardEl.appendChild(inner);
        return cardEl;
    }

    function getCardLabel(card) {
        if (!card) return '';
        if (CARD_SYMBOLS[card.value]) {
            return CARD_SYMBOLS[card.value];
        }
        return card.value;
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

    function isLocalTurn() {
        return client.state.started
            && !client.state.awaitingColor
            && client.state.currentPlayerId === client.localId;
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
        manager.sendMessage('uno:action', { type, payload });
    }

    function sendError(playerId, key, params = {}) {
        manager.sendMessage('uno:error', { key, params }, { target: playerId });
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
            direction: 1,
            awaitingColor: false,
            pendingWildPlayerId: null,
            winnerId: null,
        };
    }

    function clampIndex(index) {
        if (hostState.players.length === 0) return 0;
        return ((index % hostState.players.length) + hostState.players.length) % hostState.players.length;
    }

    function getPlayerName(id) {
        const player = (client.state.players || []).find((entry) => entry.id === id);
        return player ? player.nickname : 'Player';
    }

    function getPlayerNickname(id) {
        const list = manager.getPlayers() || [];
        const found = list.find((entry) => entry.id === id);
        return found ? found.nickname : `Player ${list.length}`;
    }

    function colorName(color) {
        const dictionary = translations[currentLanguage].colorNames || translations.en.colorNames;
        return dictionary[color] || color;
    }

    function t(key, params = {}) {
        const dictionary = translations[currentLanguage] || translations.en;
        const fallback = translations.en;
        const entry = dictionary[key] !== undefined ? dictionary[key] : fallback[key];
        if (typeof entry === 'function') {
            return entry(params);
        }
        if (typeof entry === 'string') {
            return entry;
        }
        return key;
    }
})();

