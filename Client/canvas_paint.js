// Canvas
var canvas = document.getElementById('draw-canvas');
var ctx = canvas.getContext('2d');

// Mouse tracking
var last_mouseX = last_mouseY = 0;
var mouseX = mouseY = 0;
var mousedown = false;

// Pen
var penColor = 'black';
var penWidth = 10;
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
        last_mouseX = mouseX = parseInt(e.clientX - canvas.getBoundingClientRect().left);
        last_mouseY = mouseY = parseInt(e.clientY - canvas.getBoundingClientRect().top);
        mousedown = true;
    }
});
$(canvas).on('mouseup', function (e) {
    if (e.button == 0) {
        mousedown = false;
    }
});

$(canvas).on('mousemove', function (e) {
    mouseX = parseInt(e.clientX - canvas.getBoundingClientRect().left);
    mouseY = parseInt(e.clientY - canvas.getBoundingClientRect().top);
    if (mousedown) {
        ctx.beginPath();

        ctx.strokeStyle = penColor;
        ctx.lineWidth = penWidth;

        ctx.moveTo(last_mouseX, last_mouseY);
        ctx.lineTo(mouseX, mouseY);
        ctx.lineJoin = ctx.lineCap = 'round';
        ctx.stroke();
    }
    last_mouseX = mouseX;
    last_mouseY = mouseY;
});