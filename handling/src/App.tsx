import { useMemo, useState } from 'react'
import type { Shift } from './types'
import { CalendarTab } from './components/CalendarTab'
import { HoursTab } from './components/HoursTab'
import { ProfileSheet } from './components/ProfileSheet'
import { RosterTab } from './components/RosterTab'
import { SwapsTab } from './components/SwapsTab'
import { isMe, mergeCompanyShifts } from './lib/roster'
import { emptyData, useAppData } from './lib/store'
import { applyAcceptedSwap } from './lib/swaps'

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

  const myRoster = useMemo(() => data.roster.filter((e) => isMe(e.employee, data.profile)), [data.roster, data.profile])
  const pendingSwaps = data.swaps.filter((s) => s.status === 'pendiente').length

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
            selectedId={swapShiftId}
            onSelect={setSwapShiftId}
            onCreate={(swap) => update((d) => ({ ...d, swaps: [...d.swaps, swap] }))}
            onStatus={(id, status) => update((d) => ({ ...d, swaps: d.swaps.map((s) => (s.id === id ? { ...s, status } : s)) }))}
            onAccept={(swap) => update((d) => applyAcceptedSwap(d, swap))}
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
