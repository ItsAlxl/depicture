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
        if (type == "caption") {
            return this.images[this.images.length - 1];
        } else {
            return this.captions[this.captions.length - 1];
        }
    }

    takeCurrent(type, content) {
        if (type == "caption") {
            this.captions.push(content);
        } else {
            this.images.push(content);
        }
    }
}

class Player {
    id;
    name;

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
    plrTurnOrder;
    numPlrs;
    turns;
    numPlrsReady;

    constructor(id) {
        this.id = id;
        this.restart();
    }
    restart() {
        this.stories.length = 0;
        this.numPlrs = -1;
        this.turns = -1;
        this.numPlrsReady = 0;
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

    setupGame() {
        this.plrTurnOrder = Object.keys(this.plrs);
        this.numPlrs = this.plrTurnOrder.length;
    }

    takeStorySeeds(seeds) {
        for (let i = 0; i < seeds.length; i++) {
            this.stories.push(new Story(seeds[i]));
        }
    }

    uptickReady() {
        this.numPlrsReady++;
    }

    areAllReady() {
        return this.numPlrsReady >= this.numPlrs;
    }

    advanceTurn() {
        this.numPlrsReady = 0;
        this.turns++;
        if (this.turns >= this.getNumPlrs()) {
            return true;
        } else {
            return false;
        }
    }

    getCurrentView() {
        if (this.turns % 2 == 0) {
            return "draw";
        } else {
            return "caption";
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
}

exports.Room = Room;
exports.Story = Story;
exports.Player = Player;