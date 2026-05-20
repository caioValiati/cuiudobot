type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private log(level: LogLevel, message: string, meta?: any) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    if (meta !== undefined) {
      if (level === 'error') {
        console.error(`${prefix} ${message}`, meta);
      } else if (level === 'warn') {
        console.warn(`${prefix} ${message}`, meta);
      } else if (level === 'info') {
        console.info(`${prefix} ${message}`, meta);
      } else {
        console.debug(`${prefix} ${message}`, meta);
      }
    } else {
      if (level === 'error') {
        console.error(`${prefix} ${message}`);
      } else if (level === 'warn') {
        console.warn(`${prefix} ${message}`);
      } else if (level === 'info') {
        console.info(`${prefix} ${message}`);
      } else {
        console.debug(`${prefix} ${message}`);
      }
    }
  }

  debug(message: string, meta?: any) {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: any) {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: any) {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: any) {
    this.log('error', message, meta);
  }
}

export const logger = new Logger();
