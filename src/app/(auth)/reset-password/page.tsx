import { ResetPasswordForm } from './_components/ResetPasswordForm'

export default function ResetPasswordPage() {
  return (
    <>
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>
          Set a new password
        </h2>
        <p className="text-sm mt-1" style={{ color: '#a99fd8' }}>
          Choose a new password for your account.
        </p>
      </div>

      <ResetPasswordForm />
    </>
  )
}
