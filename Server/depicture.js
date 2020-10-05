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
        io.to(socket.id).emit('go to lobby', gameId, g.hostId == socket.id);
        io.to(gameId).emit('player movement', g.plrs);
    }
}

function quitGame(socket, gameId) {
    if (gameId in liveGames) {
        let g = liveGames[gameId];
        socket.leave(gameId);
        g.remPlr(socket.id);

        io.to(socket.id).emit('take view', 'join');
        io.to(gameId).emit('player movement', g.plrs);
    }
}

function hostIdToGameId(hostId) {
    return 'game__' + hostId;
}

function advanceTurn(g) {
    let endNow = g.advanceTurn();

    if (!endNow) {
        let v = g.getCurrentView();

        io.to(g.id).emit('take view', v);
        for (let p in g.plrs) {
            io.to(p).emit('take story content', g.getCurrentStory(p));
        }
    } else {
        io.to(g.id).emit('take completed stories', g.stories);
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

    socket.on('start hosted game', () => {
        let g = liveGames[hostIdToGameId(socket.id)];
        g.setupGame();
        advanceTurn(g);
    });

    socket.on('give story content', (gameId, c) => {
        let g = liveGames[gameId];
        g.takeCurrentStory(socket.id, c);
        g.uptickReady();
        if (g.areAllReady()) {
            advanceTurn(g);
        }
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