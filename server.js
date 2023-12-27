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

  const userId = socket.id;
  socket.on('updatePosition', (data) => {
    try {
        const userPosition = JSON.parse(data);
        console.log(userPosition)
        usersPositions[userId] = userPosition;
    } catch (err) {

    } finally {
        console.log('Send latest location')
        io.sockets.emit('latestPosition', JSON.stringify(usersPositions));
    }
  });  

  socket.on('disconnect', () => {
    console.log('Client disconnected');
    delete usersPositions[userId];
    io.sockets.emit('latestPosition', JSON.stringify(usersPositions));
  });
  
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
