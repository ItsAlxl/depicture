class Story {
    images = [];
    captions = [];

    constructor(seed) {
        this.captions.push(seed);
    }

    getPair(idx) {
        return [this.captions[idx], this.images[idx]];
    }

    getCurrent(type) {
        if (type == 'caption') {
            return this.images[this.images.length - 1];
        } else {
            return this.captions[this.captions.length - 1];
        }
    }

    takeCurrent(type, content) {
        if (type == 'caption') {
            this.captions.push(content);
        } else {
            this.images.push(content);
        }
    }
}

class Player {
    id;
    nickname;

    constructor(id, name) {
        this.id = id;
        this.nickname = name;
    }
}

class Room {
    id;
    stories = [];
    plrs = {};
    hostId;
    plrTurnOrder = [];
    numPlrs = -1;
    turns;
    plrReadiness = {};
    stageLimit = 0;

    constructor(id) {
        this.id = id;
        this.restart();
    }
    restart() {
        this.stories.length = 0;
        this.turns = -1;

        this.resetReady();
    }

    addPlr(id, nickname) {
        if (this.getNumPlrs() == 0) {
            this.hostId = id;
        }
        this.plrs[id] = new Player(id, nickname);
    }
    remPlr(id) {
        delete this.plrs[id];
    }

    getNumPlrs() {
        if (this.numPlrs < 0) {
            return Object.keys(this.plrs).length;
        } else {
            return this.numPlrs;
        }
    }

    validToStart() {
        return this.getNumPlrs() >= 3;
    }

    setupGame(stageLimit) {
        this.plrTurnOrder = Object.keys(this.plrs);
        this.numPlrs = this.plrTurnOrder.length;
        this.stageLimit = Math.min(stageLimit, this.getNumPlrs());
    }

    shuffleTurnOrder() {
        if (this.plrTurnOrder.length > 0) {
            // Shuffle (Durstenfeld / Fisher-Yates)
            for (var i = this.plrTurnOrder.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var temp = this.plrTurnOrder[i];
                this.plrTurnOrder[i] = this.plrTurnOrder[j];
                this.plrTurnOrder[j] = temp;
            }
        }
    }

    takeStorySeeds(seeds) {
        for (let i = 0; i < seeds.length; i++) {
            this.stories.push(new Story(seeds[i]));
        }
    }

    uptickReady(pid) {
        this.plrReadiness[pid] = true;
    }

    resetReady() {
        for (let p in this.plrs) {
            delete this.plrReadiness[p];
        }
        for (let p in this.plrs) {
            this.plrReadiness[p] = false;
        }
    }

    areAllReady() {
        for (let p in this.plrReadiness) {
            if (!this.plrReadiness[p]) {
                return false;
            }
        }
        return true;
    }

    advanceTurn() {
        this.resetReady();
        this.turns++;
        if ((this.stageLimit > 0 && this.turns >= this.stageLimit) || this.turns >= this.getNumPlrs()) {
            return true;
        } else {
            return false;
        }
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

    getCurrentStory(plrId) {
        return this.plrToStory(plrId).getCurrent(this.getCurrentView());
    }

    takeCurrentStory(plrId, content) {
        this.plrToStory(plrId).takeCurrent(this.getCurrentView(), content);
    }

    getPlrNamesInOrder() {
        let pnio = [];
        for (let p in this.plrTurnOrder) {
            pnio.push(this.plrs[this.plrTurnOrder[p]].nickname);
        }
        return pnio;
    }
}

exports.Room = Room;
exports.Story = Story;
exports.Player = Player;