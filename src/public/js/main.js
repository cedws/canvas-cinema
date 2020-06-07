'use strict';

const KEYS = {
    UP: 38,
    LEFT: 39,
    RIGHT: 37,
};

const EVENT = {
    KEYS: 0x1,
    UUID: 0x2,
    POSITION: 0x3,
    LEAVE: 0x4,
};

class Vector {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    add(vector) {
        this.x += vector.x;
        this.y += vector.y;
    }

    subtract(vector) {
        this.x -= vector.x;
        this.y -= vector.y;
    }
}

class Screen {
    constructor(selector) {
        this.element = document.querySelector(selector);
    }

    update(player) {
        const top = -player.position.y;
        const left = -player.position.x;

        this.element.style.top = `${top}px`;
        this.element.style.left = `${left}px`;
    }
}

class World {
    constructor(screen, ws) {
        this.screen = screen;

        this.ws = ws;
        this.ws.addEventListener('message', this.message.bind(this));

        this.players = new Map();
        this.player = new LocalPlayer();
    }

    message(evt) {
        const data = JSON.parse(evt.data);
        const { event } = data;

        switch(event) {
            case EVENT.UUID:
                this.eventUUID(data);
                break;
            case EVENT.POSITION:
                this.eventPosition(data);
                break;
            case EVENT.LEAVE:
                this.eventLeave(data);
                break;
        }
    }

    sendMessage(data) {
        if(this.ws.readyState == WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    eventUUID({ uuid }) {
        this.uuid = uuid;
    }

    eventPosition({ uuid, skin, position }) {
        let player;

        if(uuid == this.uuid) {
            // LocalPlayer's position has updated
            player = this.player;
            // Update screen position as well
            this.screen.update(this.player);
        } else {
            if(this.players.has(uuid)) {
                player = this.players.get(uuid);
            } else {
                player = new OnlinePlayer(this.player);
                this.players.set(uuid, player);
            }
        }

        player.skin = skin;
        player.position = position;
    }

    eventLeave({ uuid }) {
        this.players.delete(uuid);
    }

    render(ctx) {
        if(this.player.keyStateChanged) {
            this.sendMessage({
                event: EVENT.KEYS,
                keyState: this.player.keyState,
            });
            this.player.keyStateChanged = false;
        }

        ctx.clearRect(-ctx.canvas.width / 2, -ctx.canvas.height / 2, ctx.canvas.width, ctx.canvas.height);

        // TODO: Don't clear the canvas/redraw more than necessary
        this.players.forEach(player => player.render(ctx));
        this.player.render(ctx);
    }
}

class Player {
    static assets = {};

    static async loadAssets() {
        const assetsList = [
            'fFallLeft', 'fFallRight', 'fIdleLeft', 'fIdleRight', 'fJumpLeft', 
            'fJumpRight', 'fWalkLeft1', 'fWalkLeft2', 'fWalkLeft3', 'fWalkRight1',
            'fWalkRight2', 'fWalkRight3',
        ];

        const assetLoad = assetsList.map(asset => {
            return new Promise((res, rej) => {
                Player.assets[asset] = new Image();
                Player.assets[asset].src = `img/${asset}.png`;
                Player.assets[asset].onload = res;
                Player.assets[asset].onerror = () => {
                    alert(`Failed to load asset ${asset}`);
                    rej();
                }
            });
        });

        await Promise.all(assetLoad);
    }

    constructor() {
        this.position = new Vector(0, 0);
        this.skin = 'fIdleRight';
    }

    render(ctx) {
        const width = Player.assets[this.skin].width;
        const height = Player.assets[this.skin].height;

        const x = -width / 2;
        const y = -height / 2;

        ctx.drawImage(Player.assets[this.skin], x, y, width, height);
    }
}

class LocalPlayer extends Player {
    constructor() {
        super();

        this.keyState = [];
        this.keyStateChanged = false;

        window.addEventListener('keydown', this.keyDown.bind(this));
        window.addEventListener('keyup', this.keyUp.bind(this));
        window.addEventListener('focusout', this.focusOut.bind(this));
    }

    keyDown(evt) {
        switch(evt.keyCode) {
            case KEYS.UP:
            case KEYS.LEFT:
            case KEYS.RIGHT:
                if(!this.keyState.includes(evt.keyCode)) {
                    evt.preventDefault();
                    this.keyState.push(evt.keyCode);
                    this.keyStateChanged = true;
                }
                break;
        }
    }

    keyUp(evt) {
        switch(evt.keyCode) {
            case KEYS.UP:
            case KEYS.LEFT:
            case KEYS.RIGHT:
                if(this.keyState.includes(evt.keyCode)) {
                    evt.preventDefault();
                    this.keyState = this.keyState.filter(k => k != evt.keyCode)
                    this.keyStateChanged = true;
                }
                break;
        }
    }

    focusOut() {
        this.keyState = [];
        this.keyStateChanged = true;
    }
}

class OnlinePlayer extends Player {
    constructor(relative) {
        super();
        // The player that this OnlinePlayer should be drawn relative to
        this.relative = relative;
    }

    render(ctx) {
        const width = Player.assets[this.skin].width;
        const height = Player.assets[this.skin].height;

        // Offset this OnlinePlayer's position by the main player's position
        const x = this.position.x - (width / 2) - this.relative.position.x;
        const y = this.position.y - (height / 2) - this.relative.position.y;

        ctx.drawImage(Player.assets[this.skin], x, y, width, height);
    }
}

class Canvas {
    constructor(selector) {
        let element = document.querySelector(selector);

        if('OffscreenCanvas' in window)
            element = element.transferControlToOffscreen();

        this.ctx = element.getContext('2d', { antialias: false });
        this.ctx.imageSmoothingEnabled = false;

        this.canvas = this.ctx.canvas;

        window.addEventListener('resize', this.resize.bind(this));

        this.resize();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.imageSmoothingEnabled = false;

        return this.ctx;
    }
}

(async function init() {
    await Player.loadAssets();

    const ws = new WebSocket(`ws://${window.location.hostname}:8081`);

    const { ctx } = new Canvas('#cinema-canvas');
    const screen = new Screen('#cinema-screen');
    const world = new World(screen, ws);

    let raf;

    await new Promise(res => {
        ws.addEventListener('open', res);
    });
    ws.addEventListener('close', () => cancelAnimationFrame(raf));
    ws.addEventListener('error', () => cancelAnimationFrame(raf));

    const update = () => {
        world.render(ctx);
        raf = requestAnimationFrame(update);
    }
    
    update();
})();
