class PenStroke {
    width;
    color;
    points = [];

    constructor(width, color) {
        this.width = width;
        this.color = color;
    }

    addPoint(x, y) {
        this.points.push({
            'x': x,
            'y': y
        });
    }
}

// Canvas
var drawCanvas = document.getElementById('draw-canvas');
var drawCtx = drawCanvas.getContext('2d');

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

function clearDrawCanvas(deepHistoryCleanse = false) {
    clearCanvas(drawCanvas);
    resetStrokeHistory(deepHistoryCleanse);
}

function clearCanvas(clearCanvas) {
    drawCtx.clearRect(0, 0, clearCanvas.width, clearCanvas.height);
}

function resetStrokeHistory(deep = false) {
    if (deep) {
        strokeHistory.length = 0;
        strokeHistoryHistory.length = 0;
    } else {
        strokeHistoryHistory.push(strokeHistory);
        strokeHistory = [];
    }
}

$(drawCanvas).on('mousedown', function (e) {
    if (e.button == 0) {
        startDrawing(e.clientX, e.clientY);
    }
});
$(drawCanvas).on('mouseleave', function () {
    resetPenPosition();
});
$(document).on('mouseup', function (e) {
    if (e.button == 0) {
        stopDrawing();
    }
});
$(drawCanvas).on('mousemove', function (e) {
    movePen(e.clientX, e.clientY);
});

$(drawCanvas).on('touchstart', function (e) {
    let t = (e.touches || [])[0] || {};
    startDrawing(t.clientX, t.clientY);
});
$(document).on('touchend', function (e) {
    stopDrawing();
});
$(drawCanvas).on('touchmove', function (e) {
    let t = (e.touches || [])[0] || {};
    movePen(t.clientX, t.clientY);
});

var strokeHistory = [];
var strokeHistoryHistory = [];

function getLatestStroke() {
    return strokeHistory[strokeHistory.length - 1];
}

function startDrawing(atX, atY) {
    strokeHistory.push(new PenStroke(penWidth, penColor));

    last_penX = penX = correctCanvasX(drawCanvas, atX);
    last_penY = penY = correctCanvasY(drawCanvas, atY);
    penDrawing = true;
    movePen(atX, atY);
}

function stopDrawing() {
    penDrawing = false;
}

function resetPenPosition() {
    last_penX = -1;
    last_penY = -1;

    let latestStroke = getLatestStroke();
    if (latestStroke) {
        latestStroke.addPoint(last_penX, last_penY);
    }
}

function drawUndo() {
    if (strokeHistory.length > 0) {
        strokeHistory.pop();
    } else {
        if (strokeHistoryHistory.length > 0) {
            strokeHistory = strokeHistoryHistory.pop();
        } else {
            return;
        }
    }
    clearCanvas(drawCanvas);
    drawFromStrokes(drawCanvas, strokeHistory);
}

function _drawLineOnCtx(ctx, aX, aY, bX, bY) {
    ctx.beginPath();
    ctx.moveTo(aX, aY);
    ctx.lineTo(bX, bY);
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.stroke();
}

function correctCanvasX(canvas, x) {
    return x - canvas.getBoundingClientRect().left;
}
function correctCanvasY(canvas, y) {
    return y - canvas.getBoundingClientRect().top;
}

function movePen(toX, toY) {
    penX = correctCanvasX(drawCanvas, toX);
    penY = correctCanvasY(drawCanvas, toY);
    if (penDrawing) {
        let latestStroke = getLatestStroke();

        drawCtx.lineWidth = latestStroke.width;
        drawCtx.strokeStyle = latestStroke.color;

        if (last_penX >= 0 && last_penX >= 0) {
            _drawLineOnCtx(drawCtx, last_penX, last_penY, penX, penY);
            latestStroke.addPoint(penX, penY);
        }
    }
    last_penX = penX;
    last_penY = penY;
}

function drawFromStrokes(canvas, strokes) {
    let ctx = canvas.getContext('2d');
    for (let i in strokes) {
        let s = strokes[i];

        ctx.lineWidth = s.width;
        ctx.strokeStyle = s.color;

        let lastPoint = null;
        for (let j in s.points) {
            let p = s.points[j];
            if (p.x >= 0 && p.y >= 0) {
                if (lastPoint == null) {
                    _drawLineOnCtx(ctx, p.x, p.y, p.x, p.y);
                } else if (lastPoint.x >= 0 && lastPoint.y >= 0) {
                    _drawLineOnCtx(ctx, lastPoint.x, lastPoint.y, p.x, p.y);
                }
            }
            lastPoint = p;
        }
    }
}

function strokesToDataUrl(strokes) {
    let c = document.createElement('canvas');
    c.width = drawCanvas.width;
    c.height = drawCanvas.height;
    drawFromStrokes(c, strokes);
    let d = c.toDataURL();
    console.log(d);
    return d;
}