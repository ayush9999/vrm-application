import Link from 'next/link'
import { SignUpForm } from './_components/SignUpForm'

export default function SignUpPage() {
  return (
    <>
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>
          Create your account
        </h2>
        <p className="text-sm mt-1" style={{ color: '#a99fd8' }}>
          Sign up to create your organisation and start managing vendors.
        </p>
      </div>

      <SignUpForm />

      <p className="mt-6 text-center text-sm" style={{ color: '#4a4270' }}>
        Already have an account?{' '}
        <Link href="/sign-in" className="font-semibold hover:underline" style={{ color: '#6c5dd3' }}>
          Sign in
        </Link>
      </p>
    </>
  )
}
