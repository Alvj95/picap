import { useEffect, useMemo, useState } from 'react'
import type { Shift } from './types'
import { CalendarTab } from './components/CalendarTab'
import { HoursTab } from './components/HoursTab'
import { ProfileSheet } from './components/ProfileSheet'
import { RosterTab } from './components/RosterTab'
import { SwapsTab } from './components/SwapsTab'
import { isMe, mergeCompanyShifts } from './lib/roster'
import { emptyData, useAppData } from './lib/store'
import { readLink } from './lib/links'
import { applyAcceptedSwap, applyIncomingSwap, receiveLink } from './lib/swaps'

type Tab = 'calendar' | 'roster' | 'swaps' | 'hours'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'calendar', label: 'Mis turnos', icon: '📅' },
  { id: 'roster', label: 'Horario', icon: '📋' },
  { id: 'swaps', label: 'Cambios', icon: '🔄' },
  { id: 'hours', label: 'Horas', icon: '⏱️' },
]

const byDateTime = (a: Shift, b: Shift) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)

export default function App() {
  const [data, update] = useAppData()
  const [tab, setTab] = useState<Tab>('calendar')
  const [profileOpen, setProfileOpen] = useState(false)
  const [swapShiftId, setSwapShiftId] = useState('')
  const [notice, setNotice] = useState('')

  // Swap request/answer links arrive as "#cambio=…" (opened from WhatsApp).
  useEffect(() => {
    const handle = () => {
      const link = readLink(location.hash)
      if (!location.hash.includes('cambio=')) return
      history.replaceState(null, '', location.pathname + location.search)
      setTab('swaps')
      if (!link) return setNotice('El enlace del cambio está incompleto. Pide que te lo reenvíen.')
      update((d) => {
        const result = receiveLink(d, link)
        setNotice(result.notice)
        return result.data
      })
      requestAnimationFrame(() => document.querySelector('.content')?.scrollTo(0, 0))
    }
    handle()
    window.addEventListener('hashchange', handle)
    return () => window.removeEventListener('hashchange', handle)
  }, [update])

  const myRoster = useMemo(() => data.roster.filter((e) => isMe(e.employee, data.profile)), [data.roster, data.profile])
  // Things waiting on me: requests to answer and accepted changes to email.
  const pendingSwaps =
    data.incoming.filter((i) => i.status === 'pendiente').length +
    data.swaps.filter((s) => s.status === 'aceptado_companero').length

  const saveShift = (shift: Shift) => update((d) => ({
    ...d,
    shifts: [...d.shifts.filter((s) => s.id !== shift.id), shift].sort(byDateTime),
  }))

  const syncMine = () => {
    update((d) => ({ ...d, shifts: mergeCompanyShifts(d.shifts, d.roster, d.profile) }))
    setTab('calendar')
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">✈</span>
          <div>
            <div className="brand-name">Turnos Handling</div>
            <div className="brand-sub">{data.profile.name || 'Configura tu perfil'}</div>
          </div>
        </div>
        <button className="avatar" onClick={() => setProfileOpen(true)} aria-label="Mi perfil">
          {data.profile.name ? data.profile.name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() : '👤'}
        </button>
      </header>

      <main className="content">
        {!data.profile.name && (
          <button className="banner" onClick={() => setProfileOpen(true)}>
            👋 Empieza poniendo tu nombre tal como aparece en el horario de la empresa.
          </button>
        )}
        {notice && (
          <button className="banner notice" onClick={() => setNotice('')}>{notice} <span className="muted">✕</span></button>
        )}
        {tab === 'calendar' && (
          <CalendarTab
            shifts={data.shifts}
            myRoster={myRoster}
            onSave={saveShift}
            onDelete={(id) => update((d) => ({ ...d, shifts: d.shifts.filter((s) => s.id !== id) }))}
            onSwap={(s) => { setSwapShiftId(s.id); setTab('swaps') }}
          />
        )}
        {tab === 'roster' && (
          <RosterTab
            roster={data.roster}
            rosterName={data.rosterName}
            importedAt={data.rosterImportedAt}
            profile={data.profile}
            onSyncMine={syncMine}
            onImport={(result, name, myName) => update((d) => {
              const profile = myName && !isMe(myName, d.profile) ? { ...d.profile, name: myName } : d.profile
              const next = { ...d, profile, roster: result.entries, rosterName: name, rosterImportedAt: Date.now() }
              return myName ? { ...next, shifts: mergeCompanyShifts(d.shifts, result.entries, profile) } : next
            })}
          />
        )}
        {tab === 'swaps' && (
          <SwapsTab
            shifts={data.shifts}
            roster={data.roster}
            profile={data.profile}
            swaps={data.swaps}
            incoming={data.incoming}
            selectedId={swapShiftId}
            onSelect={setSwapShiftId}
            onCreate={(swap) => update((d) => ({ ...d, swaps: [...d.swaps, swap] }))}
            onUpdate={(id, patch) => update((d) => ({ ...d, swaps: d.swaps.map((s) => (s.id === id ? { ...s, ...patch } : s)) }))}
            onApprove={(swap) => update((d) => applyAcceptedSwap(d, swap))}
            onSchedulingEmail={(email) => update((d) => ({ ...d, profile: { ...d.profile, schedulingEmail: email } }))}
            onAnswer={(id, ok) => update((d) => ({
              ...d,
              incoming: d.incoming.map((i) => (i.id === id ? { ...i, status: ok ? 'aceptado' : 'rechazado' } : i)),
            }))}
            onApplyIncoming={(inc) => update((d) => applyIncomingSwap(d, inc))}
          />
        )}
        {tab === 'hours' && <HoursTab shifts={data.shifts} />}
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            <span className="tab-icon">{t.icon}</span>
            <span>{t.label}</span>
            {t.id === 'swaps' && pendingSwaps > 0 && <span className="badge">{pendingSwaps}</span>}
          </button>
        ))}
      </nav>

      {profileOpen && (
        <ProfileSheet
          data={data}
          onClose={() => setProfileOpen(false)}
          onSave={(profile) => update((d) => ({ ...d, profile }))}
          onRestore={(restored) => update(() => restored)}
          onReset={() => update(() => emptyData())}
        />
      )}
    </div>
  )
}
