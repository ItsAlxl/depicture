class rAFCountdownTimer {
    updateCallback;
    finishCallback;

    tsStart = null;
    msDuration = 0;
    msElapsed = 0;

    cancelOnNextTick = false;

    rAFid;

    constructor(finishCallback, updateCallback = null) {
        this.finishCallback = finishCallback;
        this.updateCallback = updateCallback;

        this.rAFCallback = this.rAFCallback.bind(this);
    }

    start() {
        if (this.msDuration > 0) {
            this.tsStart = null;
            this.rAFid = requestAnimationFrame(this.rAFCallback);
        }
    }

    rAFCallback(ts) {
        if (this.tsStart == null) {
            this.tsStart = ts;
        }
        this.msElapsed = ts - this.tsStart;

        let msRemain = this.getMsRemaining();
        if (this.updateCallback != null) {
            this.updateCallback(msRemain);
        }
        if (msRemain <= 0) {
            if (this.finishCallback != null) {
                this.finishCallback();
            }
        } else {
            if (this.cancelOnNextTick) {
                this.cancelOnNextTick = false;
            } else {
                this.rAFid = requestAnimationFrame(this.rAFCallback);
            }
        }
    }

    cancel() {
        this.cancelOnNextTick = true;
    }

    getMsRemaining() {
        return this.msDuration - this.msElapsed;
    }
}