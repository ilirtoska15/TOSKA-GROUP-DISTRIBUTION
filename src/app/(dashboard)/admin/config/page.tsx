'use client'

import { useState, useEffect } from 'react'
import { Settings, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

const CONFIG_KEYS = [
  { key: 'catalog_show_price', label: 'Shfaq çmimin në katalogun publik', type: 'boolean' },
  { key: 'low_stock_threshold', label: 'Kufiri i Stokut të Ulët (copë)', type: 'number' },
  { key: 'expiry_warning_days', label: 'Ditët Paralajmëruese para Skadimit', type: 'number' },
  { key: 'debt_approval_threshold', label: 'Kufiri i Borxhit për Aprovim (€)', type: 'number' },
  { key: 'company_name', label: 'Emri i Kompanisë', type: 'text' },
  { key: 'company_address', label: 'Adresa e Kompanisë', type: 'text' },
  { key: 'company_phone', label: 'Telefoni i Kompanisë', type: 'text' },
]

export default function ConfigPage() {
  const [config, setConfig] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((data) => {
        setConfig(data)
        setLoading(false)
      })
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (res.ok) toast.success('Konfigurimi u ruajt')
      else toast.error('Gabim në ruajtjen e konfigurimit')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Konfigurim i Sistemit</h1>
            <p className="text-sm text-gray-500">Ndrysho parametrat pa programues</p>
          </div>
        </div>
        <Button onClick={save} loading={saving} className="gap-2">
          <Save className="h-4 w-4" />
          Ruaj
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({length: 5}).map((_,i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
      ) : (
        <Card>
          <CardContent className="p-6 space-y-5">
            {CONFIG_KEYS.map((c) => (
              <div key={c.key}>
                <Label htmlFor={c.key}>{c.label}</Label>
                {c.type === 'boolean' ? (
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={() => setConfig((prev) => ({ ...prev, [c.key]: prev[c.key] === 'true' ? 'false' : 'true' }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config[c.key] === 'true' ? 'bg-primary' : 'bg-gray-200'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config[c.key] === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <span className="text-sm text-gray-600">{config[c.key] === 'true' ? 'Po' : 'Jo'}</span>
                  </div>
                ) : (
                  <Input
                    id={c.key}
                    type={c.type === 'number' ? 'number' : 'text'}
                    className="mt-1"
                    value={config[c.key] ?? ''}
                    onChange={(e) => setConfig((prev) => ({ ...prev, [c.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
