class DateCountdownTimer {
    updateCallback;
    finishCallback;

    msDuration = 0;
    dateTarget;

    intervalID;
    updateTime = 100;

    constructor(finishCallback = null, updateCallback = null) {
        this.finishCallback = finishCallback;
        this.updateCallback = updateCallback;
    }

    start() {
        if (this.msDuration > 0) {
            this.dateTarget = new Date(new Date().getTime() + this.msDuration);
            this.intervalID = setInterval(this.intervalCallback.bind(this), this.updateTime);
        }
    }

    intervalCallback() {
        let msRemain = this.getMsRemaining();
        if (this.updateCallback != null) {
            this.updateCallback(msRemain);
        }
        if (msRemain <= 0) {
            if (this.finishCallback != null) {
                this.finishCallback();
            }
            clearInterval(this.intervalID);
        }
    }

    getMsRemaining() {
        return this.dateTarget.getTime() - (new Date().getTime());
    }
}

exports.DateCountdownTimer = DateCountdownTimer;