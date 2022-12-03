const express = require('express');
const crypto = require('crypto');
const app = express();
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

const CHAT_BOT = 'TORP Manager';

let chatRoom = '';
let allUsers = [];
let publicKeys = {}; // Example : { foobar: { Alice: 'asd', Bob: 'asd' } }
let userNumber = {}; // Example : { foobar: 1}}

io.on('connection', (socket) => {
  console.log(`User connected ${socket.id}`);

  socket.on('new_room', (data) => {
    let __createdtime__ = new Date();
    let randomRoomName = crypto
      .createHash('sha256')
      .update(String(__createdtime__) + 'torp123')
      .digest('hex')
      .substring(0, 8);

    let username = 'Alice';
    let room = randomRoomName;

    socket.join(room);
    publicKeys[room] = {};
    userNumber[room] = 1;

    io.to(room).emit('receive_roomName', room);

    chatRoom = room;
    allUsers.push({ id: socket.id, room });
  });

  socket.on('join_room', (data) => {
    const { username, room } = data;

    if (userNumber[room] >= 2) {
      // 이미 2명 이상이 방에 있었으면 방 폭파
      socket.emit('room_expired_third_person'); // 새로 들어온 사람
      io.to(room).emit('room_expired_third_person'); // 원래 있던 사람들

      if (publicKeys[room]) delete publicKeys[room];
      if (userNumber[room]) delete userNumber[room];
    } else if (!publicKeys[room] || !userNumber[room]) {
      // 방이 없을 경우
      socket.emit('room_not_exist');

      if (publicKeys[room]) delete publicKeys[room];
      if (userNumber[room]) delete userNumber[room];
    } else {
      userNumber[room] += 1;

      socket.join(room);

      chatRoom = room;
      allUsers.push({ id: socket.id, room });
    }
  });

  socket.on('send_publicKey', (data) => {
    const { username, room, publicKey } = data;
    if (publicKeys[room] == undefined) publicKeys[room] = {};
    publicKeys[room][username] = publicKey;

    if (publicKeys[room]['Alice'] && publicKeys[room]['Bob']) {
      let data1 = { username: 'Alice', room: room, publicKey: publicKeys[room]['Alice'] };
      let data2 = { username: 'Bob', room: room, publicKey: publicKeys[room]['Bob'] };

      io.to(room).emit('receive_publicKey', data1);
      io.to(room).emit('receive_publicKey', data2);
    }
  });

  socket.on('send_message', (data) => {
    const { message, username, room } = data;
    io.to(room).emit('receive_message', data);
  });

  socket.on('disconnect', () => {
    const user = allUsers.find((user) => user.id == socket.id);
    if (user?.room) {
      chatRoom = user?.room;
      socket.to(chatRoom).emit('room_expired_opponent_disconnected');

      if (publicKeys[chatRoom]) delete publicKeys[chatRoom];
      if (userNumber[chatRoom]) delete userNumber[chatRoom];
      allUsers = allUsers.filter((user) => user.id != socket.id);
    }
  });
});

server.listen(4000, () => 'Server is running on port 4000');
