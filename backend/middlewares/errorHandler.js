// Postgres errors that reach here unhandled are caller mistakes, not crashes: answer them as such
// without echoing the SQL text (table, column and constraint names) back to the browser.
const PG_ERRORS = {
  23505: [409, 'A record with these details already exists.'],
  23503: [409, 'This record is linked to other records, so it cannot be changed or removed this way.'],
  23502: [400, 'A required value is missing.'],
  23514: [400, 'A value is outside what is allowed.'],
  '22P02': [400, 'A value has the wrong format.'],
  22007: [400, 'A date or time is not valid.'],
  22008: [400, 'A date or time is out of range.'],
  22003: [400, 'A number is out of range.'],
  22001: [400, 'A value is too long.'],
  42703: [400, 'A field in the request is not recognised.'],
  22021: [400, 'The request contains characters that are not allowed.']
};

function errorHandler(error, req, res, next) {
  // Pool exhausted or a lock not granted in time: the server is busy, the request can be retried.
  if (!error.statusCode && (error.code === '55P03' || /timeout exceeded when trying to connect/i.test(error.message || ''))) {
    error.statusCode = 503;
    error.message = 'The server is busy right now. Please try again in a moment.';
  }
  const explicit = error.statusCode || error.status;
  const pg = !explicit && error.code ? PG_ERRORS[error.code] : null;
  const statusCode = explicit || (pg ? pg[0] : 500);
  // Errors thrown on purpose carry a status and a message meant for the user. Anything else is
  // unexpected, and its message can hold internals, so the client gets a generic one.
  const message = pg ? pg[1] : (explicit ? error.message : 'Internal Server Error') || 'Internal Server Error';

  if (statusCode >= 500 || pg) {
    console.error(error);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(statusCode < 500 && error.details ? { details: error.details } : {}),
    // Opt-in: a server started without NODE_ENV must not hand stack traces to browsers.
    ...(['development', 'test'].includes(process.env.NODE_ENV) ? { stack: error.stack } : {})
  });
}

module.exports = errorHandler;
