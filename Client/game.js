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
        $('#display-img').attr('src', strokesToDataUrl(c));
    } else {
        $('#prompt-text').html(c);
    }
});

socket.on('set turn tickers', function (n, m) {
    $('#turn-counter').text(gameId + ' | ' + n + '/' + m);
});

var playerToNames = {};
socket.on('set room info', function (gid, ps, waitOnDc) {
    gameId = gid;
    $('#lobby-name').html(gid);
    $('#lobby-players').empty();
    $('#list-of-waiters').empty();
    for (let p in ps) {
        playerToNames[ps[p].id] = ps[p].nickname;
        $('#lobby-players').append($('<li>').text(ps[p].nickname));
        if (!ps[p].spectator && !ps[p].stageDone) {
            $('#list-of-waiters').append($('<li>').text(ps[p].nickname));
        }
    }
    if (waitOnDc) {
        $('#list-of-waiters').append($('<li>').text('A player has disconnected and must be replaced before continuing...'));
    }
});


// Lobbying

const DISABLE_ATTR_BADNAME = ['join-code', 'prompt-host', 'join-button', 'host-button'];
const DISABLE_CLASS_BADNAME = ['#join-code-header', '#prompt-source-header'];
function nicknameInput() {
    if (validateName()) {
        for (let AB in DISABLE_ATTR_BADNAME) {
            document.getElementById(DISABLE_ATTR_BADNAME[AB]).removeAttribute('disabled');
        }
        for (let CB in DISABLE_CLASS_BADNAME) {
            $(DISABLE_CLASS_BADNAME[CB]).removeClass('disabled');
        }
    } else {
        for (let AB in DISABLE_ATTR_BADNAME) {
            document.getElementById(DISABLE_ATTR_BADNAME[AB]).setAttribute('disabled', '');
        }
        for (let CB in DISABLE_CLASS_BADNAME) {
            $(DISABLE_CLASS_BADNAME[CB]).addClass('disabled');
        }
    }
}

var gameId;
var plrName;
var INPUT_RESTRICTIONS;

socket.on('apply input restrictions', function (IR) {
    INPUT_RESTRICTIONS = IR;
    $('#nick-name').attr('maxlength', IR['username']);
    $('#picture-guess').attr('maxlength', IR['prompt']);
});

function validateName() {
    let p = $('#nick-name').val().trim();
    if (p.length < 3) {
        return false;
    } else {
        plrName = p.substring(0, INPUT_RESTRICTIONS['username']);
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
    socket.emit('start hosted game', gameId, $('#stage-limit').val());
}

const HOST_EXCLUSIVES = ['#host-lobby-options', '#restart-game-btn', '#driver-reveal']
socket.on('set as host', function (asHost) {
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

var fullSeedDeck = [];
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
            fullSeedDeck.push(seeds[s]);
        }
    })
        .done(finishSeedSetup);
}

socket.on('take story seeds', function (nPlrs) {
    numPlrs = nPlrs;

    if (fullSeedDeck.length == 0) {
        let deckCheckboxes = document.getElementsByName('deck-cbox');
        let grabNames = [];
        for (let i = 0; i < deckCheckboxes.length; i++) {
            if (deckCheckboxes[i].checked) {
                grabNames.push(deckCheckboxes[i].value);
            }
        }
        populateSeeds(APIHost, grabNames);
    } else if (seedDeck.length == 0) {
        finishSeedSetup();
    } else {
        serveSeeds();
    }
});

function finishSeedSetup() {
    // Copy full deck
    seedDeck = fullSeedDeck.slice();
    // Shuffle (Durstenfeld / Fisher-Yates)
    for (let i = seedDeck.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        let temp = seedDeck[i];
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
    socket.emit('give story seeds', gameId, seeds);
}

function getPenColorChoiceHtml(name, lbl, value) {
    return `
    <input type="radio" id="pen-clr-${name}" name="pc" onclick="setPenColor('${value}');">
    <label for="pen-clr-${name}">${lbl}</label>`
}
function getPenWidthChoiceHtml(name, value) {
    return `
    <label for="pen-width-${value}">${name}</label>
    <input type="radio" id="pen-width-${value}" name="pw" onclick="setPenWidth(${value});">`
}

socket.on('take pen restrictions', function (penWidths, penColors, defWidth) {
    let clrListHtml = getPenColorChoiceHtml('black', 'black', '#000');
    for (let cName in penColors) {
        let lbl = cName.replace('-', ' ');
        lbl = lbl.replace('_', ' ');
        let c = penColors[cName];

        if (clrListHtml.length > 0) {
            clrListHtml += '\n<br>';
        }
        clrListHtml += getPenColorChoiceHtml(cName, lbl, c);
    }
    clrListHtml += '\n<br>' + getPenColorChoiceHtml('white', 'eraser', '#fff');
    $('#pen-color-list').html(clrListHtml);

    let widthListHtml = '';
    for (let w in penWidths) {
        let wName = penWidths[w];
        if (w == defWidth) {
            defaultPenWidthId = '#pen-width-' + w;
        }

        if (widthListHtml.length > 0) {
            widthListHtml += '\n<br>';
        }
        widthListHtml += getPenWidthChoiceHtml(wName, w);
    }
    $('#pen-size-list').html(widthListHtml);
});

// Playing the game

var defaultPenWidthId = '';
function resetDrawingOptions() {
    $(defaultPenWidthId).prop('checked', true);
    $(defaultPenWidthId).click();
    $('#pen-clr-black').prop('checked', true);
    $('#pen-clr-black').click();
}

function submitDrawing() {
    socket.emit('give story content', gameId, strokeHistory);
    changeView('wait');
    clearDrawCanvas(true);
}

function submitTitleGuess() {
    let caption = $('#picture-guess').val().trim();
    if (caption.length >= 3) {
        caption = caption.substring(0, INPUT_RESTRICTIONS['prompt']);
        socket.emit('give story content', gameId, caption);
        changeView('wait');
        $('#picture-guess').val('');
    }
}

socket.on('take completed stories', function (stories, numStages) {
    $('#ending-scroll').empty();
    changeView('end');

    // +1 for the beginning prompt
    numStages++;
    let scrollHtml = '';
    for (let i = 0; i < stories.length; i++) {
        scrollHtml += '<div>'

        let s = stories[i];
        for (let j = 0; j < numStages; j++) {
            let idx = Math.floor(j / 2);

            scrollHtml += '<span id="story-stage"><br><p>'
            if (j % 2 == 0) {
                if (j == 0) {
                    scrollHtml += 'The story began with:<br>';
                } else {
                    scrollHtml += s.owners[j - 1] + ' wrote:<br>';
                }
                scrollHtml += s.captions[idx];
            } else {
                scrollHtml += s.owners[j - 1] + ' drew:<br>';
                scrollHtml += '<img width="480" height="384" class="art" src="' + strokesToDataUrl(s.images[idx]) + '">';
            }
            scrollHtml += '</p>';
            if (j == numStages - 1) {
                scrollHtml += '<p>And that\'s how the story ended.</p><br><br><br>';
            } else {
                scrollHtml += '</span>';
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
    let stageChild = latestStage.get(0);
    if (stageChild) {
        latestStage.fadeIn('slow');
        latestStage.prop('id', '');

        if (document.getElementById('follow-ending-scroll').checked) {
            stageChild.scrollIntoView({ alignToTop: false, behavior: 'smooth' });
        }

        if (!$('#story-stage').get(0)) {
            document.getElementById('driver-reveal').setAttribute('disabled', '');
        }
    }
}

function restartGame() {
    document.getElementById('driver-reveal').removeAttribute('disabled');
    socket.emit('begin restart', gameId);
}
