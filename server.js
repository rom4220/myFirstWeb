const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const usersPositions = {};



app.use(express.static('client'));

io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('updatePosition', (data) => {
    try {
        const userPosition = JSON.parse(data);
        console.log(userPosition)
        const {userId} = userPosition;
        usersPositions[userId] = userPosition;
    } catch (err) {

    } finally {
        console.log('发送最新位置')
        io.sockets.emit('latestPosition', JSON.stringify(usersPositions));
    }
  });  

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
  
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
