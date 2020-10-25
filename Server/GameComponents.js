class Story {
    images = [];
    captions = [];
    owners = [];

    constructor(seed) {
        this.captions.push(seed);
    }

    getCurrent(type) {
        if (type == 'caption') {
            return this.images[this.images.length - 1];
        } else {
            return this.captions[this.captions.length - 1];
        }
    }

    takeCurrent(type, content, owner = 'anonymous player', idx) {
        let halfIdx = Math.floor(idx / 2);

        if (this.getNumStages() == idx) {
            if (type == 'caption') {
                this.captions[halfIdx + 1] = content;
            } else {
                this.images[halfIdx] = content;
            }
            this.owners[idx] = owner;
        }
    }

    getNumStages() {
        return this.owners.length;
    }
}

class Player {
    id;
    nickname;
    stageDone = false;
    spectator = true;

    constructor(id, name) {
        this.id = id;
        this.nickname = name;
    }

    setReady(r) {
        this.stageDone = r;
    }
    isReady() {
        return this.stageDone;
    }

    setActive(a) {
        this.spectator = !a;
    }
    isActive() {
        return !this.spectator;
    }
}

class Room {
    id;
    stories = [];
    plrs = {};
    hostId;
    plrTurnOrder = [];
    numActivePlrs;
    turns;
    plrReadiness = {};
    stageLimit = 0;
    stagesRevealed;
    currentState;

    allowedPenWidths;
    allowedPenClrs = {};
    defaultPenWidth;
    colorRestrictor;

    communalStrokes = [];

    // penClrMap is {clrName: '#hexval'}
    // penWidthMap is {intval: 'Width Name'}
    constructor(id, penClrMap, penWidthMap) {
        this.id = id;

        Object.assign(this.allowedPenClrs, penClrMap);
        this.allowedPenWidths = penWidthMap;
        this.defaultPenWidth = this.getNearestWidth(10);

        penClrMap['black'] = '#000';
        penClrMap['white'] = '#fff';
        this.colorRestrictor = require('nearest-color').from(penClrMap);

        this.restart();
    }
    restart() {
        this.communalStrokes.length = 0;
        this.stories.length = 0;
        this.turns = -1;
        this.stagesRevealed = 0;
        this.numActivePlrs = -1;
        this.setState('lobby');
        this.resetReady();
    }

    setState(s) {
        this.currentState = s;
    }
    getState() {
        return this.currentState;
    }
    isLive() {
        return ['ingame'].includes(this.getState());
    }
    isJoinable() {
        return !['ingame'].includes(this.getState());
    }

    addPlr(id, nickname) {
        if (this.getNumTotalPlrs() == 0) {
            this.hostId = id;
        }

        let p = new Player(id, nickname);

        switch (this.getState()) {
            case 'lobby':
                p.setActive(true);
                break;
            case 'ingame':
                let fillSeat = this.getOpenTurnOrder();
                if (fillSeat >= 0) {
                    this.plrTurnOrder[fillSeat] = id;
                    p.setActive(true);
                    p.setReady(this.hasStorySubmitted(this.plrToStory(id)));
                }
                break;
            default:
                p.setActive(false);
                break;
        }

        this.plrs[id] = p;
    }

    remPlr(id) {
        let turnOrderIdx = this.plrTurnOrder.indexOf(id);
        if (turnOrderIdx > -1) {
            let successor = this.activeSuccession(id);
            if (successor == null) {
                this.plrTurnOrder[turnOrderIdx] = '';
            } else {
                successor.setActive(true);
                this.plrTurnOrder[turnOrderIdx] = successor.id;
            }
        }
        if (id == this.hostId) {
            this.hostId = this.hostSuccession();
        }

        delete this.plrs[id];
        return this.plrTurnOrder[turnOrderIdx];
    }

    activeSuccession(excludeId) {
        for (let p in this.plrs) {
            if (p != excludeId && !this.getPlr(p).isActive()) {
                return this.getPlr(p);
            }
        }
        return null;
    }

    hostSuccession() {
        let apks = this.getActivePlrKeys();
        for (let i = 0; i < apks.length; i++) {
            if (apks[i] != this.hostId) {
                return apks[i];
            }
        }
        return '';
    }

    getPlr(id) {
        return this.plrs[id];
    }

    hasPlr(id) {
        return (id in this.plrs);
    }

    getOpenTurnOrder() {
        return this.plrTurnOrder.indexOf('');
    }

    getNumTotalPlrs() {
        return Object.keys(this.plrs).length;
    }

    getNumActivePlrs() {
        return this.numActivePlrs;
    }

    getActivePlrKeys() {
        let apks = [];
        for (let p in this.plrs) {
            if (this.getPlr(p).isActive()) {
                apks.push(p);
            }
        }
        return apks;
    }

    getUnreadyPlrKeys() {
        let upks = [];
        for (let p in this.plrs) {
            if (!this.getPlr(p).isReady()) {
                upks.push(p);
            }
        }
        return upks;
    }

    setupGame(stageLimit = -1) {
        this.plrTurnOrder = this.getActivePlrKeys();
        this.numActivePlrs = this.plrTurnOrder.length;
        if (stageLimit >= 0) {
            this.stageLimit = stageLimit;
        }
        this.setState('ingame');

        // Shuffle (Durstenfeld / Fisher-Yates)
        for (let i = this.plrTurnOrder.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            let temp = this.plrTurnOrder[i];
            this.plrTurnOrder[i] = this.plrTurnOrder[j];
            this.plrTurnOrder[j] = temp;
        }
    }

    takeStorySeeds(seeds) {
        if (this.stories.length == 0) {
            for (let i = 0; i < seeds.length; i++) {
                this.stories.push(new Story(seeds[i]));
            }
        }
    }

    uptickReady(pid) {
        this.getPlr(pid).setReady(true);
    }

    resetReady() {
        for (let p in this.plrs) {
            this.getPlr(p).setReady(false);
        }
    }

    areAllReady() {
        let apks = this.getActivePlrKeys();
        for (let p in apks) {
            if (!this.getPlr(apks[p]).isReady()) {
                return false;
            }
        }
        return true;
    }

    downgradePlayers() {
        for (let p in this.plrs) {
            this.getPlr(p).setActive(false);
        }
    }

    setPlayAgain(plrId, playAgain) {
        if (plrId in this.plrs && this.isJoinable()) {
            this.getPlr(plrId).setActive(playAgain);
        }
    }

    advanceTurn(fromTurn) {
        if (this.turns == fromTurn) {
            this.resetReady();

            let sl = this.getStageLimit();
            this.turns++;
            if ((sl > 0 && this.turns >= sl) || this.turns >= this.getNumActivePlrs()) {
                this.setState('story-rollout');
                return true;
            } else {
                return false;
            }
        }
    }

    getStageLimit() {
        return Math.min(this.stageLimit, this.getNumActivePlrs());
    }

    getCurrentView() {
        if (this.turns % 2 == 0) {
            return 'draw';
        } else {
            return 'caption';
        }
    }

    plrToStory(plrId) {
        let idx = this.plrTurnOrder.indexOf(plrId) + this.turns;
        idx = idx % this.stories.length;
        return this.stories[idx];
    }

    hasStorySubmitted(s) {
        return s.owners.length == this.turns + 1;
    }

    getCurrentStory(plrId) {
        return this.plrToStory(plrId).getCurrent(this.getCurrentView());
    }

    getNearestWidth(to) {
        let prevDistance = -1;
        let prevW = -1;
        for (let w in this.allowedPenWidths) {
            let d = Math.abs(to - w);

            if (d == 0) {
                return w;
            }
            if (prevDistance < d && prevDistance >= 0) {
                return prevW;
            }

            prevDistance = d;
            prevW = w;
        }
        return prevW;
    }

    correctStrokes(strokes) {
        for (let i in strokes) {
            strokes[i].color = this.colorRestrictor(strokes[i].color).value;
            strokes[i].width = this.getNearestWidth(strokes[i].width);
        }
    }

    takeCurrentStory(plrId, content) {
        if (this.hasPlr(plrId) && content != undefined && content != null) {
            if (this.getCurrentView() == 'draw') {
                this.correctStrokes(content);
            }
            this.plrToStory(plrId).takeCurrent(this.getCurrentView(), content, this.getPlr(plrId).nickname, this.turns);
            this.uptickReady(plrId);
        }
    }
}

exports.Room = Room;
exports.Story = Story;
exports.Player = Player;