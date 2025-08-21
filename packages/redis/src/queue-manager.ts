import { Queue, Worker, QueueEvents, type Job, type JobsOptions, type WorkerOptions } from 'bullmq';
import { RedisClient } from './index.js';

export interface QueueConfig {
  name: string;
  defaultJobOptions?: JobsOptions;
  workerOptions?: WorkerOptions;
}

export interface JobResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export class QueueManager {
  private static queues: Map<string, Queue> = new Map();
  private static workers: Map<string, Worker> = new Map();
  private static queueEvents: Map<string, QueueEvents> = new Map();

  static createQueue<T = unknown>(config: QueueConfig): Queue<T> {
    if (this.queues.has(config.name)) {
      return this.queues.get(config.name) as Queue<T>;
    }

    const connection = RedisClient.getQueueConnection();
    
    const queue = new Queue<T>(config.name, {
      connection: connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 24 * 3600,
          count: 100,
        },
        removeOnFail: {
          age: 7 * 24 * 3600,
          count: 500,
        },
        ...config.defaultJobOptions,
      },
    });

    this.queues.set(config.name, queue);
    return queue;
  }

  static createWorker<T = unknown, R = unknown>(
    queueName: string,
    processor: (job: Job<T>) => Promise<R>,
    options?: Partial<WorkerOptions>
  ): Worker<T, R> {
    if (this.workers.has(queueName)) {
      throw new Error(`Worker for queue "${queueName}" already exists`);
    }

    const connection = RedisClient.getQueueConnection();
    
    const worker = new Worker<T, R>(
      queueName,
      async (job) => {
        console.log(`Processing job ${job.id} in queue ${queueName}`);
        const startTime = Date.now();
        
        try {
          const result = await processor(job);
          const duration = Date.now() - startTime;
          
          console.log(`Job ${job.id} completed in ${duration}ms`);
          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          console.error(`Job ${job.id} failed after ${duration}ms:`, error);
          throw error;
        }
      },
      {
        ...options,
        connection: connection,
        concurrency: options?.concurrency ?? 5,
        limiter: options?.limiter ?? {
          max: 10,
          duration: 1000,
        },
      }
    );

    worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed successfully`);
    });

    worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed:`, err);
    });

    worker.on('error', (err) => {
      console.error('Worker error:', err);
    });

    this.workers.set(queueName, worker);
    return worker;
  }

  static createQueueEvents(queueName: string): QueueEvents {
    if (this.queueEvents.has(queueName)) {
      return this.queueEvents.get(queueName)!;
    }

    const connection = RedisClient.getQueueConnection();
    
    const events = new QueueEvents(queueName, {
      connection: connection,
    });

    events.on('waiting', ({ jobId }) => {
      console.log(`Job ${jobId} is waiting`);
    });

    events.on('active', ({ jobId, prev }) => {
      console.log(`Job ${jobId} is active (prev: ${prev})`);
    });

    events.on('completed', ({ jobId, returnvalue }) => {
      console.log(`Job ${jobId} completed with result:`, returnvalue);
    });

    events.on('failed', ({ jobId, failedReason }) => {
      console.error(`Job ${jobId} failed:`, failedReason);
    });

    this.queueEvents.set(queueName, events);
    return events;
  }

  static async getQueue(name: string): Promise<Queue | undefined> {
    return this.queues.get(name);
  }

  static async getWorker(name: string): Promise<Worker | undefined> {
    return this.workers.get(name);
  }

  static async pauseQueue(name: string): Promise<void> {
    const queue = this.queues.get(name);
    if (queue) {
      await queue.pause();
      console.log(`Queue "${name}" paused`);
    }
  }

  static async resumeQueue(name: string): Promise<void> {
    const queue = this.queues.get(name);
    if (queue) {
      await queue.resume();
      console.log(`Queue "${name}" resumed`);
    }
  }

  static async pauseWorker(name: string): Promise<void> {
    const worker = this.workers.get(name);
    if (worker) {
      await worker.pause();
      console.log(`Worker for queue "${name}" paused`);
    }
  }

  static async resumeWorker(name: string): Promise<void> {
    const worker = this.workers.get(name);
    if (worker) {
      await worker.resume();
      console.log(`Worker for queue "${name}" resumed`);
    }
  }

  static async getQueueStats(name: string) {
    const queue = this.queues.get(name);
    if (!queue) {
      return null;
    }

    const [
      waitingCount,
      activeCount,
      completedCount,
      failedCount,
      delayedCount,
      repeatCount,
    ] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.getRepeatableJobs().then(jobs => jobs.length),
    ]);

    return {
      name,
      waiting: waitingCount,
      active: activeCount,
      completed: completedCount,
      failed: failedCount,
      delayed: delayedCount,
      repeat: repeatCount,
      total: waitingCount + activeCount + delayedCount,
    };
  }

  static async cleanQueue(name: string, grace: number = 0): Promise<void> {
    const queue = this.queues.get(name);
    if (queue) {
      await queue.clean(grace, 1000, 'completed');
      await queue.clean(grace, 1000, 'failed');
      console.log(`Queue "${name}" cleaned`);
    }
  }

  static async drainQueue(name: string): Promise<void> {
    const queue = this.queues.get(name);
    if (queue) {
      await queue.drain();
      console.log(`Queue "${name}" drained`);
    }
  }

  static async obliterateQueue(name: string): Promise<void> {
    const queue = this.queues.get(name);
    if (queue) {
      await queue.obliterate({ force: true });
      this.queues.delete(name);
      console.log(`Queue "${name}" obliterated`);
    }
  }

  static async closeAll(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    for (const [name, worker] of this.workers) {
      closePromises.push(worker.close().then(() => {
        console.log(`Worker for queue "${name}" closed`);
        this.workers.delete(name);
      }));
    }

    for (const [name, queue] of this.queues) {
      closePromises.push(queue.close().then(() => {
        console.log(`Queue "${name}" closed`);
        this.queues.delete(name);
      }));
    }

    for (const [name, events] of this.queueEvents) {
      closePromises.push(events.close().then(() => {
        console.log(`Queue events for "${name}" closed`);
        this.queueEvents.delete(name);
      }));
    }

    await Promise.all(closePromises);
  }

  static async monitorQueues(): Promise<Map<string, QueueStats>> {
    const stats = new Map();
    
    for (const [name] of this.queues) {
      const queueStats = await this.getQueueStats(name);
      if (queueStats) {
        stats.set(name, queueStats);
      }
    }
    
    return stats;
  }
}

export default QueueManager;