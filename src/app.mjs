'use strict';

import Koa from 'koa';
import WebSocket from 'ws';
import Serve from 'koa-static';
import { v4 } from 'uuid';

const app = new Koa();
app.use(Serve('src/public'));

import { KEYS, EVENTS, ASSETS } from './public/js/consts.mjs';

const wss = new WebSocket.Server({
    port: 8081,
});

const UPDATE_INTERVAL = 1000 / 144;

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
        this.updateSkin(1);
    }

    updateSkin(direction) {
        this.direction = direction;

        const verb = () => {
            if(this.falling)
                return 'Fall';
            if(this.jumping)
                return 'Jump';
            if(this.walking)
                return 'Walk';
            return 'Idle';
        };

        const dir = () => {
            if(this.direction == 1)
                return 'Right';
            if(this.direction == -1)
                return 'Left';
        };

        const variant = `${(Math.round(Math.abs(this.position.x) / 50) % 3) + 1}`;

        this.skin = `${verb()}${dir()}${this.walking ? variant : ""}`;
    }
}

const players = new Map();

wss.on('connection', ws => {
    ws.uuid = v4();

    const player = new Player(ws.uuid);
    players.set(ws.uuid, player);

    ws.on('message', evt => {
        const data = JSON.parse(evt);
        const { event } = data;

        switch(event) {
            case EVENTS.KEYS:
                const { keyState } = data;
                const player = players.get(ws.uuid);

                if(player)
                    player.keyState = keyState;

                break;
        }
    });

    ws.on('close', () => {
        players.delete(ws.uuid);

        const data = JSON.stringify({
            event: EVENTS.LEAVE,
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
        event: EVENTS.UUID,
        uuid: ws.uuid,
    }));

    {
        const data = JSON.stringify({
            event: EVENTS.POSITION,
            uuid: player.uuid,
            skin: player.skin,
            position: player.position,
        });

        for(const client of wss.clients) {
            if(client.readyState !== WebSocket.OPEN)
                return;

            if(client.uuid == ws.uuid)
                continue;

            client.send(data);
        }
    }

    players.forEach(({ uuid, skin, position }) => {
        const data = JSON.stringify({
            event: EVENTS.POSITION,
            uuid,
            skin,
            position,
        });

        ws.send(data);
    });
});

function update() {
    // Tracks players which have updates
    const updated = [];

    players.forEach(player => {
        const prev = {
            skin: player.skin,
            x: player.position.x,
            y: player.position.y,
        };

        const falling = player.velocity.y > 0 && player.position.y != 0;
        const jumping = player.keyState.includes(KEYS.UP) || (player.velocity.y < 0 && player.position.y != 0);

        player.falling = falling;
        player.jumping = jumping;

        if(player.keyState.includes(KEYS.UP)) {
            // Only allow player to jump if they're on the floor
            if(player.position.y == 0) {
                player.velocity.y = -10;
            }
        }

        if(player.keyState.includes(KEYS.LEFT)) {
            player.walking = !falling && !jumping;
            player.direction = 1
            player.velocity.x = 10;
        } else if(player.keyState.includes(KEYS.RIGHT)) {
            player.walking = !falling && !jumping;
            player.direction = -1;
            player.velocity.x = -10;
        } else {
            player.walking = false;
            player.idle = !player.keyState.includes(KEYS.UP) && !falling && !jumping;
        }

        // Gravity
        if(player.position.y != 0)
            player.velocity.subtract(new Vector(0, -0.5));

        // Friction
        player.velocity.x /= 1.2;
        
        player.position.add(player.velocity);

        // Don't let player fall below floor
        player.position.y = Math.min(player.position.y, 0);

        player.position.x = Math.round(player.position.x);
        player.position.y = Math.round(player.position.y);

        player.updateSkin(player.direction);

        if(player.position.x != prev.x || player.position.y != prev.y) {
            updated.push(player);
        } else if(player.skin != prev.skin) {
            updated.push(player);
        }
    });

    for(const { uuid, skin, position } of updated) {
        const data = JSON.stringify({
            event: EVENTS.POSITION,
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