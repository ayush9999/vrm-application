import Link from 'next/link'
import { ForgotPasswordForm } from './_components/ForgotPasswordForm'

export default function ForgotPasswordPage() {
  return (
    <>
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>
          Forgot your password?
        </h2>
        <p className="text-sm mt-1" style={{ color: '#a99fd8' }}>
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      <ForgotPasswordForm />

      <p className="mt-6 text-center text-sm" style={{ color: '#4a4270' }}>
        Remembered it?{' '}
        <Link href="/sign-in" className="font-semibold hover:underline" style={{ color: '#6c5dd3' }}>
          Sign in
        </Link>
      </p>
    </>
  )
}
