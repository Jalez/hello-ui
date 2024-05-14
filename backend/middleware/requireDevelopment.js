const debug = require('debug');

// // Create logger for debugging
// // (Better console.log with colours and does not show any output in production)
const logger = debug('ui_designer:development-middleware');

const requireDevelopment = (req, res, next) => {
  const nodeEnv = req.app.get('environment');

  if (nodeEnv === 'development') {
    return next();
  }

  logger('Route accessible only in development mode');
  return res.sendStatus(404);
};

module.exports = requireDevelopment;
