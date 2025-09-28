import { Module, OnModuleInit } from '@nestjs/common';
import { ConsultasModule } from './consultas/consultas.module.js';
import { Pool } from 'pg';
import * as fs from 'fs';

@Module({
  imports: [ConsultasModule],
})
export class AppModule implements OnModuleInit {
  async onModuleInit() {
    const pool = new Pool({
      host: process.env.PGHOST,
      port: +(process.env.PGPORT || 5432),
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
    });

    const runIfExists = async (file: string) => {
      if (!fs.existsSync(file)) {
        console.log(`Skip ${file} (no existe)`);
        return;
      }
      const sql = fs.readFileSync(file, 'utf8');
      await pool.query(sql);
      console.log(`Ran ${file}`);
    };

    try {
      // idempotentes
      await runIfExists('/app/sql/000_init.sql');
      await runIfExists('/app/sql/001_add_notificado.sql');
      await runIfExists('/app/sql/002_extend_infracciones.sql'); // ← agrega arteria y actualiza la vista
    } finally {
      await pool.end();
    }
  }
}
