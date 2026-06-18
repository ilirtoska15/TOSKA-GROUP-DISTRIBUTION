'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ImageUploadProps {
  value?: string
  onChange: (url: string) => void
  className?: string
  required?: boolean
}

export function ImageUpload({ value, onChange, className, required }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (!file) return

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      toast.error('Lejohen vetëm JPG, PNG dhe WebP')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Foto shumë e madhe. Maksimumi 5MB.')
      return
    }

    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)

      const res = await fetch('/api/upload', { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? 'Gabim në upload')
        return
      }
      const data = await res.json()
      onChange(data.url)
      toast.success('Foto u ngarkua')
    } catch {
      toast.error('Gabim në upload')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div className={cn('space-y-2', className)}>
      {value ? (
        <div className="relative w-full h-48 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 group">
          <Image
            src={value}
            alt="Foto produktit"
            fill
            className="object-contain p-2"
          />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          className={cn(
            'w-full h-48 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors',
            dragOver ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary hover:bg-gray-50',
            uploading && 'opacity-60 pointer-events-none'
          )}
        >
          {uploading ? (
            <>
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Duke ngarkuar...</p>
            </>
          ) : (
            <>
              <ImageIcon className="h-10 w-10 text-gray-300" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">Kliko ose tërhiq foton këtu</p>
                <p className="text-xs text-gray-400 mt-0.5">JPG, PNG, WebP · max 5MB{required && ' · E detyrueshme'}</p>
              </div>
              <button
                type="button"
                className="mt-1 px-4 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90"
              >
                <Upload className="h-3.5 w-3.5 inline mr-1" />
                Ngarko Foto
              </button>
            </>
          )}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
    </div>
  )
}
