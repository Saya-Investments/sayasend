// Runner one-off para aplicar un .sql contra la BD usando el cliente Prisma.
// Uso: node prisma/run-sql.mjs prisma/<archivo>.sql
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'

const file = process.argv[2]
if (!file) {
  console.error('Falta la ruta del .sql')
  process.exit(1)
}

const sql = readFileSync(file, 'utf8')
// Quita las líneas de comentario primero, luego divide por ';' a nivel de
// sentencia (las migraciones aquí no usan funciones/$$).
const statements = sql
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.length > 0)

const prisma = new PrismaClient()

try {
  for (const stmt of statements) {
    console.log('>>', stmt.split('\n').filter((l) => !l.trim().startsWith('--')).join(' ').slice(0, 80), '...')
    await prisma.$executeRawUnsafe(stmt)
  }
  console.log('OK: migración aplicada.')
} catch (err) {
  console.error('ERROR:', err.message)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
