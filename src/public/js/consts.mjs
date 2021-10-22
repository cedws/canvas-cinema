export const KEYS = {
    UP: 38,
    LEFT: 39,
    RIGHT: 37,
};

export const EVENTS = {
    KEYS: 0x1,
    UUID: 0x2,
    POSITION: 0x3,
    LEAVE: 0x4,
};

export const ASSET_SCALE_FACTOR = 150;

export const ASSET_PLAYER_FALL_LEFT = 'FallLeft';
export const ASSET_PLAYER_FALL_RIGHT = 'FallRight';

export const ASSET_PLAYER_IDLE_LEFT = 'IdleLeft';
export const ASSET_PLAYER_IDLE_RIGHT = 'IdleRight';

export const ASSET_PLAYER_JUMP_LEFT = 'JumpLeft';
export const ASSET_PLAYER_JUMP_RIGHT = 'JumpRight';

export const ASSET_PLAYER_IDLE_WALKLEFT = [ 'WalkLeft1', 'WalkLeft2', 'WalkLeft3' ];
export const ASSET_PLAYER_IDLE_WALKRIGHT = [ 'WalkRight1', 'WalkRight2', 'WalkRight3' ];

export const ASSETS = [
    ASSET_PLAYER_FALL_LEFT,
    ASSET_PLAYER_FALL_RIGHT,
    ASSET_PLAYER_IDLE_LEFT,
    ASSET_PLAYER_IDLE_RIGHT,
    ASSET_PLAYER_JUMP_LEFT,
    ASSET_PLAYER_JUMP_RIGHT,
    ...ASSET_PLAYER_IDLE_WALKLEFT,
    ...ASSET_PLAYER_IDLE_WALKRIGHT,
];
