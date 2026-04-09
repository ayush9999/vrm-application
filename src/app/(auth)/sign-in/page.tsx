import Link from 'next/link'
import { SignInForm } from './_components/SignInForm'

export default function SignInPage() {
  return (
    <>
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>
          Welcome back
        </h2>
        <p className="text-sm mt-1" style={{ color: '#a99fd8' }}>
          Sign in to your organisation.
        </p>
      </div>

      <SignInForm />

      <p className="mt-6 text-center text-sm" style={{ color: '#4a4270' }}>
        Don&apos;t have an account?{' '}
        <Link href="/sign-up" className="font-semibold hover:underline" style={{ color: '#6c5dd3' }}>
          Create one
        </Link>
      </p>
    </>
  )
}
