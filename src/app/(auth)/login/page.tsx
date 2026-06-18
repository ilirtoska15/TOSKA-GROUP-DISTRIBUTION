'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  email: z.string().email('Email i pavlefshëm'),
  password: z.string().min(1, 'Fjalëkalimi kërkohet'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (result?.error) {
        toast.error('Email ose fjalëkalim i gabuar')
      } else {
        toast.success('Hyrja u krye me sukses')
        window.location.href = '/'
      }
    } catch {
      toast.error('Gabim i papritur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur mb-4">
          <span className="text-white text-2xl font-black">TD</span>
        </div>
        <h1 className="text-3xl font-bold text-white">TOSKA</h1>
        <p className="text-blue-100 text-sm mt-1">Distribution Management System</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-2xl p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Hyrje në sistem</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@toska.al"
              className="mt-1"
              autoComplete="email"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-destructive mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="password">Fjalëkalimi</Label>
            <div className="relative mt-1">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="pr-10"
                autoComplete="current-password"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive mt-1">{errors.password.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full mt-2" disabled={loading} size="lg">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Duke u kyçur...
              </>
            ) : (
              'Hyr'
            )}
          </Button>
        </form>

        <p className="text-center text-xs text-gray-500 mt-6">
          Vetëm për stafin e TOSKA DISTRIBUTION
        </p>
      </div>
    </div>
  )
}
