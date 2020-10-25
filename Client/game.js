var socket = io();

var APIHost = '';

var myDrawBoard = new HistoryDrawBoard(document.getElementById('draw-canvas'));
var groupDrawBoard = new PipedDrawBoard(document.getElementById('communal-canvas'));

connectDrawBoardEvents(myDrawBoard);
connectDrawBoardEvents(groupDrawBoard);

groupDrawBoard.addCallback(function (stroke) {
    socket.emit('give communal stroke', gameId, stroke);
});
myDrawBoard.addCallback(function () {
    lockDrawSubmit(true);
});

document.getElementById('group-pen-color').addEventListener('change', function (e) {
    groupDrawBoard.setPenColor(e.target.value);
});
document.getElementById('group-pen-width').addEventListener('change', function (e) {
    groupDrawBoard.setPenWidth(e.target.value);
});

// Views

var currentView = '';
function initViews() {
    changeView('join');

    addPenColorToList('Red', '#ff0000');
    addPenColorToList('Green', '#008000');
    addPenColorToList('Blue', '#0000ff');

    addPenWidthToList('Small', 7);
    addPenWidthToList('Medium', 11);
    addPenWidthToList('Large', 18);
    addPenWidthToList('Huge', 28);
    addPenWidthToList('Big Chungus', 75);

    nicknameInput();

    linkInputToButtonByIds('tline-join-code', 'btn-join');
    linkInputToButtonByIds('tline-picture-guess', 'btn-picture-guess');
}

function linkInputToButtonByIds(inputId, btnId) {
    linkInputToButton(document.getElementById(inputId), document.getElementById(btnId));
}
function linkInputToButton(input, btn) {
    input.addEventListener('keyup', e => {
        if (e.key == 'Enter') {
            btn.click();
            e.preventDefault();
        }
    });
}


function changeView(v) {
    if (currentView.length > 0) {
        $('#view-' + currentView).addClass('invis-elm');
    }
    $('#view-' + v).removeClass('invis-elm');
    currentView = v;

    if (v == 'draw') {
        resetDrawingOptions();
        lockDrawSubmit(true);
    }
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
    if (n == 1) {
        groupDrawBoard.clearBoard();
    }
    $('#turn-counter').text(gameId + ' | ' + n + '/' + m);
});

var playerToNames = {};
socket.on('set room info', function (gid, ps, waitOnDc) {
    gameId = gid;
    $('#lobby-name').html(gid);
    $('#lobby-players').empty();
    $('#list-of-waiters').empty();
    $('#restart-plrs-list').empty();
    for (let p in ps) {
        playerToNames[ps[p].id] = ps[p].nickname;
        $('#lobby-players').append($('<li>').text(ps[p].nickname));

        if (!ps[p].spectator) {
            let waitText = ' (...)';
            if (ps[p].stageDone) {
                waitText = ' (done!)';
            }
            $('#list-of-waiters').append($('<li>').text(ps[p].nickname + waitText));
        }

        let playAgainText = ' will play';
        if (ps[p].spectator) {
            playAgainText = ' will spectate';
        }
        $('#restart-plrs-list').append($('<div>').text(ps[p].nickname + playAgainText));
    }
    if (waitOnDc) {
        $('#list-of-waiters').append($('<li>').html('A player has disconnected and<br>must be replaced before continuing...'));
    }
});


// Pre-Lobby

function getPenColorChoiceHtml(name, lbl, value) {
    return `
    <input type="radio" id="pen-clr-${name}" name="pc" onclick="myDrawBoard.setPenColor('${value}');">
    <label for="pen-clr-${name}">${lbl}</label>`
}
function getPenWidthChoiceHtml(name, value) {
    return `
    <label for="pen-width-${value}">${name}</label>
    <input type="radio" id="pen-width-${value}" name="pw" onclick="myDrawBoard.setPenWidth(${value});">`
}

socket.on('take pen restrictions', function (penWidths, penColors, defWidth) {
    let clrListHtml = getPenColorChoiceHtml('black', 'black', '#000');
    for (let cName in penColors) {
        let lbl = cName.replace('_', ' ');
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

function generatePenList(name, valueType, value) {
    return `
    <li><input type="text" value="${name}"/> : <input type="${valueType}" value="${value}"/> <button onclick='removeFromPenList(this);'>X</button></li>`
}

function addPenColorToList(name = 'Yellow', value = '#e6e600') {
    $('#pen-color-define').append(generatePenList(name, 'color', value));
}

function addPenWidthToList(name = 'Fine', value = 5) {
    $('#pen-width-define').append(generatePenList(name, 'number', value));
}

function removeFromPenList(e) {
    let p = e.parentNode;
    p.parentNode.removeChild(p);
}

function getServerTupleHTML(gameId, hostName, extraBtnAttrs) {
    return `<button onclick='joinGameId(${gameId});' ${extraBtnAttrs}>Join</button> ${gameId} hosted by ${hostName}`;
}

socket.on('take pubgame list', function (pubGames) {
    $('#public-server-list').empty();
    let disableButton = document.getElementById('btn-join').disabled ? 'disabled' : '';
    for (let i = 0; i < pubGames.length; i++) {
        $('#public-server-list').append($('<li>').html(getServerTupleHTML(pubGames[i].gameId, pubGames[i].hostName, disableButton)));
    }
});

// Lobbying

function nicknameInput() {
    if (validateName()) {
        $('#pre-lobby-controls input, #pre-lobby-controls button').removeAttr('disabled');
        $('#pre-lobby-controls h4').removeClass('disabled');
    } else {
        $('#pre-lobby-controls input, #pre-lobby-controls button').attr('disabled', '');
        $('#pre-lobby-controls h4').addClass('disabled');
    }
}

var gameId;
var plrName;
var INPUT_RESTRICTIONS;

socket.on('apply input restrictions', function (IR) {
    INPUT_RESTRICTIONS = IR;
    $('#nick-name').attr('maxlength', IR['username']);
    $('#tline-picture-guess').attr('maxlength', IR['prompt']);
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

        let penClrs = {};
        let colorList = document.getElementById('pen-color-define').children;
        for (let i = 0; i < colorList.length; i++) {
            let ins = colorList[i].getElementsByTagName('input');
            if (ins.length > 0) {
                let key = ins[0].value;
                key = key.replace(' ', '_').toLowerCase();
                penClrs[key] = ins[1].value;
            }
        }

        let penWidths = {};
        let widthList = document.getElementById('pen-width-define').children;
        for (let i = 0; i < widthList.length; i++) {
            let ins = widthList[i].getElementsByTagName('input');
            if (ins.length > 0) {
                penWidths[ins[1].value] = ins[0].value;
            }
        }

        socket.emit('host game', plrName, penClrs, penWidths, document.getElementById('cbox-host-public').checked);
    }
}

function joinGame() {
    joinGameId($('#tline-join-code').val());
}

function joinGameId(gameId) {
    if (validateName()) {
        socket.emit('join game', gameId, plrName);
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


// Playing the game

var defaultPenWidthId = '';
function resetDrawingOptions() {
    $(defaultPenWidthId).prop('checked', true);
    $(defaultPenWidthId).click();
    $('#pen-clr-black').prop('checked', true);
    $('#pen-clr-black').click();
}

function lockDrawSubmit(l) {
    document.getElementById('cbox-verify-drawing').checked = !l;
    if (l) {
        document.getElementById('submit-drawing-btn').setAttribute('disabled', '');
    } else {
        document.getElementById('submit-drawing-btn').removeAttribute('disabled');
    }
}

function verifyDrawing() {
    document.getElementById('cbox-verify-drawing').checked = false;
    socket.emit('correct my strokes', gameId, myDrawBoard.strokeHistory);
}
socket.on('take corrected strokes', function (strokes) {
    myDrawBoard.strokeHistory = strokes;
    myDrawBoard.drawFromHistory();
    lockDrawSubmit(false);
});

function submitDrawing() {
    socket.emit('give story content', gameId, myDrawBoard.strokeHistory);
    changeView('wait');
    myDrawBoard.wipe(true);
}

function submitTitleGuess() {
    let caption = $('#tline-picture-guess').val().trim();
    if (caption.length >= 3) {
        caption = caption.substring(0, INPUT_RESTRICTIONS['prompt']);
        socket.emit('give story content', gameId, caption);
        changeView('wait');
        $('#tline-picture-guess').val('');
    }
}

socket.on('take communal stroke', function (stroke) {
    drawStrokeOnCtx(groupDrawBoard.drawCtx, stroke);
});

socket.on('take completed stories', function (stories, numStages) {
    $('#ending-scroll').empty();
    changeView('end');
    document.getElementById('cbox-keep-playing').checked = false;

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
    scrollHtml += '<div id="story-stage">As a community, we made this:<br>';
    scrollHtml += '<img width="720" height="576" class="art" src="' + groupDrawBoard.drawCanvas.toDataURL() + '"></div>';

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
    let stageDOM = latestStage.get(0);
    if (stageDOM) {
        latestStage.fadeIn('slow');
        latestStage.prop('id', '');

        if (document.getElementById('cbox-follow-end-scroll').checked) {
            stageDOM.scrollIntoView({ alignToTop: false, behavior: 'smooth' });
        }

        if (!document.getElementById('story-stage')) {
            document.getElementById('driver-reveal').setAttribute('disabled', '');
            document.getElementById('restart-game-btn').removeAttribute('disabled');
        }
    }
}

function togglePlayAgain() {
    socket.emit('plr keeps playing', gameId, document.getElementById('cbox-keep-playing').checked);
}

function restartGame() {
    document.getElementById('driver-reveal').removeAttribute('disabled');
    document.getElementById('restart-game-btn').setAttribute('disabled', '');
    socket.emit('begin restart', gameId);
}
