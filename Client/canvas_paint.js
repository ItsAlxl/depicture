class PenStroke {
    width;
    color;
    points = [];

    constructor(width, color) {
        this.width = width;
        this.color = color;
    }

    verifyPrevPoint(x, y) {
        let pp = this.points[this.points.length - 1];
        if (pp == null || pp.x != x || pp.y != y) {
            this.addPoint(x, y);
        }
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
        if (c.charAt(0) != '#') {
            c = colorToHex(c);
        }
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
    }

    movePen(toX, toY) {
        this.penX = this.correctCanvasX(toX);
        this.penY = this.correctCanvasY(toY);
        if (this.penDrawing) {
            this.drawCtx.lineWidth = this.currentStroke.width;
            this.drawCtx.strokeStyle = this.currentStroke.color;

            this.currentStroke.verifyPrevPoint(this.last_penX, this.last_penY);
            if (this.last_penX >= 0 && this.last_penY >= 0) {
                this.currentStroke.addPoint(this.penX, this.penY);

                this.drawLineOnCtx(this.last_penX, this.last_penY, this.penX, this.penY);
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


class PipedDrawBoard extends DrawBoard {
    strokeCallbacks = [];

    addCallback(f) {
        this.strokeCallbacks.push(f);
    }

    stopDrawing() {
        if (this.currentStroke) {
            let latest = {};
            Object.assign(latest, this.currentStroke);
            this.handleCallbacks(latest);
        }
        super.stopDrawing();
    }

    handleCallbacks(stroke) {
        for (let cb in this.strokeCallbacks) {
            let f = this.strokeCallbacks[cb];
            f(stroke);
        }
    }
}

class HistoryDrawBoard extends PipedDrawBoard {
    undoHistory = [];
    strokeHistory = [];
    strokeHistoryHistory = [];

    constructor(canvas) {
        super(canvas);
    }

    handleCallbacks(stroke) {
        this.disableRedo();
        this.strokeHistory.push(stroke);
        super.handleCallbacks(stroke);
    }

    undo() {
        if (this.strokeHistory.length > 0) {
            this.undoHistory.push(this.strokeHistory.pop());
        } else {
            if (this.strokeHistoryHistory.length > 0) {
                this.strokeHistory = this.strokeHistoryHistory.pop();
            } else {
                return;
            }
        }
        this.drawFromHistory();
    }

    redo() {
        if (this.undoHistory.length > 0) {
            let s = this.undoHistory.pop();
            this.strokeHistory.push(s);
            drawStrokeOnCtx(this.drawCtx, s)
        }
    }

    disableRedo() {
        this.undoHistory.length = 0;
    }

    drawFromHistory(hist = this.strokeHistory) {
        this.clearBoard();
        drawFromStrokes(this.drawCanvas, hist);
    }

    drawFromHistoryUpTo(toIdx) {
        this.drawFromHistory(this.strokeHistory.slice(0, toIdx));
    }

    wipe(deepHistoryCleanse = false) {
        this.clearBoard();
        this.resetStrokeHistory(deepHistoryCleanse);
    }

    resetStrokeHistory(deep = false) {
        this.disableRedo();
        if (deep) {
            this.strokeHistory.length = 0;
            this.strokeHistoryHistory.length = 0;
        } else {
            this.strokeHistoryHistory.push(this.strokeHistory);
            this.strokeHistory = [];
        }
    }

    getStrokeTimeline() {
        let reverseHist = this.undoHistory.slice();
        reverseHist.reverse();
        return this.strokeHistory.concat(reverseHist);
    }
}

function connectDrawBoardEvents(drawboard) {
    $(drawboard.drawCanvas).on('mousedown', function (e) {
        if (e.button == 0) {
            drawboard.startDrawing(e.clientX, e.clientY);
        } else {
            drawboard.stopDrawing();
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

    preventSelectionBoards.push(drawboard);
}

// Prevent highlighting/selecting html elements while drawing
var preventSelectionBoards = [];
function areAnyBoardsDrawing() {
    for (let i = 0; i < preventSelectionBoards.length; i++) {
        if (preventSelectionBoards[i].penDrawing) {
            return true;
        }
    }
    return false;
}
document.oncontextmenu = preventEventDuringDraw;
document.onselectstart = preventEventDuringDraw;
function preventEventDuringDraw(e) {
    if (areAnyBoardsDrawing()) {
        e.preventDefault();
        return false;
    }
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
        if (lastPoint != null && lastPoint.x >= 0 && lastPoint.y >= 0 && p.x >= 0 && p.y >= 0) {
            drawLineOnCtx(ctx, lastPoint.x, lastPoint.y, p.x, p.y);
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

function strokesToDataUrl(strokes, widthHeightObj = myDrawBoard.drawCanvas) {
    let c = document.createElement('canvas');
    c.width = widthHeightObj.width;
    c.height = widthHeightObj.height;
    drawFromStrokes(c, strokes);
    let d = c.toDataURL();
    return d;
}

function colorToRGBA(color) {
    let cvs = document.createElement('canvas');
    cvs.height = 1;
    cvs.width = 1;
    let ctx = cvs.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    return ctx.getImageData(0, 0, 1, 1).data;
}

function byteToHex(num) {
    return ('0' + num.toString(16)).slice(-2);
}

function colorToHex(color) {
    let rgba = colorToRGBA(color);
    let hex = [0, 1, 2].map(
        function (idx) { return byteToHex(rgba[idx]); }
    ).join('');
    return "#" + hex;
}