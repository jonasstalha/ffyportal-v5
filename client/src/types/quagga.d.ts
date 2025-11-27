declare module 'quagga' {
  interface QuaggaConfig {
    inputStream: {
      name?: string;
      type?: string;
      constraints?: {
        width?: number;
        height?: number;
        facingMode?: string;
        aspectRatio?: number;
      };
      target?: HTMLElement;
    };
    locator?: {
      patchSize?: string;
      halfSample?: boolean;
    };
    numOfWorkers?: number;
    decoder?: {
      readers?: string[];
    };
    locate?: boolean;
  }

  interface QuaggaResult {
    codeResult: {
      code: string;
      format: string;
      start: number;
      end: number;
      codeset: number;
      startInfo: {
        error: number;
        code: number;
        start: number;
        end: number;
      };
      decodedCodes: Array<{
        code: number;
        error: number;
        start: number;
        end: number;
      }>;
      endInfo: {
        error: number;
        code: number;
        start: number;
        end: number;
      };
      direction: number;
      format: string;
    };
    line: Array<{
      x: number;
      y: number;
    }>;
    angle: number;
    pattern: number[];
    box: number[][];
    boxes: number[][][];
  }

  interface QuaggaStatic {
    init(config: QuaggaConfig, callback: (err: Error | null) => void): void;
    start(): void;
    stop(): void;
    pause(): void;
    resume(): void;
    onDetected(callback: (result: QuaggaResult) => void): void;
    offDetected(callback: (result: QuaggaResult) => void): void;
    setReaders(readers: string[]): void;
  }

  const Quagga: QuaggaStatic;
  export default Quagga;
} 