import Link from 'next/link'
import {
  CalendarDays, Users, Bell, BarChart3, ShieldCheck, Smartphone,
  ArrowRight, CheckCircle2, Zap, Star,
} from 'lucide-react'
import { InstallButton } from '@/components/shared/InstallButton'

const FEATURES = [
  {
    icon: CalendarDays,
    title: 'Týdenní plán směn',
    desc: 'Grid na celý týden. Vidíte obsazenost každého dne na první pohled.',
    color: 'bg-indigo-50 text-indigo-600',
  },
  {
    icon: Users,
    title: 'Správa zaměstnanců',
    desc: 'Profily, hodiny, dostupnost. Pozvěte tým přes kód nebo odkaz.',
    color: 'bg-violet-50 text-violet-600',
  },
  {
    icon: Bell,
    title: 'Otevřené směny',
    desc: 'Zaměstnanci se sami hlásí na volné směny. Vy jen schvalujete.',
    color: 'bg-amber-50 text-amber-600',
  },
  {
    icon: BarChart3,
    title: 'Přehled v reálném čase',
    desc: 'Dashboard s pokrytím, hodinami a statistikami. Vždy víte kde máte mezery.',
    color: 'bg-green-50 text-green-600',
  },
  {
    icon: ShieldCheck,
    title: 'Více rolí',
    desc: 'Super admin, manažer, zaměstnanec — každý vidí jen to, co potřebuje.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: Smartphone,
    title: 'Funguje všude',
    desc: 'Responzivní design — na počítači, tabletu i mobilu. Vždy dostupné.',
    color: 'bg-rose-50 text-rose-600',
  },
]

const STEPS = [
  { num: '01', title: 'Zaregistrujte podnik', desc: 'Vyplňte název, adresu a svůj účet. Trvá to 30 sekund.' },
  { num: '02', title: 'Pozvěte zaměstnance', desc: 'Sdílejte kód podniku nebo odkaz. Tým se připojí za minutu.' },
  { num: '03', title: 'Plánujte směny', desc: 'Vytvářejte směny, přiřazujte lidi a sledujte pokrytí.' },
]

const PRICING = [
  {
    name: 'Free',
    price: '0',
    unit: 'navždy',
    desc: 'Pro malé podniky do 5 zaměstnanců',
    features: ['Až 5 zaměstnanců', 'Týdenní plán směn', 'Základní dashboard', 'Otevřené směny'],
    cta: 'Začít zdarma',
    href: '/register',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '490',
    unit: 'Kč / měsíc',
    desc: 'Pro rostoucí podniky bez omezení',
    features: ['Neomezený počet zaměstnanců', 'Pokročilá analytika', 'Více podniků v jednom účtu', 'Export PDF / Excel', 'Prioritní podpora'],
    cta: 'Vyzkoušet 14 dní zdarma',
    href: '/register?plan=pro',
    highlight: true,
  },
]

const DEMO_ACCOUNTS = [
  { label: 'Manažer', email: 'manager@demo.cz', color: 'bg-indigo-600' },
  { label: 'Zaměstnanec', email: 'tereza@demo.cz', color: 'bg-violet-600' },
  { label: 'Super admin', email: 'admin@demo.cz', color: 'bg-slate-600' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <CalendarDays className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg tracking-tight">Směny</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
            <a href="#funkce" className="hover:text-slate-900 transition-colors">Funkce</a>
            <a href="#jak-to-funguje" className="hover:text-slate-900 transition-colors">Jak to funguje</a>
            <a href="#cenik" className="hover:text-slate-900 transition-colors">Ceník</a>
          </div>
          <div className="flex items-center gap-3">
            <InstallButton />
            <Link href="/login" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
              Přihlásit se
            </Link>
            <Link href="/register" className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm">
              Začít zdarma
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white pt-20 pb-28 px-6">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:48px_48px] opacity-60" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-100/50 rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-8">
            <Zap className="w-3 h-3" />
            Plánování směn pro kavárny a malé podniky
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-slate-900 tracking-tight leading-[0.9] mb-6">
            Konec s Excel<br />
            <span className="text-indigo-600">tabulkami</span>
          </h1>

          <p className="text-lg text-slate-500 max-w-xl mx-auto mb-10 leading-relaxed">
            Plánujte směny, spravujte tým a sledujte pokrytí — vše na jednom místě.
            Zaměstnanci se hlásí sami, vy jen schvalujete.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-16">
            <Link href="/register" className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3.5 rounded-xl transition-all hover:-translate-y-0.5 shadow-lg shadow-indigo-200">
              Začít zdarma <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/login" className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-6 py-3.5 rounded-xl border border-slate-200 transition-all hover:-translate-y-0.5 shadow-sm">
              Vyzkoušet demo
            </Link>
          </div>

          {/* UI mockup */}
          <div className="relative max-w-3xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-200/80 overflow-hidden">
              {/* Browser bar */}
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-slate-100 bg-slate-50">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <div className="flex-1 mx-4 h-5 bg-white rounded border border-slate-200 flex items-center px-2">
                  <span className="text-[10px] text-slate-400">smenky.app/dashboard</span>
                </div>
              </div>
              {/* App UI */}
              <div className="flex h-56 bg-slate-50">
                <div className="w-44 bg-white border-r border-slate-100 p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
                    <div className="w-5 h-5 bg-indigo-600 rounded flex items-center justify-center">
                      <div className="w-2.5 h-2.5 bg-white rounded-sm" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-800">Kavárna Aroma</span>
                  </div>
                  {['Dashboard', 'Směny', 'Otevřené', 'Zaměstnanci'].map((item, i) => (
                    <div key={item} className={`px-2 py-1.5 rounded-lg text-[11px] font-medium flex items-center gap-1.5 ${i === 0 ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-indigo-500' : 'bg-transparent'}`} />
                      {item}
                    </div>
                  ))}
                </div>
                <div className="flex-1 p-4 overflow-hidden">
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[
                      { label: 'Dnešní směny', val: '4', color: 'text-indigo-600' },
                      { label: 'Otevřené', val: '2', color: 'text-amber-600' },
                      { label: 'Zaměstnanci', val: '6', color: 'text-green-600' },
                      { label: 'Hodiny/týden', val: '112h', color: 'text-violet-600' },
                    ].map(s => (
                      <div key={s.label} className="bg-white rounded-lg border border-slate-100 p-2">
                        <div className={`text-sm font-black ${s.color}`}>{s.val}</div>
                        <div className="text-[9px] text-slate-400 leading-tight mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white rounded-lg border border-slate-100 p-2 mb-2">
                    <div className="text-[9px] text-slate-400 mb-1.5">Pokrytí tento týden</div>
                    <div className="flex gap-1">
                      {['bg-green-400','bg-green-400','bg-amber-400','bg-green-400','bg-green-400','bg-red-300','bg-amber-400'].map((c, i) => (
                        <div key={i} className={`flex-1 h-4 rounded ${c}`} />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {[
                      { name: 'Tereza M.', role: 'Barista', time: '07:00–15:00' },
                      { name: 'Lukáš D.', role: 'Obsluha', time: '13:00–21:00' },
                    ].map(s => (
                      <div key={s.name} className="bg-white rounded border border-slate-100 px-2 py-1 flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-indigo-200 flex-shrink-0" />
                        <span className="text-[10px] font-semibold text-slate-700 flex-1">{s.name}</span>
                        <span className="text-[9px] text-slate-400">{s.role}</span>
                        <span className="text-[9px] text-slate-400">{s.time}</span>
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">✓</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-2/3 h-10 bg-indigo-300/25 blur-2xl rounded-full" />
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="py-10 border-y border-slate-100">
        <div className="max-w-4xl mx-auto px-6 flex flex-wrap items-center justify-center gap-8 text-sm text-slate-400 font-medium">
          <span className="flex items-center gap-2"><span className="text-amber-400">★★★★★</span> Hodnocení 4.9/5</span>
          <span className="w-px h-4 bg-slate-200 hidden sm:block" />
          <span>Kavárny & bistro & restaurace</span>
          <span className="w-px h-4 bg-slate-200 hidden sm:block" />
          <span>Bez instalace — funguje v prohlížeči</span>
          <span className="w-px h-4 bg-slate-200 hidden sm:block" />
          <span>Čeština nativně</span>
        </div>
      </section>

      {/* FEATURES */}
      <section id="funkce" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold tracking-widest text-indigo-600 uppercase mb-3">Funkce</p>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Vše co potřebujete</h2>
            <p className="text-slate-500 mt-3 max-w-md mx-auto">Žádné složité nastavení. Začnete plánovat za 5 minut.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className="p-6 rounded-2xl border border-slate-100 hover:border-indigo-100 hover:shadow-md transition-all">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 mb-1.5">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="jak-to-funguje" className="py-24 px-6 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold tracking-widest text-indigo-600 uppercase mb-3">Jak to funguje</p>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Tři kroky a jedete</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            {STEPS.map((step, i) => (
              <div key={step.num} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black text-sm mb-4 shadow-lg shadow-indigo-200">
                  {step.num}
                </div>
                <h3 className="font-bold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="cenik" className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold tracking-widest text-indigo-600 uppercase mb-3">Ceník</p>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Jasné ceny, bez překvapení</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {PRICING.map(plan => (
              <div key={plan.name} className={`rounded-2xl p-8 border-2 ${plan.highlight ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-200 bg-white'}`}>
                {plan.highlight && (
                  <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2.5 py-1 rounded-full mb-4">
                    <Star className="w-3 h-3" /> Nejoblíbenější
                  </div>
                )}
                <p className={`text-sm font-semibold mb-1 ${plan.highlight ? 'text-indigo-200' : 'text-slate-500'}`}>{plan.name}</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-black">{plan.price}</span>
                  <span className={`text-sm ${plan.highlight ? 'text-indigo-200' : 'text-slate-400'}`}>{plan.unit}</span>
                </div>
                <p className={`text-sm mb-6 ${plan.highlight ? 'text-indigo-200' : 'text-slate-500'}`}>{plan.desc}</p>
                <ul className="space-y-2.5 mb-8">
                  {plan.features.map(f => (
                    <li key={f} className={`flex items-center gap-2 text-sm ${plan.highlight ? 'text-white' : 'text-slate-700'}`}>
                      <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${plan.highlight ? 'text-indigo-200' : 'text-indigo-500'}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={plan.href} className={`block text-center font-bold py-3 rounded-xl transition-colors ${plan.highlight ? 'bg-white text-indigo-700 hover:bg-indigo-50' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DEMO */}
      <section className="py-20 px-6 bg-slate-900">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-black text-white tracking-tight mb-3">Vyzkoušejte demo hned teď</h2>
          <p className="text-slate-400 mb-8 text-sm">Žádná registrace. Vyberte roli a podívejte se jak aplikace funguje.</p>
          <div className="flex flex-wrap justify-center gap-3">
            {DEMO_ACCOUNTS.map(acc => (
              <Link
                key={acc.email}
                href={`/login?demo=${encodeURIComponent(acc.email)}`}
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
              >
                <div className={`w-7 h-7 rounded-lg ${acc.color} flex items-center justify-center text-[11px] font-black text-white`}>
                  {acc.label[0]}
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-white">{acc.label}</div>
                  <div className="text-[10px] text-slate-400">{acc.email}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-10 px-6 border-t border-slate-100">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center">
              <CalendarDays className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-slate-700">Směny</span>
          </div>
          <p className="text-xs text-slate-400">© 2026 Směny organizátor · Demo verze</p>
          <div className="flex gap-5 text-xs text-slate-400">
            <Link href="/login" className="hover:text-slate-700 transition-colors">Přihlásit se</Link>
            <Link href="/register" className="hover:text-slate-700 transition-colors">Registrace</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
