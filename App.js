const express = require('express')
const app = express()
const { Server } = require('socket.io');
const server = require('http').createServer(app)
require('dotenv').config()
// process.env.FRONTEND_PORT...
const io = new Server(server, {
  cors: {
    origin: `${FRONTEND_HOST}:${FRONTEND_POST}`,
    methods: ['GET', 'POST'],
    allowedHeaders: ["my-custom-header"],
    credentials: true,
  }
})

const USERS = {}

const socketRoom = {}

const MAX = 2

io.on('connection', (socket) => {
  console.log(socket)
  socket.on("join_room", (data) => {
    // 방이 기존에 생성되어 있다면
    if (USERS[data.room]) {
      // 현재 입장하려는 방에 있는 인원수
      const currentRoomLength = USERS[data.room].length;
      if (currentRoomLength === MAX) {
        // 인원수가 꽉 찼다면 돌아갑니다.
        socket.to(socket.id).emit("room_full");
        return;
      }

      // 여분의 자리가 있다면 해당 방 배열에 추가해줍니다.
      USERS[data.room] = [...USERS[data.room], { id: socket.id }];
    } else {
      // 방이 존재하지 않다면 값을 생성하고 추가해줍시다.
      USERS[data.room] = [{ id: socket.id }];
    }
    socketRoom[socket.id] = data.room;

    // 입장
    socket.join(data.room);

    // 입장하기 전 해당 방의 다른 유저들이 있는지 확인하고
    // 다른 유저가 있었다면 offer-answer을 위해 알려줍니다.
    const others = USERS[data.room].filter((user) => user.id !== socket.id);
    if (others.length) {
      io.sockets.to(socket.id).emit("all_USERS", others);
    }
  });

  socket.on("offer", (sdp, roomName) => {
    // offer를 전달받고 다른 유저들에게 전달해 줍니다.
    socket.to(roomName).emit("getOffer", sdp);
  });

  socket.on("answer", (sdp, roomName) => {
    // answer를 전달받고 방의 다른 유저들에게 전달해 줍니다.
    socket.to(roomName).emit("getAnswer", sdp);
  });

  socket.on("candidate", (candidate, roomName) => {
    // candidate를 전달받고 방의 다른 유저들에게 전달해 줍니다.
    socket.to(roomName).emit("getCandidate", candidate);
  });

  socket.on("disconnect", () => {
    // 방을 나가게 된다면 socketRoom과 USERS의 정보에서 해당 유저를 지워줍니다.
    const roomID = socketRoom[socket.id];

    if (USERS[roomID]) {
      USERS[roomID] = USERS[roomID].filter((user) => user.id !== socket.id);
      if (USERS[roomID].length === 0) {
        delete USERS[roomID];
        return;
      }
    }
    delete socketRoom[socket.id];
    socket.broadcast.to(USERS[roomID]).emit("user_exit", { id: socket.id });
  });
})


app.listen(process.env.PORT || 7014, () => {
  console.log('Server is running')
  app.get('/', (req, res) => {
    res.send('hello, world!');
  })
})