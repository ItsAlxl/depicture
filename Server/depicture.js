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

function givePubServerList(socketRoom = 'unjoined-super-lobby') {
    let pubGames = [];
    for (let gid in liveGames) {
        let g = liveGames[gid];
        if (g.isPublic) {
            pubGames.push(g.getPublicInfo());
        }
    }
    io.to(socketRoom).emit('take pubgame list', pubGames);
}

function logNumGames() {
    givePubServerList();
    console.log('Number of running games: ' + getNumLiveGames());
}

function getNumLiveGames() {
    return Object.keys(liveGames).length;
}

function makeNewGame(gameId, game) {
    liveGames[gameId] = game;
    logNumGames();
}

function deleteGame(gameId) {
    delete liveGames[gameId];
    logNumGames();
}

function getGame(gameId) {
    return liveGames[gameId];
}

function joinGame(socket, nickname, gameId) {
    let g = getGame(gameId);
    if (g) {
        g.addPlr(socket.id, nickname.substring(0, INPUT_RESTRICTIONS['username']));
        socket.leave('unjoined-super-lobby');
        socket.join(gameId);

        io.to(socket.id).emit('take pen restrictions', g.allowedPenWidths, g.allowedPenClrs, g.defaultPenWidth);
        io.to(socket.id).emit('take gamemode settings', g.gameOpts);
        catchupPlayer(gameId, socket.id);
    }
}

function catchupPlayer(gameId, plrId) {
    let g = getGame(gameId);
    if (g) {
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
                showRollout(g, plrId);
                for (let i = 0; i < g.stagesRevealed; i++) {
                    io.to(plrId).emit('reveal next story stage');
                }
                break;
            default:
                io.to(plrId).emit('take view', 'lobby');
        }
        io.to(plrId).emit('set as host', g.hostId == plrId);

        updateGameInfoToPlrs(gameId);
        io.to(plrId).emit('set turn tickers', g.turns + 1, g.getStageLimit(), g.turnTimer.getMsRemaining());

        for (let i = 0; i < g.communalStrokes.length; i++) {
            io.to(plrId).emit('take communal stroke', g.communalStrokes[i]);
        }
    }
}

function showRollout(g, to = '') {
    if (to.length == 0) {
        to = g.id;
    }
    io.to(to).emit('take completed stories', g.stories, g.communalStrokes);
}

function quitGame(socket, gameId) {
    let g = getGame(gameId);
    if (g) {
        socket.leave(gameId);

        let successorId = g.remPlr(socket.id);
        if (successorId && successorId.length > 0) {
            catchupPlayer(gameId, successorId);
        }

        io.to(socket.id).emit('take view', 'join');
        updateGameInfoToPlrs(gameId);

        if (g.hostId == '') {
            deleteGame(gameId);
        }
    }
}

function updateGameInfoToPlrs(gameId) {
    let g = getGame(gameId);
    if (g) {
        io.to(gameId).emit('set room info', gameId, g.plrs, g.getOpenTurnOrder() >= 0);
    }
}

const CHAR_A = "A".charCodeAt(0);
const LENGTH_ALPHABET = 26;
function hostIdToGameId(hostId) {
    let hash = 0;
    for (let i = 0; i < hostId.length; i++) {
        let char = hostId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    let startingExtraChar = parseInt(String(Math.abs(hash)).substring(0, 2)) % LENGTH_ALPHABET;
    let sfx = startingExtraChar;
    let pfx = hostId.replace(/[^a-z]/gi, '').toUpperCase().substring(0, 4);

    let code = '';
    do {
        sfx = (sfx + 1) % LENGTH_ALPHABET;
        code = pfx + String.fromCharCode(sfx + CHAR_A);
        if (sfx == startingExtraChar) {
            pfx = code;
        }
    } while (code in liveGames);

    return code;
}

function advanceTurn(g, gt = -2) {
    if (gt < -1) {
        gt = g.turns;
    }
    let endNow = g.advanceTurn(gt);

    if (endNow) {
        g.downgradePlayers();
        updateGameInfoToPlrs(g.id);
        showRollout(g);
    } else {
        io.to(g.id).emit('set turn tickers', g.turns + 1, g.getStageLimit(), g.turnTimer.msDuration);
        for (let p in g.plrTurnOrder) {
            servePlrStoryContent(g.plrTurnOrder[p], g);
        }
        g.turnTimer.start();
    }
}

function forceTurnEnd(gid) {
    io.to(gid).emit('force turn end', true);
}

function requestPrompts(game, startGame = false) {
    io.to(game.hostId).emit('take story seeds', game.getPromptRequestNum(), startGame);
}

function servePlrStoryContent(plrId, game) {
    if (plrId.length > 0) {
        switch (game.gamemode) {
            case 'party':
                requestPrompts(game);

                if (plrId == game.getCurrentMainPlrId()) {
                    io.to(plrId).emit('take view', 'draw');
                    io.to(plrId).emit('take story content', game.getCurrentStage(plrId));
                } else {
                    io.to(plrId).emit('take view', 'caption');
                }
                break;
            default:
                io.to(plrId).emit('take view', game.getCurrentView());
                io.to(plrId).emit('take story content', game.getCurrentStage(plrId));
                break;
        }
    }
}

io.on('connection', (socket) => {
    socket.join('unjoined-super-lobby');
    givePubServerList(socket.id);
    io.to(socket.id).emit('apply input restrictions', INPUT_RESTRICTIONS);

    socket.on('host game', (nick, penClrs, penWidths, isPublic, turnOpts, gameOpts) => {
        if (nick.length >= 3) {
            let gameId = hostIdToGameId(socket.id);

            let g = new Room(gameId, penClrs, penWidths, isPublic, turnOpts, gameOpts);
            g.timerCallback = forceTurnEnd;
            g.addPlr(socket.id, nick.substring(0, INPUT_RESTRICTIONS['username']));
            makeNewGame(gameId, g);

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
        let g = getGame(gameId);
        if (g) {
            g.setupGame(stageLimit);
            requestPrompts(g, true);
        }
    });
    
    socket.on('give communal stroke', (gameId, s) => {
        let g = getGame(gameId);
        if (g) {
            g.communalStrokes.push(s);
            io.to(gameId).emit('take communal stroke', s);
        }
    });

    socket.on('give solo stroke', (gameId, s) => {
        let g = getGame(gameId);
        if (g) {
            io.to(gameId).emit('take solo stroke', s);
        }
    });

    socket.on('give solo redraw', (gameId, s) => {
        let g = getGame(gameId);
        if (g) {
            io.to(gameId).emit('take solo redraw', s);
        }
    });

    socket.on('correct my strokes', (gameId, strokes) => {
        let g = getGame(gameId);
        if (g) {
            g.correctStrokes(strokes);
            io.to(socket.id).emit('take corrected strokes', strokes);
        }
    });

    socket.on('give story content', (gameId, type, c, endsTurn) => {
        let g = getGame(gameId);
        if (g) {
            if (type == 'caption') {
                c = c.substring(0, INPUT_RESTRICTIONS['prompt']);
            }

            switch (g.gamemode) {
                case 'party':
                    if (type == 'caption') {
                        if (g.getCurrentMainSeedStage().compareCaption(c)) {
                            io.to(g.getCurrentMainPlrId()).emit('force turn end', false);
                        }
                        g.takeCurrentStory(g.getCurrentMainPlrId(), 'caption', c, socket.id, true);
                    }

                    if (socket.id == g.getCurrentMainPlrId()) {
                        g.takeCurrentStory(g.getCurrentMainPlrId(), 'draw', c, socket.id, true);
                        if (endsTurn) {
                            advanceTurn(g);
                        } else {
                            g.giveStoryPrompt(g.getCurrentMainStory());
                            io.to(socket.id).emit('take story content', g.getCurrentStage(socket.id));
                        }
                    }
                    break;
                default:
                    g.takeCurrentStory(socket.id, type, c);
                    g.uptickReady(socket.id);

                    updateGameInfoToPlrs(gameId);
        
                    let lastPlrId = g.getLastUnreadyPlrId();
                    if (lastPlrId == null) {
                        advanceTurn(g);
                    } else if (lastPlrId.length > 0) {
                        io.to(lastPlrId).emit('ding ding');
                    }
                    break;
            }
        }
    });

    socket.on('plr keeps playing', (gameId, playAgain) => {
        let g = getGame(gameId);
        if (g) {
            g.setPlayAgain(socket.id, playAgain);
            updateGameInfoToPlrs(gameId);
        }
    });

    socket.on('HOST: begin restart', (gameId) => {
        let g = getGame(gameId);
        if (g && g.hostId == socket.id) {
            g.restart();
            g.setupGame();
            io.to(gameId).emit('beginning restart');

            requestPrompts(g, true);
        }
    });

    socket.on('give story seeds', (gameId, seeds, startGame) => {
        let g = getGame(gameId);
        if (g) {
            g.takeStorySeeds(seeds);

            if (startGame) {
                advanceTurn(g, -1);
                for (let p in g.plrs) {
                    if (!g.plrs[p].isActive()) {
                        io.to(socket.id).emit('take view', 'wait');
                    }
                }
            }
        }
    });

    socket.on('trigger story reveal', (gameId) => {
        let g = getGame(gameId);
        if (g) {
            g.stagesRevealed++;
            io.to(gameId).emit('reveal next story stage');
        }
    });

    socket.on('set like stage', (gameId, storyIdx, stageIdx, liking) => {
        let g = getGame(gameId);
        if (g) {
            let s = g.stories[storyIdx].stages[stageIdx];
            if (liking) {
                s.addLike(socket.id);
            } else {
                s.remLike(socket.id);
            }

            io.to(gameId).emit('upd likes', storyIdx, stageIdx, s.getNumLikes());
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
    logNumGames();
});