/** @format */

const finalhandler = require('finalhandler');
const http = require('http');
const serveStatic = require('serve-static');

// Serve up build folder
const serve = serveStatic('dist', { index: ['index.html', 'index.htm'] });

// Create server
const server = http.createServer(function onRequest(req, res) {
	// ('Cache-Control', 'no-cache'); to disable caching
	// res.setHeader('Cache-Control', 'no-cache');
	serve(req, res, finalhandler(req, res));
});

// Listen
server.listen(3000);
