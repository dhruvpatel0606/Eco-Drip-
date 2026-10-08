declare module 'ws' {
  export class WebSocketServer {
    constructor(options: any);
    on(event: string, listener: (...args: any[]) => void): void;
  }
}
