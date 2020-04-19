'use strict';

const KEYS = {
    UP: 38,
    LEFT: 39,
    RIGHT: 37,
};

const EVENT = {
    UUID: 0x1,
    POSITION: 0x2,
    LEAVE: 0x3,
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

class World {
    constructor(ws) {
        this.domVideo = document.querySelector('#cinema-screen');
        this.domVideoDimensions = {};

        this.updateVideoDimensions();

        this.ws = ws;
        this.ws.addEventListener('message', this.onMessage.bind(this))

        this.players = new Map();
        this.player = new Player();

        this.keyState = [];
        this.keyStateChanged = false;

        this.domCanvas.addEventListener('keydown', this.keyDown.bind(this), false);
        this.domCanvas.addEventListener('keyup', this.keyUp.bind(this), false);
        this.domCanvas.addEventListener('focusout', this.blur.bind(this), false);
        this.domCanvas.addEventListener('resize', this.resize.bind(this), false);
    }

    onMessage(evt) {
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
            player = this.player;
        } else {
            if(this.players.has(uuid)) {
                player = this.players.get(uuid);
            } else {
                player = new OnlinePlayer();
                this.players.set(uuid, player);
            }
        }

        player.skin = skin;
        player.position = position;
    }

    eventLeave({ uuid }) {
        this.players.delete(uuid);
    }

    keyDown(evt) {
        evt.preventDefault();

        switch(evt.keyCode) {
            case KEYS.UP:
            case KEYS.LEFT:
            case KEYS.RIGHT:
                if(!this.keyState.includes(evt.keyCode)) {
                    this.keyState.push(evt.keyCode);
                    this.keyStateChanged = true;
                }
                break;
        }
    }

    keyUp(evt) {
        evt.preventDefault();

        switch(evt.keyCode) {
            case KEYS.UP:
            case KEYS.LEFT:
            case KEYS.RIGHT:
                if(this.keyState.includes(evt.keyCode)) {
                    this.keyState = this.keyState.filter(k => k != evt.keyCode)
                    this.keyStateChanged = true;
                }
                break;
        }
    }

    resize() {
        this.updateVideoDimensions();
    }

    blur() {
        this.keyState = [];
    }

    updateVideoDimensions() {
        this.domVideoDimensions = this.domVideo.getBoundingClientRect();
    }

    render(ctx) {
        const top = -this.player.position.y;
        const left = (window.innerWidth / 2) - (this.domVideoDimensions.width / 2) - this.player.position.x;

        this.domVideo.style.top = `${top}px`;
        this.domVideo.style.left = `${left}px`;

        ctx.clearRect(-(window.innerWidth / 2), -(window.innerHeight / 2), window.innerWidth, window.innerHeight);

        if(this.keyStateChanged) {
            this.sendMessage({
                keyState: this.keyState,
            });
            this.keyStateChanged = false;
        }

        document.querySelector('#stats').innerText = `X: ${this.player.position.x} / Y: ${this.player.position.y}`;

        this.players.forEach(player => {
            player.render(ctx, this.player);
        });

        this.player.render(ctx)
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
            new Promise((res, rej) => {
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

        const x = -(width / 2);//this.position.x - (width / 2);
        const y = -(height / 2)//this.position.y;

        ctx.drawImage(Player.assets[this.skin], x, y, width, height);
    }
}

class OnlinePlayer extends Player {
    render(ctx, { position }) {
        const width = Player.assets[this.skin].width;
        const height = Player.assets[this.skin].height;

        // Offset this OnlinePlayer's position by the main player's position
        const x = this.position.x - (width / 2) - position.x;
        const y = this.position.y - (height / 2) - position.y;

        console.log({ x, y });

        ctx.drawImage(Player.assets[this.skin], x, y, width, height);
    }
}

class Canvas {
    constructor() {
        this.domcanvas = document.querySelector('#cinema-canvas');
        this.domcanvas = ('OffscreenCanvas' in window) ? 
            this.domcanvas.transferControlToOffscreen() : this.domcanvas;

        this.ctx = this.domcanvas.getContext('2d', { antialias: false });
        this.canvas = this.ctx.canvas;

        window.addEventListener('resize', this.resize.bind(this), false);

        this.init();
    }

    resize() {
        this.init();
    }

    init() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        this.ctx.translate(window.innerWidth / 2, window.innerHeight / 2);
        this.ctx.imageSmoothingEnabled = false;

        return this.ctx;
    }
}

(async function init() {
    const { ctx } = new Canvas();

    await Player.loadAssets();

    const ws = new WebSocket(`ws://${window.location.hostname}:8081`);
    const world = new World(ws);

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
