'use client'

import { useState } from 'react'

export function CollapsibleSection({
  header,
  children,
  defaultOpen = false,
}: {
  header: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      <div className="cursor-pointer" onClick={() => setOpen(o => !o)}>
        {typeof header === 'function' ? header : header}
      </div>
      {open && children}
    </div>
  )
}

export function CollapsibleToggle({ open }: { open?: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="#a99fd8"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 transition-transform"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  )
}
