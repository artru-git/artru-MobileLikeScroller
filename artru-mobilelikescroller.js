(function()
class MobileLikeScroller {
    constructor(elem, direction = 'xy') {
        this.previousTouchX = [0, 0, 0];
        this.previousTouchY = [0, 0, 0];
        this.previousTouchTime = [0, 0, 0];
        this.direction = direction;
        this.scrollAtT0 = [0, 0];
        this.inertialTimerInterval = null;
        this.target = elem;
        this.childrenEventListeners = [];
        this.childEventObject = null;
        this.blockChildrenTimeout = null;
        this.blockedInputs = [];

        this.touchstartHandler = this.touchstart.bind(this);
        this.touchmoveHandler = this.touchmove.bind(this);
        this.touchendHandler = this.touchend.bind(this);
        this.clickHandler = this.click.bind(this);

        elem.addEventListener('mousedown', this.touchstartHandler);
    }

    touchstart(e) {
        if (e.button === 0) { // Check for left click
            e.preventDefault();
            this.target.style.cursor = 'grabbing';
            this.previousTouchX = [e.pageX, e.pageX, e.pageX];
            this.previousTouchY = [e.pageY, e.pageY, e.pageY];
            this.previousTouchTime = [Date.now() - 2, Date.now() - 1, Date.now()];
            document.addEventListener('mousemove', this.touchmoveHandler);
            document.addEventListener('mouseup', this.touchendHandler);
            document.addEventListener('click', this.clickHandler);
            if (this.inertialTimerInterval) {
                clearInterval(this.inertialTimerInterval);
                this.inertialTimerInterval = null;
            }
            this.childEventObject = null;
            this.blockChildrenTimeout = setTimeout(() => { this.preventChildClicks(); }, 300); // Prevent children from being clicked after 300ms when we are sure that the user is grabbing the parent to scroll
        }
    }

    touchmove(e) {
        this.previousTouchX = [this.previousTouchX[1], this.previousTouchX[2], e.pageX];
        this.previousTouchY = [this.previousTouchY[1], this.previousTouchY[2], e.pageY];
        this.previousTouchTime = [this.previousTouchTime[1], this.previousTouchTime[2], Date.now()];
        if (this.direction != 'y') this.target.scrollLeft -= this.previousTouchX[2] - this.previousTouchX[1];
        if (this.direction != 'x') this.target.scrollTop -= this.previousTouchY[2] - this.previousTouchY[1];

        if (this.blockChildrenTimeout && (this.previousTouchX[2] - this.previousTouchX[1]) ** 2 + (this.previousTouchY[2] - this.previousTouchY[1]) ** 2 > 25) {
            // If fast mouse movement, this is not a click on children, do not wait 300ms
            this.preventChildClicks();
        }
        this.target.dispatchEvent(new Event('scroll'));
    }

    touchend(e) {
        document.removeEventListener('mousemove', this.touchmoveHandler);
        document.removeEventListener('mouseup', this.touchendHandler);
        this.target.style.cursor = '';
        this.scrollAtT0 = [this.target.scrollLeft, this.target.scrollTop];
        this.inertialTimerInterval = setInterval(() => this.inertialmove(), 16);
        this.target.dispatchEvent(new Event('initiateinertial'));
    }

    click(e) {
        document.removeEventListener('click', this.clickHandler);
        if (this.blockChildrenTimeout === null) {
            this.childrenEventListeners.forEach(t => {
                t[0].removeEventListener('click', t[1], true);
            });
            this.childrenEventListeners = [];
            setTimeout(() => { // The event for the change is done after the click event, so we need to wait for the click event to be done before re-enabling the inputs
                this.blockedInputs.forEach(input => input.disabled = false);
                this.blockedInputs = [];
            }, 0);
        } else {
            clearTimeout(this.blockChildrenTimeout);
            this.blockChildrenTimeout = null;
        }
    }

    preventChildClicks() {
        Array.from(this.target.querySelectorAll('*')).forEach(elem => {
            const listener = (e) => this.childclick(e);
            elem.addEventListener('click', listener, true);
            this.childrenEventListeners.push([elem, listener]);
        });
        this.blockedInputs = Array.from(this.target.querySelectorAll('input:not(:disabled)')).map(input => {
            input.disabled = true;
            return input;
        });
        clearTimeout(this.blockChildrenTimeout);
        this.blockChildrenTimeout = null;
    }

    childclick(e) {
        e.stopPropagation();
        this.click(e);
    }

    inertialmove() {
        let v0X = 0, v0Y = 0;
        if (this.direction != 'y') v0X = (this.previousTouchX[2] - this.previousTouchX[0]) / (this.previousTouchTime[2] - this.previousTouchTime[0]) * 1000 / this.target.clientWidth; // page per second    
        if (this.direction != 'x') v0Y = (this.previousTouchY[2] - this.previousTouchY[0]) / (this.previousTouchTime[2] - this.previousTouchTime[0]) * 1000 / this.target.clientHeight; // page per second

        let av0 = this.direction == 'xy' ? Math.sqrt(v0X * v0X + v0Y * v0Y) : (this.direction == 'y' ? Math.abs(v0Y) : Math.abs(v0X));
        let unitVector = [v0X / av0, v0Y / av0];
        av0 = Math.min(12, Math.max(-12, 1.2 * av0));

        let t = (Date.now() - this.previousTouchTime[2]) / 1000;
        let v = av0 - 14.278 * t + 75.24 * t * t / av0 - 149.72 * t * t * t / av0 / av0;

        if (av0 == 0 || v <= 0 || isNaN(av0)) {
            clearInterval(this.inertialTimerInterval);
            this.inertialTimerInterval = null;
            this.target.dispatchEvent(new Event('scrollend'));
        } else {
            let deltaX = this.target.clientWidth * unitVector[0] * (av0 * t - 7.1397 * t * t + 25.08 * t * t * t / av0 - 37.43 * t * t * t * t / av0 / av0);
            let deltaY = this.target.clientHeight * unitVector[1] * (av0 * t - 7.1397 * t * t + 25.08 * t * t * t / av0 - 37.43 * t * t * t * t / av0 / av0);
            let maxScroll = [this.target.scrollWidth - this.target.clientWidth, this.target.scrollHeight - this.target.clientHeight];
            let newScroll = [Math.min(maxScroll[0], Math.max(0, this.scrollAtT0[0] - deltaX)), Math.min(maxScroll[1], Math.max(0, this.scrollAtT0[1] - deltaY))];

            if ((newScroll[0] == 0 || newScroll[0] == maxScroll[0]) && (newScroll[1] == 0 || newScroll[1] == maxScroll[1])) {
                clearInterval(this.inertialTimerInterval);
                this.inertialTimerInterval = null;
            }
            if (this.direction != 'y')
                this.target.scrollLeft = newScroll[0];
            if (this.direction != 'x')
                this.target.scrollTop = newScroll[1];
            this.target.dispatchEvent(new Event('scroll'));
        }
    }
}

document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.x-scroll').forEach(elem => new MobileLikeScroller(elem, 'x'));
    document.querySelectorAll('.y-scroll').forEach(elem => new MobileLikeScroller(elem, 'y'));
    document.querySelectorAll('.xy-scroll').forEach(elem => new MobileLikeScroller(elem, 'xy'));

    const style = document.createElement('style');
    style.innerHTML = `
        .x-scroll, .xy-scroll {
            overflow-x: auto;
        }
        .y-scroll, .xy-scroll {
            overflow-y: auto;
        }
        .x-scroll {
            overflow-y: hidden;
        }
        .y-scroll {
            overflow-x: hidden;
        }
        .x-scroll, .y-scroll, .xy-scroll {
            cursor: grab;
        }
        .x-scroll:not(.with-scrollbar), .y-scroll:not(.with-scrollbar), .xy-scroll:not(.with-scrollbar) {
            scrollbar-width: 0;
        }
        .x-scroll:not(.with-scrollbar)::-webkit-scrollbar, .y-scroll:not(.with-scrollbar)::-webkit-scrollbar, .xy-scroll:not(.with-scrollbar)::-webkit-scrollbar {
            display: none;
        }
    `;
    document.head.appendChild(style);
});
})();
