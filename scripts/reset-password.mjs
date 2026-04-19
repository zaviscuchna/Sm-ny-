import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

const [, , emailArg, passwordArg] = process.argv

if (!emailArg || !passwordArg) {
  console.error('Usage: node scripts/reset-password.mjs <email> <new-password>')
  process.exit(1)
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const email = emailArg.toLowerCase()
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false })

try {
  const hash = await bcrypt.hash(passwordArg, 10)
  const res = await pool.query(
    'UPDATE "User" SET password_hash = $1 WHERE email = $2 RETURNING id, email, name',
    [hash, email]
  )

  if (res.rowCount === 0) {
    console.error(`User with email ${email} not found`)
    process.exit(2)
  }

  const user = res.rows[0]
  console.log(`Password updated for ${user.email} (${user.name}, id=${user.id})`)
} catch (err) {
  console.error('Error:', err.message)
  process.exit(3)
} finally {
  await pool.end()
}
