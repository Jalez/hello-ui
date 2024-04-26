// import debug from 'debug';

// // Create logger for debugging
// // (Better console.log with colours and does not show any output in production)
// const log = debug('assignment-backend:json-middleware');

const requireJson = (req, res, next) => {
  if (!req.accepts('json')) {
    // log('Accept header is missing or client does not accept JSON');
    return res.sendStatus(406);
  }

  if (['POST', 'PUT'].includes(req.method.toUpperCase())) {
    if (!req.get('Content-Type') || !req.get('Content-Type').includes('json')) {
      // log('Missing Content-Type header or content type is not JSON');
      return res.sendStatus(415);
    }
  }

  next();
};

module.exports = requireJson;
