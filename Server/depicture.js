const { Room } = require("./GameComponents.js");

var path = require("path");
var express = require('express');

var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var clientDir = path.join(__dirname, "../Client");


// Serve public web files

app.use(express.static(clientDir))
app.get('/', (req, res) => {
    res.sendFile(clientDir + '/game.html');
});


// Game logic/events

var liveGames = {};

function joinGame(socket, nickname, gameId) {
    if (gameId in liveGames) {
        let g = liveGames[gameId];
        g.addPlr(socket.id, nickname);
        socket.join(gameId);

        catchupPlayer(gameId, socket.id);
    }
}

function catchupPlayer(gameId, plrId) {
    let g = liveGames[gameId];
    let p = g.getPlr(plrId);
    switch (g.getState()) {
        case 'ingame':
            if (p.isActive()) {
                if (p.isReady()) {
                    io.to(plrId).emit('take view', 'wait');
                } else {
                    servePlrStoryContent(plrId, g);
                }
            } else {
                io.to(plrId).emit('take view', 'wait');
            }
            break;
        case 'story-rollout':
            io.to(plrId).emit('take completed stories', g.stories, g.getStageLimit());
            for (let i = 0; i < g.stagesRevealed; i++) {
                io.to(plrId).emit('reveal next story stage');
            }
            break;
        default:
            io.to(plrId).emit('take view', 'lobby');
    }
    io.to(plrId).emit('set as host', g.hostId == plrId);
    updateGameInfoToPlrs(gameId);
}

function quitGame(socket, gameId) {
    if (gameId in liveGames) {
        let g = liveGames[gameId];
        socket.leave(gameId);

        let successorId = g.remPlr(socket.id);
        if (successorId.length > 0) {
            catchupPlayer(gameId, successorId);
        }

        io.to(socket.id).emit('take view', 'join');
        updateGameInfoToPlrs(gameId);

        if (g.hostId == '') {
            delete liveGames[gameId];
        }
    }
}

function updateGameInfoToPlrs(gameId) {
    let g = liveGames[gameId];
    io.to(gameId).emit('set room info', gameId, g.plrs, g.getOpenTurnOrder() >= 0);
}

function hostIdToGameId(hostId) {
    return 'game__' + hostId;
}

function advanceTurn(g) {
    let endNow = g.advanceTurn();

    if (endNow) {
        io.to(g.id).emit('take completed stories', g.stories, g.getStageLimit());
    } else {
        io.to(g.id).emit('set turn tickers', g.turns + 1, g.getStageLimit());
        for (let p in g.plrTurnOrder) {
            servePlrStoryContent(g.plrTurnOrder[p], g);
        }
    }
}

function servePlrStoryContent(plrId, game) {
    if (plrId.length > 0) {
        io.to(plrId).emit('take view', game.getCurrentView());
        io.to(plrId).emit('take story content', game.getCurrentStory(plrId));
    }
}

io.on('connection', (socket) => {
    socket.on('host game', (nick) => {
        let gameId = hostIdToGameId(socket.id);
        let g = new Room(gameId);
        liveGames[gameId] = g;
        joinGame(socket, nick, gameId);
    });
    socket.on('join game', (gameId, nick) => {
        joinGame(socket, nick, gameId);
    });
    socket.on('quit game', (gameId) => {
        quitGame(socket, gameId);
    });

    socket.on('start hosted game', (stageLimit) => {
        let g = liveGames[hostIdToGameId(socket.id)];
        g.setupGame(stageLimit);
        io.to(socket.id).emit('take story seeds', g.getNumActivePlrs());
    });

    socket.on('give story seeds', (seeds) => {
        let g = liveGames[hostIdToGameId(socket.id)];
        g.takeStorySeeds(seeds);
        advanceTurn(g);
    });

    socket.on('give story content', (gameId, c) => {
        let g = liveGames[gameId];
        g.takeCurrentStory(socket.id, c);
        g.uptickReady(socket.id);

        updateGameInfoToPlrs(gameId);

        if (g.areAllReady()) {
            advanceTurn(g);
        }
    });

    socket.on('begin restart', (gameId) => {
        let g = liveGames[gameId];
        g.restart();
        g.setupGame();
        io.to(g.hostId).emit('take story seeds', g.getNumActivePlrs());
    });

    socket.on('trigger story reveal', (gameId) => {
        liveGames[gameId].stagesRevealed++;
        io.to(gameId).emit('reveal next story stage');
    });

    socket.on('disconnecting', () => {
        const rooms = Object.keys(socket.rooms);
        for (let r in rooms) {
            let rId = rooms[r];
            quitGame(socket, rId);
        }
    });
});


// Start server

const port = 6465;
http.listen(port, () => {
    console.log('depicture open on port :' + port);
});