import winston from 'winston';
import { env } from '../config/env.js';

const format = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format,
  defaultMeta: { 
    service: 'worker',
    environment: env.NODE_ENV 
  },
  transports: [
    new winston.transports.Console({
      format: env.NODE_ENV === 'development' 
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        : format
    })
  ]
});

/**
 * Create child loggers for specific contexts
 */
export const createLogger = (context: string) => {
  return logger.child({ context });
};

/**
 * Log levels enum for consistent usage
 */
export const LogLevel = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
  VERBOSE: 'verbose'
} as const;

export type LogLevelType = typeof LogLevel[keyof typeof LogLevel];

/**
 * Structured logging helpers
 */
export const loggers = {
  job: createLogger('job'),
  queue: createLogger('queue'),
  publisher: createLogger('publisher'),
  health: createLogger('health'),
  redis: createLogger('redis'),
  api: createLogger('api')
};