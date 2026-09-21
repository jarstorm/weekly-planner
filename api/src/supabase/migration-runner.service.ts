import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import { readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

// Corre supabase/migrations/*.sql que todavía no se aplicaron, al levantar
// el backend — sin esto, cada cambio de esquema requería pedirle al
// usuario que pegara SQL a mano en el editor de Supabase (pasó dos veces
// durante el desarrollo). Usa DATABASE_URL (conexión directa a Postgres,
// no la service_role key de la API REST) porque hace falta DDL — la
// service_role key de supabase-js no da SQL crudo. Esta es la ÚNICA pieza
// del backend que usa esa conexión; todo lo demás sigue con SupabaseService
// (service_role vía API REST, ver sección 0.1).
@Injectable()
export class MigrationRunnerService implements OnModuleInit {
  private readonly logger = new Logger(MigrationRunnerService.name);

  constructor(private readonly config: ConfigService) {}

  // Nunca deja que un fallo acá tumbe el arranque del backend — la app
  // tiene que poder levantar (y servir /health) igual aunque la DB de
  // migraciones esté momentáneamente inalcanzable; mismo criterio que
  // SupabaseService, que solo avisa en vez de tirar si falta config.
  async onModuleInit() {
    try {
      await this.run();
    } catch (err) {
      this.logger.error('Fallaron las migraciones automáticas — el backend sigue arrancando igual', err as Error);
    }
  }

  private async run() {
    const databaseUrl = this.config.get<string>('DATABASE_URL');
    if (!databaseUrl) {
      this.logger.warn('DATABASE_URL no configurada — migraciones automáticas deshabilitadas');
      return;
    }

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    try {
      await client.query(`
        create table if not exists _migrations (
          name text primary key,
          applied_at timestamptz not null default now()
        )
      `);

      const { rows } = await client.query<{ name: string }>('select name from _migrations');
      const applied = new Set(rows.map((r) => r.name));

      const dir = resolve(__dirname, '../../..', 'supabase', 'migrations');
      const files = readdirSync(dir)
        .filter((f) => f.endsWith('.sql'))
        .sort();

      for (const file of files) {
        if (applied.has(file)) continue;

        const sql = readFileSync(join(dir, file), 'utf-8');
        this.logger.log(`Aplicando migración: ${file}`);
        await client.query('begin');
        try {
          await client.query(sql);
          await client.query('insert into _migrations (name) values ($1)', [file]);
          await client.query('commit');
        } catch (err) {
          await client.query('rollback');
          throw new Error(`Migración ${file} falló: ${(err as Error).message}`);
        }
      }
    } finally {
      await client.end();
    }
  }
}
