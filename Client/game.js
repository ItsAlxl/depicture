var socket = io();

var APIHost = '';

// Views

var currentView = '';
function initViews() {
    changeView('join');
}

function changeView(v) {
    if (currentView.length > 0) {
        $('#view-' + currentView).addClass('invis-elm');
    }
    if (v == "draw") {
        resetDrawingOptions();
    }
    $('#view-' + v).removeClass('invis-elm');
    currentView = v;
}

socket.on('take view', function (v) {
    changeView(v);
});

socket.on('take story content', function (c) {
    if (currentView == 'caption') {
        $('#display-img').attr('src', c);
    } else {
        $('#prompt-text').html(c);
    }
});

socket.on('set turn tickers', function (n, m) {
    let tickers = document.getElementsByClassName('turn-counter');
    for (let t in tickers) {
        tickers[t].textContent = n + '/' + m;
    }
});


// Lobbying

var gameId;
var plrName;
function validateName() {
    let p = $('#nick-name').val().trim();
    if (p.length < 3) {
        return false;
    } else {
        plrName = p.substring(0, Math.min(20, p.length));
        return true;
    }
}

function hostGame() {
    if (validateName()) {
        APIHost = $('#prompt-host').val();
        socket.emit('host game', plrName);
    }
}

function joinGame() {
    if (validateName()) {
        socket.emit('join game', $('#join-code').val(), plrName);
    }
}

function startHostedGame() {
    socket.emit('start hosted game');
}

socket.on('player movement', function (playerList) {
    $('#lobby-players').empty();
    for (let p in playerList) {
        $('#lobby-players').append($('<li>').text(playerList[p].nickname));
    }
});

socket.on('go to lobby', function (roomId, asHost) {
    gameId = roomId;
    $('#lobby-name').html(roomId);
    if (asHost) {
        $('#host-start-btn').removeClass('invis-elm');
        $('#host-deck-selection').removeClass('invis-elm');
        $('#restart-game-btn').removeClass('invis-elm');

        $('#host-deck-selection').empty();
        appendLists(APIHost);
    } else {
        $('#host-start-btn').addClass('invis-elm');
        $('#host-deck-selection').addClass('invis-elm');
        $('#restart-game-btn').addClass('invis-elm');
    }
    changeView('lobby');
});

function getListCheckboxHTML(listName) {
    return `
    <input type="checkbox" name="deck-cbox" id="${listName}" value="${listName}">
    <label for="${listName}">${listName}</label><br>`;
}

function ensureEndingSlash(s) {
    if (!s.endsWith('/')) {
        s += '/';
    }
    return s;
}

function appendLists(fromHost) {
    fromHost = ensureEndingSlash(fromHost);

    $.getJSON(fromHost + 'names.php', function (listNames) {
        for (let n in listNames) {
            $('#host-deck-selection').append(getListCheckboxHTML(listNames[n]));
        }
    });
}

var seedDeck = [];
var numPlrs = -1;
function populateSeeds(fromHost, nameArray) {
    fromHost = ensureEndingSlash(fromHost);

    let query = '?';
    for (let i = 0; i < nameArray.length; i++) {
        if (i > 0) {
            query += '&';
        }
        query += 'n[]=' + nameArray[i];
    }

    $.getJSON(fromHost + 'lists.php' + query, function (seeds) {
        for (let s in seeds) {
            seedDeck.push(seeds[s]);
        }
    })
        .done(finishSeedSetup);
}

socket.on('take story seeds', function (nPlrs) {
    numPlrs = nPlrs;

    if (seedDeck.length == 0) {
        let deckCheckboxes = document.getElementsByName('deck-cbox');
        let grabNames = [];
        for (let i = 0; i < deckCheckboxes.length; i++) {
            if (deckCheckboxes[i].checked) {
                grabNames.push(deckCheckboxes[i].value);
            }
        }
        populateSeeds(APIHost, grabNames);
    } else {
        serveSeeds();
    }
});

function finishSeedSetup() {
    // Shuffle (Durstenfeld / Fisher-Yates)
    for (var i = seedDeck.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = seedDeck[i];
        seedDeck[i] = seedDeck[j];
        seedDeck[j] = temp;
    }
    serveSeeds();
}

function serveSeeds() {
    let seeds = [];
    for (let i = 0; i < numPlrs; i++) {
        seeds.push(seedDeck.pop());
    }
    socket.emit('give story seeds', seeds);
}


// Playing the game

function resetDrawingOptions() {
    $('#pen-med').prop('checked', true);
    $('#pen-med').click();
    $('#pen-black').prop('checked', true);
    $('#pen-black').click();
}

function submitDrawing() {
    var canvasData = document.getElementById('draw-canvas').toDataURL();
    socket.emit('give story content', gameId, canvasData);
    changeView('wait');
    clearCanvas();
}

function submitTitleGuess() {
    let caption = $('#picture-guess').val().trim();
    if (caption.length >= 3) {
        caption = caption.substring(0, Math.min(50, caption.length));
        socket.emit('give story content', gameId, caption);
        changeView('wait');
        $('#picture-guess').val('');
    }
}

socket.on('take completed stories', function (stories, plrNamesInOrder) {
    $('#ending-scroll').empty();
    changeView('end');

    let scrollHtml = '';
    let storyLength = stories[0].images.length + stories[0].captions.length;
    let pidMax = plrNamesInOrder.length;
    for (let i = 0; i < stories.length; i++) {
        scrollHtml += '<div>'

        let s = stories[i];
        let pid = i;
        for (let j = 0; j < storyLength; j++) {
            let idx = Math.floor(j / 2);

            scrollHtml += '<p>'
            if (j % 2 == 0) {
                if (j == 0) {
                    scrollHtml += 'Starting prompt:<br>';
                } else {
                    scrollHtml += plrNamesInOrder[pid] + ' wrote:<br>';
                }
                scrollHtml += s.captions[idx];
            } else {
                scrollHtml += plrNamesInOrder[pid] + ' drew:<br>';
                scrollHtml += '<img id="display-img" width="480" height="384" class="art" src="' + s.images[idx] + '">';
            }
            scrollHtml += '</p>'
            if (j > 0) {
                pid = (pid + pidMax - 1) % pidMax;
            }
        }
        scrollHtml += '</div><br><br><br><br><br>';
    }

    $('#ending-scroll').html(scrollHtml);
});

function restartGame() {
    socket.emit('begin restart', gameId);
}