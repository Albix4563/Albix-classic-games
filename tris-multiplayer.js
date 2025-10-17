(() => {
    function onReady(handler) {
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            handler();
        } else {
            document.addEventListener('DOMContentLoaded', handler, { once: true });
        }
    }

    onReady(() => {
        const manager = window.trisMultiplayerManager || window.multiplayerManager;
        if (!manager) {
            return;
        }

        const requiredGlobals = [
            'board', 'currentPlayer', 'playerStarter', 'scores', 'stats', 'gameMode', 'gameActive',
            'cells', 'statusDisplay', 'difficultySelector', 'starterSelector', 'playerLabel', 'opponentLabel',
            'updateScoreLabels', 'updateScoreDisplay', 'updateStatsDisplay', 'updateStatus', 'updateActiveScore',
            'setGameMode', 'setDifficulty', 'setStarter', 'resetGame', 'resetScore', 'makeMove',
            'handleCellClick', 'highlightWinningCells', 'saveScores', 'saveStats', 'endGame'
        ];

        for (const key of requiredGlobals) {
            if (!(key in window)) {
                return;
            }
        }

        const mp = {
            active: false,
            isHost: false,
            localPlayerId: null,
            remotePlayerId: null,
            localSymbol: 'X',
            remoteSymbol: 'O',
            localNickname: '',
            remoteNickname: '',
            lastWinningCells: [],
        };

        const original = {
            handleCellClick: window.handleCellClick,
            makeMove: window.makeMove,
            resetGame: window.resetGame,
            resetScore: window.resetScore,
            setGameMode: window.setGameMode,
            setDifficulty: window.setDifficulty,
            setStarter: window.setStarter,
            updateScoreLabels: window.updateScoreLabels,
            updateScoreDisplay: window.updateScoreDisplay,
            updateStatsDisplay: window.updateStatsDisplay,
            updateStatus: window.updateStatus,
            updateActiveScore: window.updateActiveScore,
            highlightWinningCells: window.highlightWinningCells,
            saveScores: window.saveScores,
            saveStats: window.saveStats,
            endGame: window.endGame,
        };

        const cells = window.cells;
        const playerLabel = window.playerLabel;
        const opponentLabel = window.opponentLabel;

        function removeLegacyNotice() {
            const nodes = Array.from(document.querySelectorAll('div'));
            nodes.forEach((node) => {
                if (node.textContent && node.textContent.includes('Modalità multiplayer')) {
                    node.remove();
                }
            });
        }

        function setModeControlsDisabled(disabled) {
            document.querySelectorAll('.mode-btn').forEach((btn, index) => {
                if (disabled) {
                    btn.setAttribute('disabled', 'disabled');
                    if (index === 0) {
                        btn.classList.add('active');
                    }
                } else {
                    btn.removeAttribute('disabled');
                }
            });
            if (disabled) {
                window.gameMode = 'pvp';
                window.difficultySelector.style.display = 'none';
                window.starterSelector.style.display = 'none';
            } else {
                const show = window.gameMode === 'ai';
                window.difficultySelector.style.display = show ? 'grid' : 'none';
                window.starterSelector.style.display = show ? 'grid' : 'none';
            }
        }

        function renderBoardFromState(winning = mp.lastWinningCells) {
            cells.forEach((cell, index) => {
                const value = window.board[index] || '';
                cell.textContent = value;
                cell.className = 'cell';
                if (value === 'X' || value === 'O') {
                    cell.classList.add(value.toLowerCase(), 'disabled');
                }
            });
            if (Array.isArray(winning)) {
                winning.forEach((index) => {
                    if (cells[index]) {
                        cells[index].classList.add('winning-cell');
                    }
                });
            }
        }

        function buildStatePayload() {
            return {
                board: window.board.slice(),
                currentPlayer: window.currentPlayer,
                playerStarter: window.playerStarter,
                gameActive: window.gameActive,
                scores: {
                    player: window.scores.player,
                    opponent: window.scores.opponent,
                    draw: window.scores.draw,
                },
                stats: {
                    totalGames: window.stats.totalGames,
                    currentStreak: window.stats.currentStreak,
                    bestStreak: window.stats.bestStreak,
                    lastWinner: window.stats.lastWinner,
                    totalMoveTime: window.stats.totalMoveTime,
                    totalMoves: window.stats.totalMoves,
                    fastestWin: window.stats.fastestWin,
                },
                winningCells: mp.lastWinningCells.slice(),
            };
        }

        function applyState(snapshot) {
            if (!snapshot) return;
            mp.active = true;
            if (typeof snapshot.localSymbol === 'string') {
                mp.localSymbol = snapshot.localSymbol;
            }
            if (typeof snapshot.remoteSymbol === 'string') {
                mp.remoteSymbol = snapshot.remoteSymbol;
            }
            if (typeof snapshot.localNickname === 'string') {
                mp.localNickname = snapshot.localNickname;
            }
            if (typeof snapshot.remoteNickname === 'string') {
                mp.remoteNickname = snapshot.remoteNickname;
            }
            setModeControlsDisabled(true);
            if (Array.isArray(snapshot.board)) {
                snapshot.board.forEach((value, index) => {
                    window.board[index] = value || '';
                });
            }
            if (typeof snapshot.currentPlayer === 'string') {
                window.currentPlayer = snapshot.currentPlayer;
            }
            if (typeof snapshot.playerStarter === 'string') {
                window.playerStarter = snapshot.playerStarter;
            }
            if (typeof snapshot.gameActive === 'boolean') {
                window.gameActive = snapshot.gameActive;
            }
            if (snapshot.scores) {
                window.scores.player = snapshot.scores.player;
                window.scores.opponent = snapshot.scores.opponent;
                window.scores.draw = snapshot.scores.draw;
            }
            if (snapshot.stats) {
                Object.assign(window.stats, snapshot.stats);
            }
            mp.lastWinningCells = Array.isArray(snapshot.winningCells) ? snapshot.winningCells.slice() : [];
            renderBoardFromState();
            original.updateScoreDisplay.call(window);
            original.updateStatsDisplay.call(window);
            original.updateScoreLabels.call(window);
            original.updateStatus.call(window);
            original.updateActiveScore.call(window);
        }

        function syncState(reason = null, extra = {}) {
            if (!mp.active || !mp.isHost) {
                return;
            }
            const payload = buildStatePayload();
            payload.reason = reason;
            payload.extra = extra;
            payload.localSymbol = mp.localSymbol;
            payload.remoteSymbol = mp.remoteSymbol;
            payload.localNickname = mp.localNickname;
            payload.remoteNickname = mp.remoteNickname;
            if (mp.remotePlayerId) {
                const remotePayload = Object.assign({}, payload, {
                    localSymbol: mp.remoteSymbol,
                    remoteSymbol: mp.localSymbol,
                    localNickname: mp.remoteNickname,
                    remoteNickname: mp.localNickname,
                });
                manager.sendMessage('tris:state', remotePayload, { target: mp.remotePlayerId });
            }
        }

        function sendAction(type, payload = {}) {
            if (!mp.active) return;
            const message = Object.assign({ type }, payload);
            if (mp.isHost && mp.remotePlayerId) {
                manager.sendMessage('tris:action', message, { target: mp.remotePlayerId });
            } else if (!mp.isHost) {
                manager.sendMessage('tris:action', message);
            }
        }

        function handleOpponentLeft(messageKey = 'opponentLeft') {
            if (!mp.active) return;
            mp.active = false;
            mp.remotePlayerId = null;
            mp.remoteNickname = '';
            setModeControlsDisabled(false);
            original.updateScoreLabels.call(window);
            original.updateStatus.call(window);
            mp.lastWinningCells = [];\n            renderBoardFromState([]);
            const t = window.translations && window.translations[window.currentLanguage];
            if (t && t.status && t.status[messageKey]) {
                window.statusDisplay.textContent = t.status[messageKey];
            }
        }

        function ensureScoreboardSync() {
            if (!mp.active) return;
            if (typeof manager.updateScore === 'function') {
                manager.updateScore(window.scores.player);
            }
            if (mp.isHost && typeof manager.setPlayerScore === 'function') {
                if (mp.localPlayerId) {
                    manager.setPlayerScore(mp.localPlayerId, window.scores.player, mp.localNickname || 'Player');
                }
                if (mp.remotePlayerId) {
                    manager.setPlayerScore(mp.remotePlayerId, window.scores.opponent, mp.remoteNickname || 'Opponent');
                }
            }
        }

        window.handleCellClick = function(event) {
            if (mp.active) {
                const cell = event.target;
                const index = parseInt(cell.getAttribute('data-index'), 10);
                if (Number.isNaN(index) || window.board[index] !== '' || !window.gameActive) {
                    return;
                }
                if (mp.localSymbol !== window.currentPlayer) {
                    return;
                }
                if (!mp.isHost) {
                    sendAction('move', { index });
                    return;
                }
            }
            return original.handleCellClick.call(this, event);
        };

        window.makeMove = function(index, player) {
            original.makeMove.call(this, index, player);
            if (mp.active && mp.isHost) {
                syncState(window.gameActive ? 'move' : 'end');
            }
        };

        window.resetGame = function(fromNetwork) {
            const skip = fromNetwork === true || (fromNetwork && fromNetwork.fromNetwork);
            if (mp.active && !mp.isHost && !skip) {
                sendAction('reset');
                return;
            }
            mp.lastWinningCells = [];
            original.resetGame.call(this);
            renderBoardFromState();
            if (mp.active && mp.isHost) {
                syncState('reset');
            }
        };

        window.resetScore = function(fromNetwork) {
            const skip = fromNetwork === true || (fromNetwork && fromNetwork.fromNetwork);
            if (mp.active && !mp.isHost && !skip) {
                sendAction('resetScore');
                return;
            }
            original.resetScore.call(this);
            if (mp.active && mp.isHost) {
                syncState('score');
            }
        };

        window.setGameMode = function(mode, event) {
            if (mp.active) {
                return;
            }
            return original.setGameMode.call(this, mode, event);
        };

        window.setDifficulty = function(diff, event) {
            if (mp.active) {
                return;
            }
            return original.setDifficulty.call(this, diff, event);
        };

        window.setStarter = function(starter, event) {
            if (mp.active) {
                return;
            }
            return original.setStarter.call(this, starter, event);
        };

        window.updateScoreLabels = function() {
            original.updateScoreLabels.call(this);
            if (!mp.active) {
                return;
            }
            const t = window.translations && window.translations[window.currentLanguage];
            const baseX = t && t.score && t.score.playerX ? t.score.playerX : 'Player X';
            const baseO = t && t.score && t.score.playerO ? t.score.playerO : 'Player O';
            const localName = mp.localNickname || 'You';
            const remoteName = mp.remoteNickname || 'Opponent';
            if (mp.localSymbol === 'X') {
                playerLabel.textContent = ${baseX} ();
                opponentLabel.textContent = ${baseO} ();
            } else {
                playerLabel.textContent = ${baseX} ();
                opponentLabel.textContent = ${baseO} ();
            }
        };

        window.updateStatus = function() {
            if (mp.active) {
                const t = window.translations && window.translations[window.currentLanguage];
                if (window.gameActive) {
                    if (mp.localSymbol === window.currentPlayer) {
                        const msg = t && t.status && t.status.yourTurn ? t.status.yourTurn : 'Your Turn';
                        window.statusDisplay.textContent = msg;
                    } else {
                        const key = window.currentPlayer === 'X' ? 'turnX' : 'turnO';
                        const msg = t && t.status && t.status[key] ? t.status[key] : (key === 'turnX' ? 'Player X Turn' : 'Player O Turn');
                        window.statusDisplay.textContent = msg;
                    }
                }
                return;
            }
            return original.updateStatus.call(this);
        };

        window.updateScoreDisplay = function() {
            original.updateScoreDisplay.call(this);
            ensureScoreboardSync();
        };

        window.saveScores = function() {
            if (mp.active && !mp.isHost) {
                return;
            }
            return original.saveScores.call(this);
        };

        window.saveStats = function() {
            if (mp.active && !mp.isHost) {
                return;
            }
            return original.saveStats.call(this);
        };

        window.highlightWinningCells = function(condition) {
            mp.lastWinningCells = Array.isArray(condition) ? condition.slice() : [];
            return original.highlightWinningCells.call(this, condition);
        };

        window.endGame = function(isDraw) {
            original.endGame.call(this, isDraw);
            if (mp.active && mp.isHost) {
                const winnerKey = isDraw ? 'draw' : window.currentPlayer;
                syncState(isDraw ? 'draw' : 'win', { winner: winnerKey });
            }
        };

        manager.on('localReady', ({ id }) => {
            mp.localPlayerId = id;
            mp.isHost = !!manager.isHost;
            mp.localNickname = manager.nickname || '';
            if (mp.isHost) {
                mp.localSymbol = 'X';
                mp.remoteSymbol = 'O';
            } else {
                mp.localSymbol = 'O';
                mp.remoteSymbol = 'X';
            }
        });

        manager.on('connectionState', (state) => {
            if (state === 'offline') {
                handleOpponentLeft('opponentLeft');
            }
        });

        manager.on('playersChanged', (players) => {
            const list = Array.isArray(players) ? players : [];
            const remote = list.find((player) => player.id && player.id !== mp.localPlayerId);
            if (remote) {
                mp.remotePlayerId = remote.id;
                mp.remoteNickname = remote.nickname || mp.remoteNickname;
                mp.active = true;
                setModeControlsDisabled(true);
                if (mp.isHost) {
                    mp.localSymbol = 'X';
                    mp.remoteSymbol = 'O';
                    syncState('opponentJoined');
                }
            } else {
                handleOpponentLeft('opponentLeft');
            }
        });

        manager.on('playerLeft', () => handleOpponentLeft('opponentLeft'));
        manager.on('hostClosing', () => handleOpponentLeft('opponentLeft'));
        manager.on('kicked', () => handleOpponentLeft('opponentLeft'));

        manager.on('message', (message) => {
            if (!message) return;
            if (mp.isHost) {
                if (message.type === 'tris:action') {
                    const payload = message.payload || {};
                    switch (payload.type) {
                        case 'move': {
                            const index = payload.index;
                            if (!Number.isInteger(index) || index < 0 || index >= window.board.length) {
                                sendMultiplayerError('invalidMove');
                                return;
                            }
                            if (!window.gameActive || window.board[index] !== '' || window.currentPlayer !== mp.remoteSymbol) {
                                sendMultiplayerError('invalidMove');
                                return;
                            }
                            original.makeMove.call(window, index, window.currentPlayer);
                            syncState(window.gameActive ? 'move' : 'end');
                            break;
                        }
                        case 'reset':
                            window.resetGame(true);
                            break;
                        case 'resetScore':
                            window.resetScore(true);
                            break;
                        default:
                            break;
                    }
                }
                return;
            }
            switch (message.type) {
                case 'tris:state':
                    applyState(message.payload || {});
                    break;
                case 'tris:error': {
                    const payload = message.payload || {};
                    const t = window.translations && window.translations[window.currentLanguage];
                    const text = t && t.status && t.status[payload.key]
                        ? (typeof t.status[payload.key] === 'function'
                            ? t.status[payload.key](payload.params || {})
                            : t.status[payload.key])
                        : 'Action not allowed.';
                    window.statusDisplay.textContent = text;
                    break;
                }
                default:
                    break;
            }
        });

        setTimeout(removeLegacyNotice, 100);
        ensureScoreboardSync();
    });
})();


