const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const {Server} = require('socket.io');
const {createAdapter} = require('@socket.io/redis-adapter');
const Redis = require('ioredis');

const redis = new Redis();

const port = 7242;

const corsConfig = {
    origin: [
        'https://codenough.com'
    ]
};

if (process.env.LOCAL_RUN) {
    console.log('Local run, allowing all CORS origins');
    corsConfig.origin = '*';
}

const io = new Server(server, {
    cors: corsConfig
});

const pubClient = new Redis();
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));

const roomStates = {};

const getInitialRoomState = () => ({ });

const joinRoomMessageId = 'join-room';
const playerChangedMessageId = 'player-changed';

const setupJoinRoomMessageHandler = (socket) => {
    socket.on(joinRoomMessageId, (roomId, callback) => {
        const uppercaseRoomId = roomId.toUpperCase();

        socket.join(uppercaseRoomId);

        if (!roomStates[uppercaseRoomId]) {
            roomStates[uppercaseRoomId] = getInitialRoomState();
        }

        callback(roomStates[uppercaseRoomId]);
    });
};

const setupSetPlayerNameMessageHandler = (socket) => {
    socket.on(playerChangedMessageId, (player) => {
        console.log(player);

        socket.rooms.forEach(roomId => {
            redis.set(`${roomId}-players`, player).then(() => {
                socket.to(roomId).emit(playerChangedMessageId, roomStates[roomId]);
            });
        });
    });
};

io.on('connection', (socket) => {
    setupJoinRoomMessageHandler(socket);
    setupSetPlayerNameMessageHandler(socket);
});

server.listen(port, () => {
    console.log(`listening on *:${port}`);
});
