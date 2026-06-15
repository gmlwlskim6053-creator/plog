'use client'

import Link from 'next/link'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface Props {
  breadcrumbs?: BreadcrumbItem[]
  children: React.ReactNode
}

export function PageLayout({ breadcrumbs, children }: Props) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-bold text-slate-800 text-lg">Plog</span>
          </Link>

          {breadcrumbs && breadcrumbs.length > 0 && (
            <>
              <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <nav className="flex items-center gap-2 text-sm min-w-0">
                {breadcrumbs.map((item, i) => (
                  <span key={i} className="flex items-center gap-2 min-w-0">
                    {i > 0 && <span className="text-slate-300">/</span>}
                    {item.href ? (
                      <Link href={item.href} className="text-slate-500 hover:text-blue-600 transition-colors truncate">
                        {item.label}
                      </Link>
                    ) : (
                      <span className="text-slate-800 font-medium truncate">{item.label}</span>
                    )}
                  </span>
                ))}
              </nav>
            </>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
