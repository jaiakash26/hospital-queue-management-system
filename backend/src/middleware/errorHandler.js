// File: backend/src/middleware/errorHandler.js

// Create an error with an HTTP status, e.g. throw httpError(404, 'Not found')
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Express calls this whenever a route throws an error
function errorHandler(err, req, res, next) {
  // The double-booking index fired: someone took the slot first
  if (err.code === '23505' && err.constraint === 'uniq_active_slot') {
    return res.status(409).json({ message: 'That slot was just taken. Please choose another.' });
  }
  if (err.code === '23505') {
    return res.status(409).json({ message: 'This record already exists.' });
  }
  if (!err.status) console.error(err); // unexpected errors: print for us
  res.status(err.status || 500).json({
    message: err.status ? err.message : 'Server error. Please try again.',
  });
}

module.exports = { httpError, errorHandler };