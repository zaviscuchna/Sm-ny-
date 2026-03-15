'use client'

import { useState } from 'react'
import { Share, X } from 'lucide-react'

export function InstallButton() {
  const [showTip, setShowTip] = useState(false)

  const handleClick = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Směny organizátor',
        text: 'Plánování směn pro kavárny a malé podniky',
        url: window.location.origin,
      }).catch(() => {})
    } else {
      // Desktop — ukáž tip
      setShowTip(true)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200"
      >
        <Share className="w-4 h-4" />
        <span>Přidat na plochu</span>
      </button>

      {showTip && (
        <div className="absolute right-0 top-11 w-64 bg-slate-900 text-white text-xs rounded-xl p-3 shadow-xl z-50">
          <button onClick={() => setShowTip(false)} className="absolute top-2 right-2 text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
          <p className="font-semibold mb-1">Na iPhone:</p>
          <p className="text-slate-300 leading-relaxed">Otevři v Safari → klikni <strong className="text-white">⎙ Sdílet</strong> → <strong className="text-white">Přidat na plochu</strong></p>
          <div className="absolute -top-1.5 right-6 w-3 h-3 bg-slate-900 rotate-45" />
        </div>
      )}
    </div>
  )
}
