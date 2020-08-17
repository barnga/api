const express = require('express');
const http = require('http');
const io = require('socket.io');
const index = require('./routes/index');

const port = process.env.port || 3000;
const app = express();
app.use(index);

const server = http.createServer(app);
const io = io(server);
