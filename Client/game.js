var socket = io();

var APIHost = '';

var myDrawBoard = new HistoryDrawBoard(document.getElementById('draw-canvas'));
var groupDrawBoard = new PipedDrawBoard(document.getElementById('communal-canvas'));
var groupDisplayBoard = new HistoryDrawBoard(document.getElementById('communal-display'));

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
    applyMasterVolume();

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

socket.on('take view', changeView);
function changeView(v) {
    if (currentView.length > 0) {
        $('#view-' + currentView).addClass('invis-elm');
    }
    $('#view-' + v).removeClass('invis-elm');
    currentView = v;

    groupDrawBoard.stopDrawing();
    if (['draw', 'caption', 'wait'].includes(v)) {
        if (v == 'draw') {
            resetDrawingOptions();
            lockDrawSubmit(true);
        }

        $('#ingame-header').removeClass('invis-elm');
        document.getElementById('last-plr-warning').innerHTML = '---';
    } else {
        $('#ingame-header').addClass('invis-elm');
    }
}

socket.on('take story content', function (s) {
    if (currentView == 'caption') {
        $('#display-img').attr('src', strokesToDataUrl(s.content));
    } else {
        $('#prompt-text').html(s.content);
    }
});

socket.on('set turn tickers', function (n, m) {
    if (n > 0) {
        $('#turn-counter').text(gameId + ' | ' + n + '/' + m);

        if (n == 1) {
            groupDrawBoard.clearBoard();
        }
    }
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

        let spectateNext = ps[p].spectator;
        let playAgainText = spectateNext ? ' will spectate' : ' will play';
        let playAgainColor = spectateNext ? 'bad' : 'good';
        $('#restart-plrs-list').append($('<div>').text(ps[p].nickname + playAgainText).attr('style', 'color: var(--' + playAgainColor + ');'));
    }
    if (waitOnDc) {
        $('#list-of-waiters').append($('<li>').html('A player has disconnected and<br>must be replaced before continuing...'));
    }
});

var dingdingSound = new Audio('ding_ding.ogg');
function applyMasterVolume() {
    dingdingSound.volume = document.getElementById('slider-master-vol').value;
}

function getAccordionBtnHtml(id, text) {
    return `
    <button id=${'btn-accordion-' + id} onclick="accordion('${id}');">${text}</button>`;
}

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

socket.on('take gamemode settings', function (blindDrawing) {
    myDrawBoard.blind = blindDrawing;
    if (blindDrawing) {
        myDrawBoard.drawCanvas.classList.add('blinded');
    }
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

function getServerTupleHTML(dispGameId, hostName, extraBtnAttrs) {
    return `<button onclick="joinGameId('${dispGameId}');" ${extraBtnAttrs}>Join</button> ${dispGameId} hosted by ${hostName}`;
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

        socket.emit('host game', plrName, penClrs, penWidths,
            document.getElementById('cbox-host-public').checked,
            document.getElementById('cbox-shuffle-turn-order').checked,
            document.getElementById('cbox-linear-order').checked,
            document.getElementById('cbox-draw-blindly').checked);
    }
}

function joinGame() {
    joinGameId($('#tline-join-code').val());
}

function joinGameId(gId) {
    if (validateName()) {
        socket.emit('join game', gId, plrName);
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
    let cbox = document.getElementById('cbox-verify-drawing');
    if (cbox.checked) {
        socket.emit('correct my strokes', gameId, myDrawBoard.strokeHistory);
    } else {
        lockDrawSubmit(true);
    }
    document.getElementById('cbox-verify-drawing').checked = false;
}
socket.on('take corrected strokes', function (strokes) {
    myDrawBoard.strokeHistory = strokes;
    myDrawBoard.drawFromHistory();
    lockDrawSubmit(false);
});

socket.on('ding ding', function () {
    document.getElementById('last-plr-warning').innerHTML = 'You are the last player to finish!';
    dingdingSound.play();
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

socket.on('take communal stroke', drawCommunalStroke);
function drawCommunalStroke(s) {
    drawStrokeOnCtx(groupDrawBoard.drawCtx, s);
}

const STORY_START_TEXT = 'The story began with';
socket.on('take completed stories', function (stories, numStages, commStrokes = []) {
    $('#ending-scroll').empty();
    changeView('end');
    document.getElementById('cbox-keep-playing').checked = false;

    // +1 for the beginning prompt
    numStages++;
    let scrollHtml = '';
    for (let storyIdx = 0; storyIdx < stories.length; storyIdx++) {
        scrollHtml += '<div>'

        let story = stories[storyIdx];
        let stages = story.stages;
        for (let stageIdx = 0; stageIdx < stages.length; stageIdx++) {
            let s = stages[stageIdx];
            scrollHtml += '<span class="story-stage"><br><p>'

            let introText;
            if (stageIdx == 0) {
                introText = STORY_START_TEXT;
            } else {
                introText = s.owner;
                if (s.type == 'caption') {
                    introText += ' wrote';
                } else {
                    introText += ' drew';
                }
            }
            scrollHtml += introText + ':<br>';

            if (s.type == 'caption') {
                scrollHtml += s.content;
            } else {
                scrollHtml += '<img width="480" height="384" class="art" src="' + strokesToDataUrl(s.content) + '">';
            }

            if (introText != STORY_START_TEXT) {
                scrollHtml += getLikeHtml(storyIdx, stageIdx);
            }
            scrollHtml += '</p>';

            if (stageIdx == numStages - 1) {
                scrollHtml += '<p>And that\'s how the story ended.</p><br><br><br>';
            } else {
                scrollHtml += '</span>';
            }
        }
        scrollHtml += '</div>';
    }

    if (commStrokes.length > 0) {
        scrollHtml += '<div class="story-stage">As a community, we made this:</div>';
        groupDisplayBoard.wipe(true);
        commStrokes.reverse();
    }
    groupDisplayBoard.undoHistory = commStrokes;

    $('#ending-scroll').html(scrollHtml);
});

function getLikeHtml(storyIdx, stageIdx) {
    let btnId = getLikeId('btn', storyIdx, stageIdx);
    let cntId = getLikeId('cnt', storyIdx, stageIdx);
    return `
    <div id="likes" class="accordion-target">
        <img class="like-button" src="like_off.png" id="${btnId}" onclick="likeStage(${storyIdx}, ${stageIdx});">
        <span class="like-counter" id="${cntId}">0</span>
    </div>`;
}

function getLikeId(type, storyIdx, stageIdx) {
    return 'like' + type + storyIdx + '-' + stageIdx;
}

function likeStage(storyIdx, stageIdx) {
    let img = document.getElementById(getLikeId('btn', storyIdx, stageIdx));
    let cnt = document.getElementById(getLikeId('cnt', storyIdx, stageIdx));

    let liking = !cnt.classList.contains('like-counter-on');
    if (liking) {
        img.src = 'like_on.png';
        cnt.classList.add('like-counter-on');
    } else {
        img.src = 'like_off.png';
        cnt.classList.remove('like-counter-on');
    }
    socket.emit('set like stage', gameId, storyIdx, stageIdx, liking);
}

socket.on('upd likes', function (storyIdx, stageIdx, numLikes) {
    document.getElementById(getLikeId('cnt', storyIdx, stageIdx)).innerText = numLikes;
});

function emitStoryReveal() {
    socket.emit('trigger story reveal', gameId);
}

socket.on('reveal next story stage', function () {
    revealNextStoryStage();
});

function revealNextStoryStage() {
    let latestStage = $('.story-stage').first();
    let stageDOM = latestStage.get(0);
    if (stageDOM) {
        latestStage.fadeIn('slow');
        latestStage.removeClass('story-stage');

        if (document.getElementById('cbox-follow-end-scroll').checked) {
            stageDOM.scrollIntoView({ alignToTop: false, behavior: 'smooth' });
        }
    } else {
        // If no more stages, reveal communal board (if applicable)
        if (groupDisplayBoard.undoHistory.length > 0) {
            let calcStep = MAX_COMM_REVEAL_WHOLE_TIME / groupDisplayBoard.undoHistory.length;
            if (calcStep < 1) {
                commStepTime = 1;
                commEveryOther = Math.round(1 / calcStep);
            } else {
                commStepTime = Math.min(Math.round(calcStep), MAX_COMM_REVEAL_STEP_TIME);
            }

            document.getElementById('communal-disp-container').appendChild(document.getElementById('moving-communal-container'));
            groupDisplayBoard.drawCanvas.scrollIntoView({ alignToTop: false, behavior: 'smooth' });
            revealCommunalStep(groupDisplayBoard.undoHistory.length);
        }

        document.getElementById('driver-reveal').setAttribute('disabled', '');
        document.getElementById('restart-game-btn').removeAttribute('disabled');
    }
}

const MAX_COMM_REVEAL_WHOLE_TIME = 7500;
const MAX_COMM_REVEAL_STEP_TIME = 100;
let commStepTime = 0;
let commEveryOther = 0;
function revealCommunalStep(idx) {
    let delay = commEveryOther <= 0 || idx % commEveryOther == 0 ? commStepTime : 0;
    setTimeout(function () {
        groupDisplayBoard.redo();

        idx--;
        if (idx > 0) {
            revealCommunalStep(idx);
        } else {
            revealCommunalTimeline();
        }
    }, delay)
}

let commTimelineSlider = document.getElementById('slider-communal-timeline');
function revealCommunalTimeline() {
    $('#slider-communal-timeline').fadeIn('slow');
    commTimelineSlider.max = groupDisplayBoard.strokeHistory.length;
    commTimelineSlider.value = commTimelineSlider.max;
}

function togglePlayAgain() {
    socket.emit('plr keeps playing', gameId, document.getElementById('cbox-keep-playing').checked);
}

function restartGame() {
    socket.emit('HOST: begin restart', gameId);
}

socket.on('beginning restart', function () {
    document.getElementById('driver-reveal').removeAttribute('disabled');
    document.getElementById('restart-game-btn').setAttribute('disabled', '');

    let dispContainer = $('#communal-disp-container');
    dispContainer.fadeOut(1);
    dispContainer.addClass('story-stage');

    document.getElementById('hidden-stash').appendChild(document.getElementById('moving-communal-container'));
    $('#slider-communal-timeline').fadeOut(1);
    commTimelineSlider.value = 0;
    commTimelineSlider.max = 0;
});