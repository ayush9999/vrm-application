import { SetupOrgForm } from './_components/SetupOrgForm'

export default function SetupOrganizationPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-xl mb-4 shadow-sm">
            <span className="text-white text-xl font-bold">V</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Set up your organisation
          </h1>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            This creates your workspace and seeds the default document types and vendor categories.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <SetupOrgForm />
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Dev mode: credentials stored in cookies.
          <br />
          Auth will replace this in production.
        </p>
      </div>
    </div>
  )
}
