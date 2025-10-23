(() => {
    let manager = null;
    let client = {
        localId: null,
        isHost: false,
        board: ['', '', '', '', '', '', '', '', ''],
        currentPlayer: 'X',
    };

    // Crea il MultiplayerManager
    function setupMultiplayer() {
        manager = window.createMultiplayerManager({
            gameId: 'tris',
            scoreLabel: 'Vittorie',
            maxPlayers: 2,
        });

        manager.on('localReady', ({ id }) => {
            client.localId = id;
            client.isHost = !!manager.isHost;
            render();
        });

        manager.on('playersChanged', (players) => {
            client.state.players = players;
            render();
        });

        manager.on('message', (message) => {
            if (message.type === 'tris:state') {
                applyClientState(message.payload);
            }
        });

        applyTranslations();
    }

    // Funzione per sincronizzare lo stato con gli altri giocatori
    function broadcastState() {
        manager.sendMessage('tris:state', { ...client.board, currentPlayer: client.currentPlayer });
    }

    // Applicare lo stato ricevuto dal server
    function applyClientState(payload) {
        client.board = payload.board;
        client.currentPlayer = payload.currentPlayer;
        render();
    }

    // Funzione per fare una mossa
    function makeMove(index) {
        if (client.board[index] !== '') return;
        client.board[index] = client.currentPlayer;
        client.currentPlayer = client.currentPlayer === 'X' ? 'O' : 'X';
        broadcastState();
    }

    // Rendering
    function render() {
        const boardElements = document.querySelectorAll('.cell');
        boardElements.forEach((cell, index) => {
            cell.textContent = client.board[index];
        });
        document.getElementById('currentPlayer').textContent = `Turno di: ${client.currentPlayer}`;
    }

    document.addEventListener('DOMContentLoaded', setupMultiplayer);
})();
