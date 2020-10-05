var socket = io();

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
    } else {
        $('#host-start-btn').addClass('view-hidden');
    }
    changeView('lobby');
});


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
    changeView('end');

    let scrollHtml = '';
    for (let i = 0; i < stories.length; i++) {
        scrollHtml += "<div>"

        let s = stories[i];
        for (let j = 0; j < s.images.length + s.captions.length; j++) {
            let idx = Math.floor(j / 2);
            if (j % 2 == 0) {
                console.log(s.captions[idx]);
                scrollHtml += "<p>" + s.captions[idx] + "</p>";
            } else {
                console.log(s.images[idx]);
                scrollHtml += "<img id=\"display-img\" width=\"480\" height=\"384\" class=\"art\" src=\"" + s.images[idx] + "\">";
            }
        }

        scrollHtml += "</div><br><br><br><br><br>";
    }

    $('#ending-scroll').html(scrollHtml);
});