// Performance monitoring utility for Firebase operations
export class PerformanceMonitor {
  private static measurements: Map<string, number> = new Map();

  static start(operationName: string): void {
    this.measurements.set(operationName, performance.now());
    console.log(`🚀 Starting operation: ${operationName}`);
  }

  static end(operationName: string): number {
    const startTime = this.measurements.get(operationName);
    if (!startTime) {
      console.warn(`⚠️ No start time found for operation: ${operationName}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.measurements.delete(operationName);
    
    // Log performance with different colors based on duration
    if (duration < 1000) {
      console.log(`✅ Operation ${operationName} completed in ${duration.toFixed(2)}ms`);
    } else if (duration < 5000) {
      console.log(`⚡ Operation ${operationName} completed in ${duration.toFixed(2)}ms (slow)`);
    } else {
      console.log(`🐌 Operation ${operationName} completed in ${duration.toFixed(2)}ms (very slow)`);
    }

    return duration;
  }

  static async measure<T>(operationName: string, operation: () => Promise<T>): Promise<T> {
    this.start(operationName);
    try {
      const result = await operation();
      this.end(operationName);
      return result;
    } catch (error) {
      this.end(operationName);
      console.error(`❌ Operation ${operationName} failed:`, error);
      throw error;
    }
  }
}

// Network connection utility
export class NetworkMonitor {
  static isOnline(): boolean {
    return navigator.onLine;
  }

  static getConnectionType(): string {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection) {
      return connection.effectiveType || connection.type || 'unknown';
    }
    return 'unknown';
  }

  static getConnectionSpeed(): string {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection && connection.downlink) {
      return `${connection.downlink} Mbps`;
    }
    return 'unknown';
  }

  static logConnectionInfo(): void {
    console.log(`📡 Network Status: ${this.isOnline() ? 'Online' : 'Offline'}`);
    console.log(`📶 Connection Type: ${this.getConnectionType()}`);
    console.log(`⚡ Connection Speed: ${this.getConnectionSpeed()}`);
  }
}

// Cache utility for lot data
export class LotCache {
  private static cache: Map<string, { data: any; timestamp: number }> = new Map();
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static set(lotNumber: string, data: any): void {
    this.cache.set(lotNumber, {
      data,
      timestamp: Date.now()
    });
    console.log(`💾 Cached lot data for: ${lotNumber}`);
  }

  static get(lotNumber: string): any | null {
    const cached = this.cache.get(lotNumber);
    if (!cached) {
      return null;
    }

    const isExpired = Date.now() - cached.timestamp > this.CACHE_DURATION;
    if (isExpired) {
      this.cache.delete(lotNumber);
      console.log(`🗑️ Cache expired for lot: ${lotNumber}`);
      return null;
    }

    console.log(`✨ Cache hit for lot: ${lotNumber}`);
    return cached.data;
  }

  static clear(): void {
    this.cache.clear();
    console.log(`🧹 Cache cleared`);
  }

  static size(): number {
    return this.cache.size;
  }
}
