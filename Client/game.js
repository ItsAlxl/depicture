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
    if (v == 'draw') {
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

var playerToNames = {};
socket.on('set player mapping', function (ps) {
    for (let p in ps) {
        playerToNames[ps[p].id] = ps[p].nickname;
    }
});

socket.on('player readiness update', function (pr) {
    $('#list-of-waiters').empty();
    for (let p in pr) {
        if (!pr[p]) {
            $('#list-of-waiters').append($('<li>').text(playerToNames[p]));
        }
    }
});


// Lobbying


function nicknameInput() {
	let nam = $('#nick-name').val();
	let jcin = $('#join-code');
	let prin = $('#prompt-host');
	if (nam.length > 0){
		document.getElementById("join-code").removeAttribute("disabled");
		document.getElementById("prompt-host").removeAttribute("disabled");
		document.getElementById("join-button").removeAttribute("disabled");
		document.getElementById("host-button").removeAttribute("disabled");	
		document.getElementById("join-code-header").setAttribute("style", "color:rgb(255, 182, 0)");
		document.getElementById("prompt-source-header").setAttribute("style", "color:rgb(255, 182, 0)");
	}
	else
	{
		document.getElementById("join-code").setAttribute("disabled", "");
		document.getElementById("prompt-host").setAttribute("disabled", "");
		document.getElementById("join-button").setAttribute("disabled", "");
		document.getElementById("host-button").setAttribute("disabled", "");
		document.getElementById("join-code-header").setAttribute("style", "color:Gray");
		document.getElementById("prompt-source-header").setAttribute("style", "color:Gray");
	}
	
}

var gameId;
var plrName;
function validateName() {
    let p = $('#nick-name').val().trim();
    if (p.length < 3) {
        return false;
    } else {
        plrName = p.substring(0, Math.min(25, p.length));
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
    socket.emit('start hosted game', $('#stage-limit').val());
}

socket.on('player movement', function (playerList) {
    $('#lobby-players').empty();
    for (let p in playerList) {
        $('#lobby-players').append($('<li>').text(playerList[p].nickname));
    }
});

const HOST_EXCLUSIVES = ['#host-lobby-options', '#restart-game-btn', '#driver-reveal']
socket.on('go to lobby', function (roomId, asHost) {
    gameId = roomId;
    $('#lobby-name').html(roomId);
    if (asHost) {
        for (let HE in HOST_EXCLUSIVES) {
            $(HOST_EXCLUSIVES[HE]).removeClass('invis-elm');
        }

        $('#host-deck-selection').empty();
        appendLists(APIHost);
    } else {
        for (let HE in HOST_EXCLUSIVES) {
            $(HOST_EXCLUSIVES[HE]).addClass('invis-elm');
        }
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
        caption = caption.substring(0, Math.min(100, caption.length));
        socket.emit('give story content', gameId, caption);
        changeView('wait');
        $('#picture-guess').val('');
    }
}

socket.on('take completed stories', function (stories, plrNamesInOrder, numStages) {
    $('#ending-scroll').empty();
    changeView('end');

    // +1 for the beginning prompt
    numStages++;
    let scrollHtml = '';
    let pidMax = plrNamesInOrder.length;
    for (let i = 0; i < stories.length; i++) {
        scrollHtml += '<div>'

        let s = stories[i];
        let pid = i;
        for (let j = 0; j < numStages; j++) {
            let idx = Math.floor(j / 2);

            scrollHtml += '<span id="story-stage"><br><br><p>'
            if (j % 2 == 0) {
                if (j == 0) {
                    scrollHtml += 'The story began with:<br>';
                } else {
                    scrollHtml += plrNamesInOrder[pid] + ' wrote:<br>';
                }
                scrollHtml += s.captions[idx];
            } else {
                scrollHtml += plrNamesInOrder[pid] + ' drew:<br>';
                scrollHtml += '<img width="480" height="384" class="art" src="' + s.images[idx] + '">';
            }
            scrollHtml += '</p>';
            if (j == numStages - 1) {
                scrollHtml += "<p>And that's how the story ended.</p><br><br><br>";
            } else {
                scrollHtml += '</span>';
            }

            if (j > 0) {
                pid = (pid + pidMax - 1) % pidMax;
            }
        }
        scrollHtml += '</div>';
    }

    $('#ending-scroll').html(scrollHtml);
});

function emitStoryReveal() {
    socket.emit('trigger story reveal', gameId);
}

socket.on('reveal next story stage', function () {
    revealNextStoryStage();
});

function revealNextStoryStage() {
    let latestStage = $('#story-stage');
    latestStage.fadeIn('slow');
    latestStage.prop('id', '');

    if (document.getElementById('follow-ending-scroll').checked) {
        latestStage.get(0).scrollIntoView({ alignToTop: false, behavior: "smooth" });
    }
}

function restartGame() {
    socket.emit('begin restart', gameId);
}