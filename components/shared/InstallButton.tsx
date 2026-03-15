'use client'

import { Share } from 'lucide-react'

export function InstallButton() {
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Směny organizátor',
        text: 'Plánování směn pro kavárny a malé podniky',
        url: window.location.origin,
      })
    } else {
      // Fallback — zkopíruj URL
      navigator.clipboard.writeText(window.location.origin)
    }
  }

  return (
    <button
      onClick={handleShare}
      title="Přidat na plochu"
      className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors px-2 py-1.5 rounded-lg hover:bg-indigo-50"
    >
      <Share className="w-4 h-4" />
      <span className="hidden sm:inline">Přidat na plochu</span>
    </button>
  )
}
