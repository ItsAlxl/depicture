const { Room } = require('./GameComponents.js');

var path = require('path');
var express = require('express');

var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var clientDir = path.join(__dirname, '../Client');


// Serve public web files

app.use(express.static(clientDir))
app.get('/', (req, res) => {
    res.sendFile(clientDir + '/game.html');
});


// Game logic/events

var liveGames = {};
const INPUT_RESTRICTIONS = {
    'username': 25,
    'prompt': 150
};

function joinGame(socket, nickname, gameId) {
    if (gameId in liveGames) {
        let g = liveGames[gameId];
        g.addPlr(socket.id, nickname.substring(0, INPUT_RESTRICTIONS['username']));
        socket.join(gameId);

        catchupPlayer(gameId, socket.id);
        io.to(socket.id).emit('take pen restrictions', g.allowedPenWidths, g.allowedPenClrs, g.defaultPenWidth);
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
        if (successorId && successorId.length > 0) {
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
    let hash = 0;
    for (let i = 0; i < hostId.length; i++) {
      let char = hostId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    hash = Math.abs(hash) + '';

    let code = hash.substring(hash.length - 4);
    let idx = 0;
    while (code in liveGames && idx < hostId.length) {
        code += hostId[idx];
        idx++;
    }
    if (!(code in liveGames)) {
        return code;
    }
    
    idx = 0;
    while ((code + idx) in liveGames) {
        idx++;
    }
    return code + idx;
}

function advanceTurn(g, gt = -2) {
    if (gt < -1) {
        gt = g.turns;
    }
    let endNow = g.advanceTurn(gt);

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
    io.to(socket.id).emit('apply input restrictions', INPUT_RESTRICTIONS);

    socket.on('host game', (nick) => {
        if (nick.length >= 3) {
            let gameId = hostIdToGameId(socket.id);
            let g = new Room(gameId);
            liveGames[gameId] = g;
            joinGame(socket, nick, gameId);
        }
    });
    socket.on('join game', (gameId, nick) => {
        if (nick.length >= 3) {
            joinGame(socket, nick, gameId);
        }
    });
    socket.on('quit game', (gameId) => {
        quitGame(socket, gameId);
    });

    socket.on('start hosted game', (gameId, stageLimit) => {
        let g = liveGames[gameId];
        g.setupGame(stageLimit);
        io.to(socket.id).emit('take story seeds', g.getNumActivePlrs());
    });

    socket.on('give story seeds', (gameId, seeds) => {
        let g = liveGames[gameId];
        g.takeStorySeeds(seeds);
        advanceTurn(g, -1);
    });

    socket.on('give story content', (gameId, c) => {
        let g = liveGames[gameId];

        if (g.getCurrentView() == 'caption') {
            c = c.substring(0, INPUT_RESTRICTIONS['prompt']);
        }
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