import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Směny organizátor',
    short_name: 'Směny',
    description: 'Plánování směn pro kavárny a malé podniky',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#4f46e5',
    orientation: 'portrait',
    icons: [
      { src: '/api/icon/192', sizes: '192x192', type: 'image/png' },
      { src: '/api/icon/512', sizes: '512x512', type: 'image/png' },
      { src: '/api/icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
