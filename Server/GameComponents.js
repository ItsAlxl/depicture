const { DateCountdownTimer } = require('./date-timer.js');

// returns a % b, but guarantees >0
function posMod(a, b) {
    return ((a % b) + b) % b;
}

class Stage {
    type;
    content;
    owner;
    likers = [];

    constructor(owner, type, content) {
        this.owner = owner;
        this.type = type;
        this.content = content;
    }

    addLike(plr) {
        if (!(plr in this.likers)) {
            this.likers.push(plr);
        }
    }

    remLike(plr) {
        this.likers = this.likers.filter(function (e) {
            return e !== plr;
        })
    }

    getNumLikes() {
        return this.likers.length;
    }

    compareCaption(c) {
        if (this.type != 'caption') {
            return false;
        }

        return this.content.toLowerCase() == c.toLowerCase();
    }
}

class Story {
    stages = [];

    takePrompt(p) {
        this.takeStageForce('caption', p, 'depicture');
    }

    getPrevStage() {
        return this.stages[this.stages.length - 1];
    }

    takeStageForce(type, content, owner = 'anonymous player') {
        this.stages.push(new Stage(owner, type, content));
    }

    takeStageStrict(type, content, owner = 'anonymous player', idx = -1) {
        if (this.getNumPlrStages() == idx) {
            this.takeStageForce(type, content, owner);
        }
    }

    getNumPlrStages() {
        return this.stages.length - 1;
    }

    isEmpty() {
        return this.stages.length == 0;
    }

    getLastSeedStage() {
        for(let i = this.stages.length - 1; i > 0; i--) {
            if (this.stages[i].type == 'caption' && this.stages[i-1].type == 'draw') {
                return this.stages[i];
            }
        }
        if (this.stages[0].type == 'caption') {
            return this.stages[0];
        }
        return null;
    }
}

class Player {
    id;
    nickname;
    stageDone = false;
    spectator = true;

    likes = [];

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
    isPublic;
    shufflePlrOrder;
    linearStoryOrder;

    promptDeck = [];
    stories = [];
    plrs = {};
    hostId;
    plrTurnOrder = [];
    numActivePlrs;

    gameOpts;
    gamemode;
    turnTimer = new DateCountdownTimer(this.timerExpired.bind(this));
    timerCallback = null;

    turns;
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
    constructor(id, penClrMap, penWidthMap, isPubGame, turnOpts, gameOpts) {
        this.id = id;
        this.isPublic = isPubGame;

        this.shufflePlrOrder = turnOpts.shuffle;
        this.linearStoryOrder = turnOpts.linear;

        this.gameOpts = gameOpts;
        this.gamemode = gameOpts.gamemode;
        this.turnTimer.msDuration = gameOpts.timeLimit;

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

    timerExpired() {
        if (this.timerCallback != null) {
            this.timerCallback(this.id);
        }
    }

    getPublicInfo() {
        return {
            hostName: this.getPlr(this.hostId).nickname,
            gameId: this.id
        };
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
        if (!(id in this.plrs)) {
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

        if (this.shufflePlrOrder) {
            // Shuffle (Durstenfeld / Fisher-Yates)
            for (let i = this.plrTurnOrder.length - 1; i > 0; i--) {
                let j = Math.floor(Math.random() * (i + 1));
                let temp = this.plrTurnOrder[i];
                this.plrTurnOrder[i] = this.plrTurnOrder[j];
                this.plrTurnOrder[j] = temp;
            }
        }

        for (let i = 0; i < this.numActivePlrs; i++) {
            this.stories.push(new Story());
        }
    }

    getPromptRequestNum() {
        let numPrompts = this.getNumActivePlrs();
        switch (this.gamemode) {
            case 'party':
                numPrompts = 100;
                break;
        }

        return numPrompts - this.promptDeck.length;
    }

    takeStorySeeds(seeds) {
        this.promptDeck = this.promptDeck.concat(seeds);
        for (let i = 0; i < this.stories.length; i++) {
            if (this.stories[i].isEmpty()) {
                this.giveStoryPrompt(this.stories[i]);
            }
        }
    }

    giveStoryPrompt(story) {
        if (this.promptDeck.length > 0) {
            story.takePrompt(this.promptDeck.pop());
        } else {
            story.takePrompt('<- no prompts available ->');
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

    getLastUnreadyPlrId() {
        let apks = this.getActivePlrKeys();
        let lastUnready = null;
        for (let p in apks) {
            if (!this.getPlr(apks[p]).isReady()) {
                if (lastUnready == null) {
                    lastUnready = apks[p];
                } else {
                    return "";
                }
            }
        }
        return lastUnready;
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

            this.turns++;
            if (this.turns >= this.getStageLimit()) {
                this.setState('story-rollout');
                return true;
            } else {
                return false;
            }
        }
    }

    getStageLimit() {
        let sl = Math.min(this.stageLimit, this.getNumActivePlrs());
        return sl > 0 ? sl : this.getNumActivePlrs();
    }

    getCurrentView() {
        if (this.turns % 2 == 0) {
            return 'draw';
        } else {
            return 'caption';
        }
    }

    getCurrentMainPlrId() {
        return this.plrTurnOrder[this.turns];
    }

    getCurrentMainStory() {
        return this.plrToStory(this.getCurrentMainPlrId());
    }

    getCurrentMainSeedStage() {
        return this.getCurrentMainStory().getLastSeedStage();
    }

    plrIdxToStoryIdx(plrIdx) {
        switch (this.gamemode) {
            case 'party':
                return plrIdx;
            default:
                let idx;
                if (this.linearStoryOrder) {
                    idx = this.turns;
                } else {
                    if (this.turns % 2 == 0) {
                        idx = -Math.floor(this.turns * 0.5);
                    } else {
                        idx = Math.ceil(this.turns * 0.5);
                    }
                    idx = posMod(idx, this.getStageLimit());
                }
                return posMod(plrIdx + idx, this.getNumActivePlrs());
        }
    }

    plrToStory(plrId) {
        return this.stories[this.plrIdxToStoryIdx(this.plrTurnOrder.indexOf(plrId))];
    }

    hasStorySubmitted(s) {
        return s.getNumPlrStages() == this.turns + 1;
    }

    getCurrentStage(plrId) {
        return this.plrToStory(plrId).getPrevStage();
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

    takeCurrentStory(plrId, type, content, ownerId = plrId, force = false) {
        if (this.hasPlr(plrId) && this.hasPlr(ownerId) && content) {
            let plrName = this.getPlr(ownerId).nickname;
            if (plrName) {
                if (type == 'draw') {
                    this.correctStrokes(content);
                }

                if (force) {
                    this.plrToStory(plrId).takeStageForce(type, content, plrName);
                } else {
                    this.plrToStory(plrId).takeStageStrict(type, content, plrName, this.turns);
                }
            }
        }
    }
}

exports.Stage = Stage;
exports.Story = Story;
exports.Player = Player;
exports.Room = Room;