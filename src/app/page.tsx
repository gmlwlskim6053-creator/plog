'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Project } from '@/types'
import { ProjectDialog } from '@/components/project-dialog'

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [meetingCounts, setMeetingCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  async function fetchProjects() {
    const [{ data: projs }, { data: counts }] = await Promise.all([
      supabase.from('projects').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('meetings').select('project_id'),
    ])

    const list = projs ?? []
    setProjects(list)

    const countMap: Record<string, number> = {}
    for (const m of counts ?? []) {
      countMap[m.project_id] = (countMap[m.project_id] ?? 0) + 1
    }
    setMeetingCounts(countMap)

    // 디폴트 펼침
    const defaultExpanded: Record<string, boolean> = {}
    for (const p of list) {
      if (!p.parent_id) defaultExpanded[p.id] = true
    }
    setExpanded(defaultExpanded)
    setLoading(false)
  }

  useEffect(() => { fetchProjects() }, [])

  const parentProjects = projects.filter((p) => !p.parent_id)
  const childProjects = (parentId: string) => projects.filter((p) => p.parent_id === parentId)

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-bold text-slate-800 text-lg">회의록 관리</span>
          </div>
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <span className="text-base leading-none">+</span>
            프로젝트 추가
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-400">불러오는 중...</div>
        ) : parentProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-slate-500 font-medium">프로젝트가 없습니다</p>
            <p className="text-slate-400 text-sm">첫 프로젝트를 만들어보세요!</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {parentProjects.map((project) => {
              const children = childProjects(project.id)
              const hasChildren = children.length > 0
              const isExpanded = expanded[project.id] ?? true
              const count = meetingCounts[project.id] ?? 0

              return (
                <div key={project.id}>
                  {hasChildren ? (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <button
                        className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                        onClick={() => toggleExpand(project.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="font-semibold text-slate-800">{project.name}</span>
                          {project.description && (
                            <span className="text-sm text-slate-400 hidden sm:inline">{project.description}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-400">
                          <span className="bg-slate-100 px-2 py-0.5 rounded-full text-xs">{children.length}개 하위</span>
                          <svg
                            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-slate-100 divide-y divide-slate-100">
                          {children.map((child) => {
                            const childCount = meetingCounts[child.id] ?? 0
                            return (
                              <Link key={child.id} href={`/projects/${child.id}`}>
                                <div className="px-5 py-3.5 pl-10 flex items-center justify-between hover:bg-blue-50 transition-colors group">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-blue-400 transition-colors" />
                                    <span className="text-slate-700 group-hover:text-blue-700 font-medium transition-colors">{child.name}</span>
                                    {child.description && (
                                      <span className="text-xs text-slate-400 hidden sm:inline">{child.description}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {childCount > 0 ? (
                                      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                                        회의록 {childCount}개
                                      </span>
                                    ) : (
                                      <span className="text-xs text-slate-300">회의록 없음</span>
                                    )}
                                    <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </div>
                                </div>
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Link href={`/projects/${project.id}`}>
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 flex items-center justify-between hover:border-blue-300 hover:shadow-md transition-all group">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-slate-400 group-hover:bg-blue-500 transition-colors" />
                          <span className="font-semibold text-slate-800">{project.name}</span>
                          {project.description && (
                            <span className="text-sm text-slate-400 hidden sm:inline">{project.description}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {count > 0 ? (
                            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                              회의록 {count}개
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">회의록 없음</span>
                          )}
                          <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      <ProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={fetchProjects}
      />
    </div>
  )
}
