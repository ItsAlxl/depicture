var socket = io();

const APIHost = 'https://itsalxl.com/depicture-words';

// Views

var currentView = '';
function changeView(v) {
    if (currentView.length > 0) {
        $('#view-' + currentView).addClass('view-hidden');
    }
    $('#view-' + v).removeClass('view-hidden');
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


// Lobbying

var gameId;
function hostGame() {
    socket.emit('host game', $('#nick-name').val());
}

function joinGame() {
    socket.emit('join game', $('#join-code').val(), $('#nick-name').val());
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
        $('#host-start-btn').removeClass('view-hidden');
        $('#host-deck-selection').removeClass('view-hidden');

        $('#host-deck-selection').empty();
        console.log('OK here we go');
        appendLists(APIHost);
    } else {
        $('#host-start-btn').addClass('view-hidden');
        $('#host-deck-selection').addClass('view-hidden');
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
    console.log('serving seeds');
    console.log(seedDeck);
    let seeds = [];
    for (let i = 0; i < numPlrs; i++) {
        seeds.push(seedDeck.pop());
    }
    console.log(seeds);
    socket.emit('give story seeds', seeds);
}


// Playing the game

function submitDrawing() {
    var canvasData = document.getElementById('draw-canvas').toDataURL();
    socket.emit('give story content', gameId, canvasData);
    changeView('wait');
    clearCanvas();
}

function submitTitleGuess() {
    socket.emit('give story content', gameId, $('#picture-guess').val());
    changeView('wait');
    $('#picture-guess').val('');
}

socket.on('take completed stories', function (stories) {
    $('#ending-scroll').empty();
    changeView('end');

    let scrollHtml = '';
    for (let i = 0; i < stories.length; i++) {
        scrollHtml += '<div>'

        let s = stories[i];
        for (let j = 0; j < s.images.length + s.captions.length; j++) {
            let idx = Math.floor(j / 2);
            if (j % 2 == 0) {
                console.log(s.captions[idx]);
                scrollHtml += '<p>' + s.captions[idx] + '</p>';
            } else {
                console.log(s.images[idx]);
                scrollHtml += '<img id="display-img" width="480" height="384" class="art" src="' + s.images[idx] + '">';
            }
        }

        scrollHtml += '</div><br><br><br><br><br>';
    }

    $('#ending-scroll').html(scrollHtml);
});