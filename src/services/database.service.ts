import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.SUPABASE_DATABASE_URL,
    });
  }

  async onModuleInit() {
    console.log('Connecting to database...');
    await this.pool.connect();
    console.log('Database connected.');
  }

  async query<T>(queryText: string, values?: any[]): Promise<T[]> {
    const result = await this.pool.query(queryText, values);
    return result.rows;
  }

  async onModuleDestroy() {
    console.log('Closing database connection...');
    await this.pool.end();
  }
}
