import { redirect } from 'next/navigation'

export default function NewVendorPage() {
  redirect('/vendors/new/wizard')
}
