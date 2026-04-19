import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'
import bcrypt from 'bcryptjs'

const TOKEN = 'e68686c54de618deb4cd7a2f8ce029b87afcafd906fdca46'
const EMAIL = 'matyasjh@gmail.com'
const NEW_PASSWORD = 'Matyas2026!'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (token !== TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const client = await pool.connect()
  try {
    const hash = await bcrypt.hash(NEW_PASSWORD, 10)
    const res = await client.query(
      'UPDATE "User" SET password_hash = $1 WHERE email = $2 RETURNING id, email, name',
      [hash, EMAIL.toLowerCase()]
    )

    if (res.rowCount === 0) {
      return NextResponse.json({ error: `User ${EMAIL} not found` }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      message: `Heslo pro ${EMAIL} přenastaveno na "${NEW_PASSWORD}". Endpoint bude smazán v dalším commitu.`,
      user: res.rows[0],
    })
  } finally {
    client.release()
  }
}
