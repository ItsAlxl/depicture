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

class DrawBoard {
    drawCanvas;
    drawCtx;

    last_penX = 0;
    last_penY = 0;
    penX = 0;
    penY = 0;
    penDrawing = false;

    penColor = 'black';
    penWidth = 15;

    currentStroke = null;

    constructor(canvas) {
        this.drawCanvas = canvas;
        this.drawCtx = this.drawCanvas.getContext('2d');
    }

    setPenWidth(w) {
        this.penWidth = w;
    }
    setPenColor(c) {
        this.penColor = c;
    }

    correctCanvasX(x) {
        return x - this.drawCanvas.getBoundingClientRect().left;
    }
    correctCanvasY(y) {
        return y - this.drawCanvas.getBoundingClientRect().top;
    }

    clearBoard() {
        this.drawCtx.clearRect(0, 0, this.drawCanvas.width, this.drawCanvas.height);
    }

    startDrawing(atX, atY) {
        this.currentStroke = new PenStroke(this.penWidth, this.penColor);

        this.last_penX = this.penX = this.correctCanvasX(atX);
        this.last_penY = this.penY = this.correctCanvasY(atY);
        this.penDrawing = true;
        this.movePen(atX, atY);
    }

    stopDrawing() {
        this.penDrawing = false;
        this.currentStroke = null;
    }

    resetPenPosition() {
        this.last_penX = -1;
        this.last_penY = -1;

        if (this.currentStroke) {
            this.currentStroke.addPoint(-1, -1);
        }
    }

    movePen(toX, toY) {
        this.penX = this.correctCanvasX(toX);
        this.penY = this.correctCanvasY(toY);
        if (this.penDrawing) {
            this.drawCtx.lineWidth = this.currentStroke.width;
            this.drawCtx.strokeStyle = this.currentStroke.color;

            if (this.last_penX >= 0 && this.last_penX >= 0) {
                this.drawLineOnCtx(this.last_penX, this.last_penY, this.penX, this.penY);
                this.currentStroke.addPoint(this.penX, this.penY);
            }
        }
        this.last_penX = this.penX;
        this.last_penY = this.penY;
    }

    drawLineOnCtx(aX, aY, bX, bY) {
        this.drawCtx.beginPath();
        this.drawCtx.moveTo(aX, aY);
        this.drawCtx.lineTo(bX, bY);
        this.drawCtx.lineJoin = this.drawCtx.lineCap = 'round';
        this.drawCtx.stroke();
    }
}

class HistoryDrawBoard extends DrawBoard {
    strokeHistory = [];
    strokeHistoryHistory = [];

    undo() {
        if (this.strokeHistory.length > 0) {
            this.strokeHistory.pop();
        } else {
            if (this.strokeHistoryHistory.length > 0) {
                this.strokeHistory = this.strokeHistoryHistory.pop();
            } else {
                return;
            }
        }
        this.clearBoard();
        drawFromStrokes(this.drawCanvas, this.strokeHistory);
    }

    stopDrawing() {
        if (this.currentStroke) {
            let latest = {};
            Object.assign(latest, this.currentStroke);
            this.strokeHistory.push(latest);
        }
        super.stopDrawing();
    }

    wipe(deepHistoryCleanse = false) {
        this.clearBoard();
        this.resetStrokeHistory(deepHistoryCleanse);
    }

    resetStrokeHistory(deep = false) {
        if (deep) {
            this.strokeHistory.length = 0;
            this.strokeHistoryHistory.length = 0;
        } else {
            this.strokeHistoryHistory.push(this.strokeHistory);
            this.strokeHistory = [];
        }
    }
}

class PipedDrawBoard extends DrawBoard {
    strokeCallback;

    stopDrawing() {
        if (this.currentStroke) {
            let latest = {};
            Object.assign(latest, this.currentStroke);
            this.strokeCallback(latest);
        }
        super.stopDrawing();
    }
}

var myDrawBoard = new HistoryDrawBoard(document.getElementById('draw-canvas'));
var groupDrawBoard = new PipedDrawBoard(document.getElementById('communal-canvas'));
connectDrawBoardEvents(myDrawBoard);
connectDrawBoardEvents(groupDrawBoard);
groupDrawBoard.strokeCallback = function (stroke) {
    socket.emit('give communal stroke', gameId, stroke);
}

document.getElementById('group-pen-color').addEventListener('change', function (e) {
    groupDrawBoard.setPenColor(e.target.value);
});
document.getElementById('group-pen-width').addEventListener('change', function (e) {
    groupDrawBoard.setPenWidth(e.target.value);
});

function connectDrawBoardEvents(drawboard) {
    $(drawboard.drawCanvas).on('mousedown', function (e) {
        if (e.button == 0) {
            drawboard.startDrawing(e.clientX, e.clientY);
        }
    });
    $(drawboard.drawCanvas).on('mouseleave', function () {
        drawboard.resetPenPosition();
    });
    $(document).on('mouseup', function (e) {
        if (e.button == 0) {
            drawboard.stopDrawing();
        }
    });
    $(drawboard.drawCanvas).on('mousemove', function (e) {
        drawboard.movePen(e.clientX, e.clientY);
    });

    $(drawboard.drawCanvas).on('touchstart', function (e) {
        let t = (e.touches || [])[0] || {};
        drawboard.startDrawing(t.clientX, t.clientY);
    });
    $(document).on('touchend', function (e) {
        drawboard.stopDrawing();
    });
    $(drawboard.drawCanvas).on('touchmove', function (e) {
        let t = (e.touches || [])[0] || {};
        drawboard.movePen(t.clientX, t.clientY);
    });
}

function drawLineOnCtx(ctx, aX, aY, bX, bY) {
    ctx.beginPath();
    ctx.moveTo(aX, aY);
    ctx.lineTo(bX, bY);
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.stroke();
}

function drawStrokeOnCtx(ctx, stroke) {
    ctx.lineWidth = stroke.width;
    ctx.strokeStyle = stroke.color;

    let lastPoint = null;
    for (let j in stroke.points) {
        let p = stroke.points[j];
        if (p.x >= 0 && p.y >= 0) {
            if (lastPoint == null) {
                drawLineOnCtx(ctx, p.x, p.y, p.x, p.y);
            } else if (lastPoint.x >= 0 && lastPoint.y >= 0) {
                drawLineOnCtx(ctx, lastPoint.x, lastPoint.y, p.x, p.y);
            }
        }
        lastPoint = p;
    }
}

function drawFromStrokes(canvas, strokes) {
    let ctx = canvas.getContext('2d');
    for (let i in strokes) {
        drawStrokeOnCtx(ctx, strokes[i]);
    }
}

function strokesToDataUrl(strokes) {
    let c = document.createElement('canvas');
    c.width = myDrawBoard.drawCanvas.width;
    c.height = myDrawBoard.drawCanvas.height;
    drawFromStrokes(c, strokes);
    let d = c.toDataURL();
    return d;
}