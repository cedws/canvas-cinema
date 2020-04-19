'use strict';

const Koa = require('koa');
const WebSocket = require('ws');
const { v4 } = require('uuid');

const app = new Koa();
app.use(require('koa-static')('src/public'));

const wss = new WebSocket.Server({
    port: 8081,
});

const UPDATE_INTERVAL = 1000 / 60;

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

    add(v) {
        this.x += v.x;
        this.y += v.y;
    }

    subtract(v) {
        this.x -= v.x;
        this.y -= v.y;
    }
}

class Player {
    constructor(uuid, position) {
        this.uuid = uuid;
        this.keyState = [];
        this.position = new Vector(0, 0);
        this.velocity = new Vector(0, 0);
        this.setSkin(1, false, false);
    }

    setSkin(direction, falling, jumping) {
        this.direction = direction;
        this.jumping = jumping;

        if(falling) {
            if(this.direction == 1)
                this.skin = 'fFallRight';
            if(this.direction == -1)
                this.skin = 'fFallLeft';
            return;
        }

        if(jumping) {
            if(this.direction == 1)
                this.skin = 'fJumpRight';
            if(this.direction == -1)
                this.skin = 'fJumpLeft';
            return;
        } 

        if(this.direction == 1)
            this.skin = 'fIdleRight';
        if(this.direction == -1)
            this.skin = 'fIdleLeft';
    }
}

const players = new Map();

wss.on('connection', ws => {
    ws.uuid = v4();

    const player = new Player(ws.uuid);
    players.set(ws.uuid, player);

    ws.on('message', message => {
        const { keyState } = JSON.parse(message);
        const player = players.get(ws.uuid);

        if(player)
            player.keyState = keyState;
    });

    ws.on('close', () => {
        players.delete(ws.uuid);

        const data = JSON.stringify({
            event: EVENT.LEAVE,
            uuid: ws.uuid,
        });

        for(const client of wss.clients) {
            if(client.readyState !== WebSocket.OPEN)
                continue;

            if(client.uuid == ws.uuid)
                continue;

            client.send(data);
        }
    })

    ws.send(JSON.stringify({
        event: EVENT.UUID,
        uuid: ws.uuid,
    }));

    players.forEach(({ uuid, skin, position }) => {
        const data = JSON.stringify({
            event: EVENT.POSITION,
            uuid,
            skin,
            position,
        });

        for(const client of wss.clients) {
            if(client.readyState !== WebSocket.OPEN)
                return;

            if(client.uuid == ws.uuid)
                continue;

            client.send(data);
        }   
    });
});

function update() {
    // Tracks players which have updates
    const updated = [];

    players.forEach(player => {
        const original = Object.assign({}, player);

        if(player.position.y == 0) {
            player.setSkin(player.direction, false, false);
        }

        const falling = player.velocity.y > 0 && player.position.y != 0;
        player.setSkin(player.direction, falling, player.jumping);

        if(player.keyState.includes(KEYS.LEFT)) {
            player.setSkin(1, falling, player.jumping);
            player.velocity.x = 10;
        }
        if(player.keyState.includes(KEYS.RIGHT)) {
            player.setSkin(-1, falling, player.jumping);
            player.velocity.x = -10;
        }
        if(player.keyState.includes(KEYS.UP)) {
            // Only allow player to jump if they're on the floor
            if(player.position.y == 0) {
                player.setSkin(player.direction, false, true);
                player.velocity.y = -10;
            }
        }

        // Gravity
        if(player.position.y != 0)
            player.velocity.subtract(new Vector(0, -0.3));

        // Friction
        player.velocity.x /= 1.2;
        
        player.position.add(player.velocity);

        // Don't let player fall below floor
        player.position.y = Math.min(player.position.y, 0);

        player.position.x = Math.round(player.position.x);
        player.position.y = Math.round(player.position.y);

        // Check if player data has updated
        if(player.skin != original.skin ||
                player.position.x != original.x || 
                player.position.y != original.y)
            updated.push(player);
    });

    for(const { uuid, skin, position } of updated) {
        const data = JSON.stringify({
            event: EVENT.POSITION,
            uuid,
            skin,
            position,
        });

        for(const client of wss.clients) {
            if (client.readyState !== WebSocket.OPEN)
                continue;

            client.send(data);
        }
    }
}

setInterval(update, UPDATE_INTERVAL);

app.listen(8080);