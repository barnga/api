const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const index = require('./routes/index');

const port = process.env.port || 3000;
const app = express();
app.use(index);

const server = http.createServer(app);
const io = socketIo(server);

server.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

io.on('connection', (socket) => {
  console.log('New client connected');
  socket.emit('message', 'test message :)');
  socket.on('message', (data) => {
    console.log(`Message from client: ${data}`);
  });
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});
