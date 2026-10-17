import fs from 'fs';
import path from 'path';
import { pool } from './pool';

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const seedPath = path.join(__dirname, 'seed.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const seed = fs.readFileSync(seedPath, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(schema);
    await client.query(seed);
    await client.query('COMMIT');
    console.log('Database migrated and seeded successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
