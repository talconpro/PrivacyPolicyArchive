import { mkdirSync, appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface LogPayload {
  stage: string;
  appId?: string;
  appName?: string;
  message: string;
  extra?: Record<string, unknown>;
}

export class TaskLogger {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = resolve(filePath);
    mkdirSync(dirname(this.filePath), { recursive: true });
  }

  private write(level: LogLevel, payload: LogPayload): void {
    const entry = {
      ts: new Date().toISOString(),
      level,
      ...payload,
    };

    const line = JSON.stringify(entry);
    console.log(line);
    appendFileSync(this.filePath, `${line}\n`, 'utf8');
  }

  info(payload: LogPayload): void {
    this.write('INFO', payload);
  }

  warn(payload: LogPayload): void {
    this.write('WARN', payload);
  }

  error(payload: LogPayload): void {
    this.write('ERROR', payload);
  }
}
