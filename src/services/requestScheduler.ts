
import { delay } from './geminiService';
import { useConfigStore } from '../stores/useConfigStore';

type Task<T> = () => Promise<T>;

interface QueuedTask<T> {
  task: Task<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
  priority: number;
  timestamp: number;
}

class RequestScheduler {
  private static instance: RequestScheduler;
  private queue: QueuedTask<any>[] = [];
  private isProcessing: boolean = false;
  
  private lastRequestTime: number = 0;

  private constructor() {}

  public static getInstance(): RequestScheduler {
    if (!RequestScheduler.instance) {
      RequestScheduler.instance = new RequestScheduler();
    }
    return RequestScheduler.instance;
  }

  public async schedule<T>(task: Task<T>, priority: number = 0): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ task, resolve, reject, priority, timestamp: Date.now() });
      // Sort by priority (higher first), then by timestamp (earlier first)
      this.queue.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return a.timestamp - b.timestamp;
      });
      
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const now = Date.now();

      // Determine interval based on tier and model
      const config = useConfigStore.getState().config;
      const tier = config?.tier || 'free';
      const model = config?.model || 'gemini-3.1-pro-preview';
      
      let dynamicInterval = 3000;
      if (tier === 'paid') {
        // Paid tier is much faster but still has limits for Pro (25 RPM)
        if (model.includes('pro')) {
          dynamicInterval = 3000; // 20 RPM safety margin
        } else {
          dynamicInterval = 1500;  // ~40 RPM safety
        }
      } else {
        // Free tier model-specific RPM logic
        // 5 RPM → 60000/5 = 12000ms minimum; use 13500ms for safety margin
        if (model.includes('pro')) {
          dynamicInterval = 13500;  // Conservative 5 RPM
        } else if (model.includes('flash-lite')) {
          dynamicInterval = 4500;   // ~13 RPM (Limit is 15)
        } else if (model.includes('flash')) {
          dynamicInterval = 4500;   // ~13 RPM
        } else {
          dynamicInterval = 5000;   // Default safety
        }
      }
      
      const timeSinceLast = now - this.lastRequestTime;
      
      if (timeSinceLast < dynamicInterval) {
        const waitTime = dynamicInterval - timeSinceLast;
        await delay(waitTime);
      }

      const item = this.queue.shift();
      if (item) {
        this.lastRequestTime = Date.now();
        try {
          const result = await item.task();
          item.resolve(result);
        } catch (error: any) {
          item.reject(error);
        }
      }
    }

    this.isProcessing = false;
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public reset() {
    this.queue = [];
    this.isProcessing = false;
    this.lastRequestTime = 0;
  }
}

export const requestScheduler = RequestScheduler.getInstance();
