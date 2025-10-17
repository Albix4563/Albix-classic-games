(() => {
    function onReady(handler) {
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            handler();
        } else {
            document.addEventListener('DOMContentLoaded', handler, { once: true });
        }
    }

    onReady(() => {
        const manager = window.chessMultiplayerManager || window.multiplayerManager;
        if (!manager) {
            return;
        }

        const requiredGlobals = [
            'board', 'currentPlayer', 'gameMode', 'gameActive', 'selectedSquare', 'possibleMoves',
            'moveHistory', 'capturedPieces', 'scores', 'enPassantTarget',
            'updateGameStatus', 'updateScoreDisplay', 'updateMoveHistory', 'updateCapturedPieces',
            'setGameMode', 'newGame', 'resetScore', 'makeMove', 'handleSquareClick', 'getPossibleMoves',
            'renderBoard', 'isInCheck', 'isCheckmate', 'isStalemate', 'saveScores', 'saveStats', 'findKing'
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
            localColor: 'white',
            remoteColor: 'black',
            localNickname: '',
            remoteNickname: '',
            lastMove: null,
        };

        const original = {
            handleSquareClick: window.handleSquareClick,
            makeMove: window.makeMove,
            newGame: window.newGame,
            resetScore: window.resetScore,
            setGameMode: window.setGameMode,
            updateGameStatus: window.updateGameStatus,
            updateScoreDisplay: window.updateScoreDisplay,
            updateMoveHistory: window.updateMoveHistory,
            updateCapturedPieces: window.updateCapturedPieces,
            renderBoard: window.renderBoard,
            saveScores: window.saveScores,
        };

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
                document.getElementById('difficultyControls').style.display = 'none';
            } else {
                const show = window.gameMode === 'ai';
                document.getElementById('difficultyControls').style.display = show ? 'flex' : 'none';
            }
        }

        function renderBoardFromState() {
            // Update the board rendering to reflect current state
            window.renderBoard();
        }

        function buildStatePayload() {
            return {
                board: window.board.map(row => row.map(cell => cell ? { ...cell } : null)),
                currentPlayer: window.currentPlayer,
                gameActive: window.gameActive,
                moveHistory: [...window.moveHistory],
                capturedPieces: { 
                    white: [...window.capturedPieces.white], 
                    black: [...window.capturedPieces.black] 
                },
                scores: { ...window.scores },
                enPassantTarget: window.enPassantTarget ? { ...window.enPassantTarget } : null,
                selectedSquare: window.selectedSquare ? { ...window.selectedSquare } : null,
                possibleMoves: [...window.possibleMoves],
                lastMove: mp.lastMove ? { ...mp.lastMove } : null,
            };
        }

        function applyState(snapshot) {
            if (!snapshot) return;
            
            mp.active = true;
            
            if (typeof snapshot.localColor === 'string') {
                mp.localColor = snapshot.localColor;
            }
            if (typeof snapshot.remoteColor === 'string') {
                mp.remoteColor = snapshot.remoteColor;
            }
            if (typeof snapshot.localNickname === 'string') {
                mp.localNickname = snapshot.localNickname;
            }
            if (typeof snapshot.remoteNickname === 'string') {
                mp.remoteNickname = snapshot.remoteNickname;
            }
            
            setModeControlsDisabled(true);
            
            if (Array.isArray(snapshot.board)) {
                window.board = snapshot.board.map(row => row.map(cell => cell ? { ...cell } : null));
            }
            if (typeof snapshot.currentPlayer === 'string') {
                window.currentPlayer = snapshot.currentPlayer;
            }
            if (typeof snapshot.gameActive === 'boolean') {
                window.gameActive = snapshot.gameActive;
            }
            if (Array.isArray(snapshot.moveHistory)) {
                window.moveHistory = [...snapshot.moveHistory];
            }
            if (snapshot.capturedPieces) {
                window.capturedPieces.white = [...(snapshot.capturedPieces.white || [])];
                window.capturedPieces.black = [...(snapshot.capturedPieces.black || [])];
            }
            if (snapshot.scores) {
                window.scores = { ...snapshot.scores };
            }
            if (snapshot.enPassantTarget) {
                window.enPassantTarget = { ...snapshot.enPassantTarget };
            }
            if (snapshot.selectedSquare) {
                window.selectedSquare = { ...snapshot.selectedSquare };
            }
            if (Array.isArray(snapshot.possibleMoves)) {
                window.possibleMoves = [...snapshot.possibleMoves];
            }
            if (snapshot.lastMove) {
                mp.lastMove = { ...snapshot.lastMove };
            }
            
            // Update UI
            window.renderBoard();
            window.updateGameStatus();
            window.updateScoreDisplay();
            window.updateMoveHistory();
            window.updateCapturedPieces();
        }

        function syncState(reason = null, extra = {}) {
            if (!mp.active || !mp.isHost) {
                return;
            }
            const payload = buildStatePayload();
            payload.reason = reason;
            payload.extra = extra;
            payload.localColor = mp.localColor;
            payload.remoteColor = mp.remoteColor;
            payload.localNickname = mp.localNickname;
            payload.remoteNickname = mp.remoteNickname;
            
            if (mp.remotePlayerId) {
                const remotePayload = { ...payload, 
                    localColor: mp.remoteColor,
                    remoteColor: mp.localColor,
                    localNickname: mp.remoteNickname,
                    remoteNickname: mp.localNickname,
                };
                manager.sendMessage('chess:state', remotePayload, { target: mp.remotePlayerId });
            }
        }

        function sendAction(type, payload = {}) {
            if (!mp.active) return;
            const message = { type, ...payload };
            if (mp.isHost && mp.remotePlayerId) {
                manager.sendMessage('chess:action', message, { target: mp.remotePlayerId });
            } else if (!mp.isHost) {
                manager.sendMessage('chess:action', message);
            }
        }

        function handleOpponentLeft(messageKey = 'opponentLeft') {
            if (!mp.active) return;
            mp.active = false;
            mp.remotePlayerId = null;
            mp.remoteNickname = '';
            setModeControlsDisabled(false);
            window.updateGameStatus();
            window.updateScoreDisplay();
        }

        function ensureScoreboardSync() {
            if (!mp.active) return;
            if (typeof manager.updateScore === 'function') {
                manager.updateScore(window.scores.white);
            }
            if (mp.isHost && typeof manager.setPlayerScore === 'function') {
                if (mp.localPlayerId) {
                    manager.setPlayerScore(mp.localPlayerId, window.scores.white, mp.localNickname || 'Player');
                }
                if (mp.remotePlayerId) {
                    manager.setPlayerScore(mp.remotePlayerId, window.scores.black, mp.remoteNickname || 'Opponent');
                }
            }
        }

        window.handleSquareClick = function(row, col) {
            if (mp.active) {
                if (window.gameActive && mp.localColor === window.currentPlayer) {
                    // Check if this is a valid move according to multiplayer rules
                    const piece = window.board[row][col];
                    
                    // If no square is selected
                    if (!window.selectedSquare) {
                        if (piece && piece.color === mp.localColor) {
                            // Select the piece
                            window.selectedSquare = { row, col };
                            window.possibleMoves = window.getPossibleMoves(row, col);
                            window.renderBoard();
                        }
                        return;
                    }
                    
                    // Check if the clicked square is a possible move
                    const moveValid = window.possibleMoves.some(move => move.row === row && move.col === col);
                    if (moveValid) {
                        // Send move to opponent
                        sendAction('move', { 
                            fromRow: window.selectedSquare.row, 
                            fromCol: window.selectedSquare.col, 
                            toRow: row, 
                            toCol: col 
                        });
                        // Clear selection after sending
                        window.selectedSquare = null;
                        window.possibleMoves = [];
                        window.renderBoard();
                    } else if (piece && piece.color === mp.localColor) {
                        // Select a different piece of the same color
                        window.selectedSquare = { row, col };
                        window.possibleMoves = window.getPossibleMoves(row, col);
                        window.renderBoard();
                    } else {
                        // Deselect if clicking elsewhere
                        window.selectedSquare = null;
                        window.possibleMoves = [];
                        window.renderBoard();
                    }
                }
                return;
            }
            
            // Original behavior
            return original.handleSquareClick.call(this, row, col);
        };

        window.makeMove = function(fromRow, fromCol, toRow, toCol) {
            // Execute the move logic
            const piece = window.board[fromRow][fromCol];
            const capturedPiece = window.board[toRow][toCol];
            
            // Handle special moves
            let specialMove = '';
            
            // Castling
            if (piece.type === 'king' && Math.abs(toCol - fromCol) === 2) {
                const isKingSide = toCol > fromCol;
                const rookFromCol = isKingSide ? 7 : 0;
                const rookToCol = isKingSide ? 5 : 3;
                const rook = window.board[fromRow][rookFromCol];
                
                window.board[fromRow][rookToCol] = rook;
                window.board[fromRow][rookFromCol] = null;
                rook.hasMoved = true;
                
                specialMove = isKingSide ? 'O-O' : 'O-O-O';
            }
            
            // En passant capture
            if (piece.type === 'pawn' && !capturedPiece && fromCol !== toCol) {
                const capturedRow = fromRow;
                const capturedCol = toCol;
                const capturedPawn = window.board[capturedRow][capturedCol];
                if (capturedPawn) {
                    window.capturedPieces[capturedPawn.color].push(capturedPawn.type);
                    window.board[capturedRow][capturedCol] = null;
                }
            }
            
            // Record move
            const moveNotation = specialMove || window.getMoveNotation(fromRow, fromCol, toRow, toCol, piece, capturedPiece);
            window.moveHistory.push(moveNotation);
            mp.lastMove = { fromRow, fromCol, toRow, toCol, piece: piece.type, color: piece.color };
            
            // Handle captured piece
            if (capturedPiece) {
                window.capturedPieces[capturedPiece.color].push(capturedPiece.type);
            }
            
            // Make the move
            window.board[toRow][toCol] = piece;
            window.board[fromRow][fromCol] = null;
            piece.hasMoved = true;
            
            // Set en passant target
            window.enPassantTarget = null;
            if (piece.type === 'pawn' && Math.abs(toRow - fromRow) === 2) {
                window.enPassantTarget = {
                    row: fromRow + (toRow - fromRow) / 2,
                    col: toCol
                };
            }
            
            // Check for pawn promotion
            if (piece.type === 'pawn' && (toRow === 0 || toRow === 7)) {
                window.board[toRow][toCol] = { ...piece, type: 'queen' };
            }
            
            // Switch players
            window.currentPlayer = window.currentPlayer === 'white' ? 'black' : 'white';
            
            // Update display
            window.updateGameStatus();
            window.updateMoveHistory();
            window.updateCapturedPieces();
            window.updateScoreDisplay();
            
            if (mp.active && mp.isHost) {
                syncState(window.gameActive ? 'move' : 'end');
            }
        };

        window.newGame = function(fromNetwork) {
            const skip = fromNetwork === true || (fromNetwork && fromNetwork.fromNetwork);
            if (mp.active && !mp.isHost && !skip) {
                sendAction('reset');
                return;
            }
            
            original.newGame.call(this);
            
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

        window.setGameMode = function(mode) {
            if (mp.active) {
                return;
            }
            return original.setGameMode.call(this, mode);
        };

        window.updateGameStatus = function() {
            if (mp.active) {
                const t = window.translations && window.translations[window.currentLanguage] || window.translations.en;
                
                if (window.gameActive) {
                    if (mp.localColor === window.currentPlayer) {
                        const msg = mp.localColor === 'white' ? (t.whiteToMove || 'White to move') : (t.blackToMove || 'Black to move');
                        document.getElementById('gameStatus').textContent = msg;
                    } else {
                        const msg = mp.remoteColor === 'white' ? (t.whiteToMove || 'White to move') : (t.blackToMove || 'Black to move');
                        document.getElementById('gameStatus').textContent = msg;
                    }
                } else {
                    // Game ended - determine the result
                    // Check for checkmate
                    const whiteInCheck = window.isInCheck('white');
                    const blackInCheck = window.isInCheck('black');
                    
                    if (whiteInCheck && window.isCheckmate('white')) {
                        // White is in checkmate, black wins
                        document.getElementById('gameStatus').textContent = t.blackWins || 'Black wins!';
                    } else if (blackInCheck && window.isCheckmate('black')) {
                        // Black is in checkmate, white wins
                        document.getElementById('gameStatus').textContent = t.whiteWins || 'White wins!';
                    } 
                    // Check for stalemate
                    else if (window.isStalemate(window.currentPlayer)) {
                        document.getElementById('gameStatus').textContent = t.stalemate || 'Stalemate!';
                    } 
                    // Draw by other conditions
                    else {
                        document.getElementById('gameStatus').textContent = t.draw || 'Draw!';
                    }
                }
                return;
            }
            
            return original.updateGameStatus.call(this);
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

        manager.on('localReady', ({ id }) => {
            mp.localPlayerId = id;
            mp.isHost = !!manager.isHost;
            mp.localNickname = manager.nickname || '';
            
            if (mp.isHost) {
                mp.localColor = 'white';
                mp.remoteColor = 'black';
            } else {
                mp.localColor = 'black';
                mp.remoteColor = 'white';
            }
            
            // Update UI to reflect player colors
            if (mp.localColor === 'white') {
                document.getElementById('scoreWhiteContainer').classList.add('active');
                document.getElementById('scoreBlackContainer').classList.remove('active');
            } else {
                document.getElementById('scoreBlackContainer').classList.add('active');
                document.getElementById('scoreWhiteContainer').classList.remove('active');
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
                    // Host is always white, remote is black
                    mp.localColor = 'white';
                    mp.remoteColor = 'black';
                    // Initialize the game if not already active
                    if (!window.gameActive) {
                        window.newGame(true);
                    }
                    syncState('opponentJoined');
                } else {
                    // Client is always black when joining
                    mp.localColor = 'black';
                    mp.remoteColor = 'white';
                }
                
                // Update UI to reflect colors
                if (mp.localColor === 'white') {
                    document.getElementById('scoreWhiteContainer').classList.add('active');
                    document.getElementById('scoreBlackContainer').classList.remove('active');
                } else {
                    document.getElementById('scoreBlackContainer').classList.add('active');
                    document.getElementById('scoreWhiteContainer').classList.remove('active');
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
                if (message.type === 'chess:action') {
                    const payload = message.payload || {};
                    switch (payload.type) {
                        case 'move': {
                            const { fromRow, fromCol, toRow, toCol } = payload;
                            if (!Number.isInteger(fromRow) || !Number.isInteger(fromCol) || 
                                !Number.isInteger(toRow) || !Number.isInteger(toCol)) {
                                // Send error
                                return;
                            }
                            
                            if (!window.gameActive || 
                                window.currentPlayer !== mp.remoteColor || 
                                !window.board[fromRow][fromCol] || 
                                window.board[fromRow][fromCol].color !== mp.remoteColor) {
                                // Send error
                                return;
                            }
                            
                            // Validate move is possible
                            const possibleMoves = window.getPossibleMoves(fromRow, fromCol);
                            const isValid = possibleMoves.some(move => 
                                move.row === toRow && move.col === toCol);
                            
                            if (!isValid) {
                                // Send error
                                return;
                            }
                            
                            // Execute the move
                            window.makeMove(fromRow, fromCol, toRow, toCol);
                            syncState(window.gameActive ? 'move' : 'end');
                            break;
                        }
                        case 'reset':
                            window.newGame(true);
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
            
            // Client handling
            switch (message.type) {
                case 'chess:state':
                    applyState(message.payload || {});
                    break;
                case 'chess:error': {
                    const payload = message.payload || {};
                    const t = window.translations && window.translations[window.currentLanguage] || window.translations.en;
                    const text = payload.key ? 
                        (t[payload.key] || 'Action not allowed.') : 
                        'Action not allowed.';
                    document.getElementById('gameStatus').textContent = text;
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