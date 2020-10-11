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
        if (type == 'caption') {
            this.captions[idx] = content;
        } else {
            this.images[idx] = content;
        }
        this.owners.push(owner);
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

    constructor(id) {
        this.id = id;
        this.restart();
    }
    restart() {
        this.stories.length = 0;
        this.turns = -1;
        this.stagesRevealed = 0;
        this.numActivePlrs = -1;
        this.setState('lobby');
        this.upgradeSpectators();
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

        if (this.isJoinable()) {
            p.setActive(true);
        } else {
            let fillSeat = this.getOpenTurnOrder();
            if (fillSeat >= 0) {
                this.plrTurnOrder[fillSeat] = id;
                p.setActive(true);
                p.setReady(this.hasStorySubmitted(this.plrToStory(id)));
            }
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
        for (var i = this.plrTurnOrder.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = this.plrTurnOrder[i];
            this.plrTurnOrder[i] = this.plrTurnOrder[j];
            this.plrTurnOrder[j] = temp;
        }
    }

    takeStorySeeds(seeds) {
        for (let i = 0; i < seeds.length; i++) {
            this.stories.push(new Story(seeds[i]));
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

    upgradeSpectators() {
        for (let p in this.plrs) {
            this.getPlr(p).setActive(true);
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

    takeCurrentStory(plrId, content) {
        this.plrToStory(plrId).takeCurrent(this.getCurrentView(), content, this.getPlr(plrId).nickname, Math.floor(this.turns / 2));
    }
}

exports.Room = Room;
exports.Story = Story;
exports.Player = Player;