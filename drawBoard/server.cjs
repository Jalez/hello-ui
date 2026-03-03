const finalhandler = require('finalhandler');
const http = require('http');
const serveStatic = require('serve-static');

// Serve up build folder
const serve = serveStatic('dist', { index: ['index.html', 'index.htm'] });

// When behind a proxy at /drawboard, requests have path /drawboard/ or /drawboard/assets/...
// Strip the base path so serve-static finds dist/index.html and dist/assets/...
const BASE_PATH = process.env.BASE_PATH || '';
function stripBasePath(req) {
  if (BASE_PATH && req.url.startsWith(BASE_PATH)) {
    req.url = req.url.slice(BASE_PATH.length) || '/';
  }
}

const server = http.createServer(function onRequest (req, res) {
  stripBasePath(req);
  serve(req, res, finalhandler(req, res));
});

// Listen
server.listen(3500);
