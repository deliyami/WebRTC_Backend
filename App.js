const express = require('express')
const app = express()
const { Server } = require('socket.io');
const server = require('http').createServer(app)
require('dotenv').config()
// process.env.FRONTEND_PORT...
const FRONTEND_URL = `${process.env.FRONTEND_HOST}:${process.env.FRONTEND_PORT}`
const io = new Server(server, {
  cors: {
    origin: "http://localhost:7070",
    methods: ['GET', 'POST'],
    allowedHeaders: ["my-custom-header"],
    credentials: true,
  }
})

const chatRoom = {}

const userJoinedRoom = {}

const MAX = 2

io.on('connection', (socket) => {
  console.log('connection:', socket.id)
  socket.on("join_room", (data) => {
    console.log('join_room:', socket.id, data)
    // 방이 기존에 생성되어 있다면
    if (chatRoom[data.room]) {
      // 현재 입장하려는 방에 있는 인원수
      const currentRoomLength = chatRoom[data.room].length;
      if (currentRoomLength === MAX) {
        // 인원수가 꽉 찼다면 돌아갑니다.
        socket.to(socket.id).emit("room_full");
        return;
      }

      // 여분의 자리가 있다면 해당 방 배열에 추가해줍니다.
      chatRoom[data.room] = [...chatRoom[data.room], { id: socket.id }];
    } else {
      // 방이 존재하지 않다면 값을 생성하고 추가해줍시다.
      chatRoom[data.room] = [{ id: socket.id }];
    }
    userJoinedRoom[socket.id] = data.room;

    // 입장
    socket.join(data.room);

    // 입장하기 전 해당 방의 다른 유저들이 있는지 확인하고
    // 다른 유저가 있었다면 offer-answer을 위해 알려줍니다.
    const others = chatRoom[data.room].filter((user) => user.id !== socket.id);
    if (others.length) {
      io.sockets.to(socket.id).emit("all_users", others);
    }
  });

  socket.on("offer", (sdp, roomID) => {
    console.log('offer', socket.id)
    // offer를 전달받고 다른 유저들에게 전달해 줍니다.
    socket.to(roomID).emit("getOffer", sdp);
  });

  socket.on("answer", (sdp, roomID) => {
    console.log('answer', socket.id, roomID)
    // answer를 전달받고 방의 다른 유저들에게 전달해 줍니다.
    socket.to(roomID).emit("getAnswer", sdp);
  });

  socket.on("candidate", (candidate, roomID) => {
    console.log('candidate:', socket.id, roomID);
    // candidate를 전달받고 방의 다른 유저들에게 전달해 줍니다.
    socket.to(roomID).emit("getCandidate", candidate);
  });

  socket.on("disconnect", () => {
    console.log('disconnect:', socket.id);
    // 방을 나가게 된다면 socketRoom과 USERS의 정보에서 해당 유저를 지워줍니다.
    const roomID = userJoinedRoom[socket.id];

    if (chatRoom[roomID]) {
      chatRoom[roomID] = chatRoom[roomID].filter((user) => user.id !== socket.id);
      if (chatRoom[roomID].length === 0) {
        delete chatRoom[roomID];
        return;
      }
    }
    delete userJoinedRoom[socket.id];
    socket.broadcast.to(chatRoom[roomID]).emit("user_exit", { id: socket.id });
  });
})

app.get('/', (req, res) => {
  console.log('get /');
  res.send('hello, world!')
})

server.listen(process.env.PORT || 7014, () => {
  console.log(`Server is running in ${process.env.PORT}`)
})