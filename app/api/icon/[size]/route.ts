import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params
  const px = size === '512' ? 512 : 192
  const radius = Math.round(px * 0.18)
  const fontSize = Math.round(px * 0.6)

  return new ImageResponse(
    (
      <div style={{
        width: px, height: px,
        background: '#4f46e5',
        borderRadius: radius,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize,
        fontWeight: 900,
        fontFamily: 'sans-serif',
      }}>
        S
      </div>
    ),
    { width: px, height: px }
  )
}
