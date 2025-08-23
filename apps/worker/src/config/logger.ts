import winston from 'winston';
import { env, monitoringConfig } from './env.js';

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

/**
 * Custom format for development environment
 */
const devFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
  return `${timestamp} [${level}]: ${message} ${metaString}`;
});

/**
 * Create Winston logger instance with environment-specific configuration
 */
function createLogger(): winston.Logger {
  const isDevelopment = env.NODE_ENV === 'development';
  const isTest = env.NODE_ENV === 'test';
  
  const transports: winston.transport[] = [];
  
  const loggerOptions: winston.LoggerOptions = {
    level: isTest ? 'error' : monitoringConfig.logLevel,
    format: combine(
      errors({ stack: true }),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      isDevelopment ? colorize() : json()
    ),
    defaultMeta: {
      service: 'planrrr-worker',
      environment: env.NODE_ENV,
    },
    transports,
  };

  // Console transport
  if (!isTest || monitoringConfig.logLevel === 'debug') {
    transports.push(
      new winston.transports.Console({
        format: isDevelopment
          ? combine(
              colorize(),
              timestamp({ format: 'HH:mm:ss' }),
              devFormat
            )
          : json(),
      })
    );
  }

  // File transports for production
  if (env.NODE_ENV === 'production') {
    // Error log file
    transports.push(
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 10485760, // 10MB
        maxFiles: 5,
        tailable: true,
      })
    );

    // Combined log file
    transports.push(
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 10485760, // 10MB
        maxFiles: 10,
        tailable: true,
      })
    );
  }

  return winston.createLogger(loggerOptions);
}

// Create and export logger instance
export const logger = createLogger();

/**
 * Log levels and their usage:
 * - error: Error events that might still allow the application to continue running
 * - warn: Potentially harmful situations
 * - info: Informational messages that highlight progress
 * - debug: Debug-level messages with detailed information
 * - verbose: Even more detailed information than debug
 */

/**
 * Structured logging helpers for consistent log format
 */
export const log = {
  error: (message: string, error?: Error, meta?: Record<string, unknown>) => {
    logger.error(message, {
      ...meta,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : undefined,
    });
  },

  warn: (message: string, meta?: Record<string, unknown>) => {
    logger.warn(message, meta);
  },

  info: (message: string, meta?: Record<string, unknown>) => {
    logger.info(message, meta);
  },

  debug: (message: string, meta?: Record<string, unknown>) => {
    logger.debug(message, meta);
  },

  verbose: (message: string, meta?: Record<string, unknown>) => {
    logger.verbose(message, meta);
  },

  job: {
    started: (jobName: string, jobId: string, data?: unknown) => {
      logger.info(`Job started: ${jobName}`, {
        jobId,
        jobName,
        data,
        event: 'job.started',
      });
    },

    completed: (jobName: string, jobId: string, result?: unknown) => {
      logger.info(`Job completed: ${jobName}`, {
        jobId,
        jobName,
        result,
        event: 'job.completed',
      });
    },

    failed: (jobName: string, jobId: string, error: Error, attemptsMade: number) => {
      logger.error(`Job failed: ${jobName}`, {
        jobId,
        jobName,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        attemptsMade,
        event: 'job.failed',
      });
    },

    retrying: (jobName: string, jobId: string, attempt: number, delay: number) => {
      logger.warn(`Job retrying: ${jobName}`, {
        jobId,
        jobName,
        attempt,
        delay,
        event: 'job.retrying',
      });
    },
  },

  social: {
    publishing: (platform: string, postId: string) => {
      logger.info(`Publishing to ${platform}`, {
        platform,
        postId,
        event: 'social.publishing',
      });
    },

    published: (platform: string, postId: string, platformPostId: string) => {
      logger.info(`Published to ${platform}`, {
        platform,
        postId,
        platformPostId,
        event: 'social.published',
      });
    },

    failed: (platform: string, postId: string, error: Error) => {
      logger.error(`Failed to publish to ${platform}`, {
        platform,
        postId,
        error: {
          message: error.message,
          stack: error.stack,
        },
        event: 'social.failed',
      });
    },

    rateLimit: (platform: string, retryAfter: number) => {
      logger.warn(`Rate limit hit for ${platform}`, {
        platform,
        retryAfter,
        event: 'social.rateLimit',
      });
    },
  },

  queue: {
    connected: (queueName: string) => {
      logger.info(`Queue connected: ${queueName}`, {
        queueName,
        event: 'queue.connected',
      });
    },

    error: (queueName: string, error: Error) => {
      logger.error(`Queue error: ${queueName}`, {
        queueName,
        error: {
          message: error.message,
          stack: error.stack,
        },
        event: 'queue.error',
      });
    },

    stalled: (queueName: string, jobId: string) => {
      logger.warn(`Job stalled in queue: ${queueName}`, {
        queueName,
        jobId,
        event: 'queue.stalled',
      });
    },
  },

  health: {
    check: (status: 'healthy' | 'unhealthy', details?: Record<string, unknown>) => {
      const logFn = status === 'healthy' ? logger.info : logger.error;
      logFn(`Health check: ${status}`, {
        status,
        details,
        event: 'health.check',
      });
    },
  },

  startup: (message: string, meta?: Record<string, unknown>) => {
    logger.info(message, {
      ...meta,
      event: 'startup',
    });
  },

  shutdown: (message: string, meta?: Record<string, unknown>) => {
    logger.info(message, {
      ...meta,
      event: 'shutdown',
    });
  },
};

export default logger;