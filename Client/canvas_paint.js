// Canvas
var canvas = document.getElementById('draw-canvas');
var ctx = canvas.getContext('2d');

// Pen tracking
var last_penX = last_penY = 0;
var penX = penY = 0;
var penDrawing = false;

// Pen properties
var penColor = 'white';
var penWidth = 0;
function setPenWidth(w) {
    penWidth = w;
}
function setPenColor(c) {
    penColor = c;
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

$(canvas).on('mousedown', function (e) {
    if (e.button == 0) {
        startDrawing(e.clientX, e.clientY);
    }
});
$(canvas).on('mouseleave', function () {
    resetPenPosition();
});
$(document).on('mouseup', function (e) {
    if (e.button == 0) {
        stopDrawing();
    }
});
$(canvas).on('mousemove', function (e) {
    movePen(e.clientX, e.clientY);
});

$(canvas).on('touchstart', function (e) {
    let t = (e.touches || [])[0] || {};
    startDrawing(t.clientX, t.clientY);
});
$(document).on('touchend', function (e) {
    stopDrawing();
});
$(canvas).on('touchmove', function (e) {
    let t = (e.touches || [])[0] || {};
    movePen(t.clientX, t.clientY);
});

function startDrawing(atX, atY) {
    last_penX = penX = parseInt(atX - canvas.getBoundingClientRect().left);
    last_penY = penY = parseInt(atY - canvas.getBoundingClientRect().top);
    penDrawing = true;
    movePen(atX, atY);
}

function stopDrawing() {
    penDrawing = false;
}

function resetPenPosition() {
    last_penX = -1;
    last_penY = -1;
}

function movePen(toX, toY) {
    penX = parseInt(toX - canvas.getBoundingClientRect().left);
    penY = parseInt(toY - canvas.getBoundingClientRect().top);
    if (penDrawing) {
        ctx.beginPath();

        ctx.strokeStyle = penColor;
        ctx.lineWidth = penWidth;

        if (last_penX >= 0 && last_penX >= 0) {
            ctx.moveTo(last_penX, last_penY);
            ctx.lineTo(penX, penY);
            ctx.lineJoin = ctx.lineCap = 'round';
            ctx.stroke();
        }
    }
    last_penX = penX;
    last_penY = penY;
}
