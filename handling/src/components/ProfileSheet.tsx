import { useState } from 'react'
import type { AppData, Profile } from '../types'
import { downloadFile, reviveData } from '../lib/store'
import { todayISO } from '../lib/time'
import { Sheet } from './Sheet'

type Props = {
  data: AppData
  onSave: (profile: Profile) => void
  onRestore: (data: AppData) => void
  onReset: () => void
  onClose: () => void
}

export function ProfileSheet({ data, onSave, onRestore, onReset, onClose }: Props) {
  const [profile, setProfile] = useState(data.profile)

  const restore = async (file: File) => {
    try {
      onRestore(reviveData(JSON.parse(await file.text())))
      onClose()
    } catch (err) {
      alert((err as Error).message)
    }
  }

  return (
    <Sheet title="Mi perfil" onClose={onClose}>
      <label className="field">
        <span>Nombre (como aparece en el horario de la empresa)</span>
        <input value={profile.name} placeholder="Ana Pérez" onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
      </label>
      <label className="field">
        <span>Nº de empleado (opcional)</span>
        <input value={profile.employeeId} inputMode="numeric" onChange={(e) => setProfile({ ...profile, employeeId: e.target.value })} />
      </label>
      <div className="actions">
        <button className="btn primary" onClick={() => { onSave(profile); onClose() }}>Guardar</button>
      </div>

      <h3 className="list-title">Copia de seguridad</h3>
      <p className="hint">Tus datos se guardan solo en este teléfono. Descarga una copia para pasarlos a otro dispositivo.</p>
      <div className="actions start">
        <button className="btn ghost" onClick={() => downloadFile(`turnos-copia-${todayISO()}.json`, JSON.stringify(data), 'application/json')}>Descargar copia</button>
        <label className="btn ghost">
          Restaurar copia
          <input type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
        </label>
      </div>
      <button className="btn ghost danger full" onClick={() => confirm('¿Borrar todos los turnos, el horario y las solicitudes?') && (onReset(), onClose())}>
        Borrar todos los datos
      </button>
    </Sheet>
  )
}
