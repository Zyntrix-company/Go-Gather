const { validationResult } = require('express-validator');

/**
 * Express middleware that runs after express-validator checks.
 * If there are validation errors, returns a structured 422 response
 * and does NOT call next().
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).json({
      error: 'ValidationError',
      message: 'Request validation failed',
      statusCode: 422,
      details: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
        value: e.value,
      })),
    });
  }

  next();
};

module.exports = validate;
