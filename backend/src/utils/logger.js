const winston = require('winston');
const config = require('../config');

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'cyan',
};

winston.addColors(colors);

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  config.nodeEnv === 'development'
    ? winston.format.combine(
      winston.format.colorize({ all: true }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${level}]: ${message}${metaStr}`;
      }),
    )
    : winston.format.combine(
      winston.format.json(),
    ),
);

const transports = [
  new winston.transports.Console({
    level: config.nodeEnv === 'development' ? 'debug' : 'info',
  }),
];

const logger = winston.createLogger({
  levels,
  format,
  transports,
  exitOnError: false,
});

module.exports = logger;
