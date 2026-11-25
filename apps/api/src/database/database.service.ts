import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import pg from 'pg';

const { Pool } = pg;

export interface QueryResult<T> {
  rows: T[];
  rowCount: number | null;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool!: pg.Pool;

  onModuleInit() {
    const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';
    let isLocal = false;
    try {
      const parsed = new URL(connectionString);
      isLocal = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
    } catch {
      isLocal = false;
    }

    this.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
    });

    this.pool.on('error', (err) => {
      this.logger.error('Unexpected error on idle database client', err);
    });
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
    }
  }

  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      if (process.env.NODE_ENV === 'development' && duration > 200) {
        this.logger.warn(`Slow query (${duration}ms): ${text}`);
      }
      return { rows: res.rows, rowCount: res.rowCount };
    } catch (error) {
      this.logger.error(`Database query failed: ${text}`, error);
      throw error;
    }
  }

  async transaction<T>(callback: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
