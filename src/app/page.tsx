'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Project } from '@/types'
import { ProjectDialog } from '@/components/project-dialog'

interface ProjectStats {
  recordCount: number
  pendingCount: number
  nearestSchedule: { date: string; content: string } | null
}

interface UpcomingSchedule {
  date: string
  content: string
  projectId: string
  projectName: string
}

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [stats, setStats] = useState<Record<string, ProjectStats>>({})
  const [upcoming, setUpcoming] = useState<UpcomingSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  async function fetchData() {
    const { data: projs } = await supabase
      .from('projects')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    const list = projs ?? []
    setProjects(list)

    const defaultExpanded: Record<string, boolean> = {}
    for (const p of list) {
      if (!p.parent_id) defaultExpanded[p.id] = true
    }
    setExpanded(defaultExpanded)

    if (list.length === 0) { setLoading(false); return }

    const allIds = list.map((p) => p.id)

    // 기록 수
    const { data: records } = await supabase
      .from('records')
      .select('project_id')
      .in('project_id', allIds)

    // 프로젝트 최신 분석 (일정 + 미결)
    const { data: analyses } = await supabase
      .from('project_analyses')
      .select('*')
      .in('project_id', allIds)
      .order('version', { ascending: false })

    // 프로젝트별 최신 분석만 추출
    const latestAnalysis = new Map<string, { pending: { content: string }[]; schedules: { date: string; content: string }[] }>()
    for (const a of analyses ?? []) {
      if (!latestAnalysis.has(a.project_id)) latestAnalysis.set(a.project_id, a)
    }

    // 기록 수 집계
    const recordCountMap: Record<string, number> = {}
    for (const r of records ?? []) {
      recordCountMap[r.project_id] = (recordCountMap[r.project_id] ?? 0) + 1
    }

    // stats 조합
    const statsMap: Record<string, ProjectStats> = {}
    for (const p of list) {
      const analysis = latestAnalysis.get(p.id)
      const schedules = analysis?.schedules ?? []
      statsMap[p.id] = {
        recordCount: recordCountMap[p.id] ?? 0,
        pendingCount: analysis?.pending?.length ?? 0,
        nearestSchedule: schedules[0] ?? null,
      }
    }
    setStats(statsMap)

    // 프로젝트별 핵심 마일스톤 수집
    const allSchedules: UpcomingSchedule[] = []
    for (const [pid, analysis] of latestAnalysis.entries()) {
      const project = list.find((p) => p.id === pid)
      if (!project) continue
      const milestones = (analysis as { milestones?: { date: string; content: string }[] }).milestones ?? []
      for (const s of milestones) {
        allSchedules.push({ date: s.date, content: s.content, projectId: pid, projectName: project.name })
      }
    }
    setUpcoming(allSchedules)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const parentProjects = projects.filter((p) => !p.parent_id)
  const childProjects = (parentId: string) => projects.filter((p) => p.parent_id === parentId)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <span className="font-bold text-slate-800 text-lg tracking-tight">Plog</span>
          </div>
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <span className="text-base leading-none">+</span>
            새 프로젝트
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-400">불러오는 중...</div>
        ) : parentProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-slate-600 font-semibold">아직 프로젝트가 없어요</p>
              <p className="text-slate-400 text-sm mt-1">첫 프로젝트를 만들어 기록을 시작해보세요.</p>
            </div>
            <button
              onClick={() => setDialogOpen(true)}
              className="mt-2 text-sm px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
            >
              프로젝트 만들기
            </button>
          </div>
        ) : (
          <>
            {/* 일정 WBS */}
            {upcoming.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">일정</h2>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  {Array.from(
                    upcoming.reduce((map, s) => {
                      if (!map.has(s.projectId)) map.set(s.projectId, { projectName: s.projectName, projectId: s.projectId, schedules: [] })
                      map.get(s.projectId)!.schedules.push(s)
                      return map
                    }, new Map<string, { projectName: string; projectId: string; schedules: UpcomingSchedule[] }>())
                  ).map(([, group], gi, arr) => (
                    <div key={group.projectId} className={gi < arr.length - 1 ? 'border-b border-slate-100' : ''}>
                      {/* 프로젝트 행 */}
                      <Link href={`/projects/${group.projectId}`}>
                        <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 hover:bg-blue-50 transition-colors group">
                          <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                          <span className="text-sm font-semibold text-slate-700 group-hover:text-blue-700 transition-colors">{group.projectName}</span>
                        </div>
                      </Link>
                      {/* 일정 항목 행 */}
                      {group.schedules.map((s, i) => (
                        <Link key={i} href={`/projects/${group.projectId}`}>
                          <div className="flex items-center justify-between px-5 py-3 pl-10 border-t border-slate-50 hover:bg-slate-50 transition-colors group">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-px h-4 bg-slate-200 shrink-0" />
                              <span className="text-sm text-slate-600 truncate">{s.content}</span>
                            </div>
                            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg shrink-0 ml-4">{s.date}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 프로젝트 목록 */}
            <section>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">프로젝트</h2>
              <div className="grid gap-3">
                {parentProjects.map((project) => {
                  const children = childProjects(project.id)
                  const hasChildren = children.length > 0
                  const isExpanded = expanded[project.id] ?? true
                  const s = stats[project.id]

                  return (
                    <div key={project.id}>
                      {hasChildren ? (
                        /* 하위 프로젝트가 있는 부모 */
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                          <button
                            className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                            onClick={() => toggleExpand(project.id)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-2 rounded-full bg-blue-400" />
                              <span className="font-semibold text-slate-800">{project.name}</span>
                              {project.description && (
                                <span className="text-sm text-slate-400 hidden sm:inline">{project.description}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              <span className="bg-slate-100 px-2 py-0.5 rounded-full">{children.length}개 하위</span>
                              <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="border-t border-slate-100 divide-y divide-slate-100">
                              {children.map((child) => {
                                const cs = stats[child.id]
                                return (
                                  <Link key={child.id} href={`/projects/${child.id}`}>
                                    <div className="px-5 py-3.5 pl-10 flex items-center justify-between hover:bg-blue-50 transition-colors group">
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-blue-400 transition-colors shrink-0" />
                                        <div className="min-w-0">
                                          <span className="text-slate-700 group-hover:text-blue-700 font-medium transition-colors">{child.name}</span>
                                          {child.description && (
                                            <span className="text-xs text-slate-400 ml-2 hidden sm:inline">{child.description}</span>
                                          )}
                                          {cs?.nearestSchedule && (
                                            <p className="text-xs text-slate-400 mt-0.5 truncate">
                                              📅 {cs.nearestSchedule.date} · {cs.nearestSchedule.content}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        {cs && cs.recordCount > 0 && (
                                          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{cs.recordCount}개</span>
                                        )}
                                        {cs && cs.pendingCount > 0 && (
                                          <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full">미결 {cs.pendingCount}</span>
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
                        /* 단독 프로젝트 카드 */
                        <Link href={`/projects/${project.id}`}>
                          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 hover:border-blue-300 hover:shadow-md transition-all group">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-2 h-2 rounded-full bg-slate-400 group-hover:bg-blue-500 transition-colors shrink-0" />
                                  <span className="font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">{project.name}</span>
                                </div>
                                {project.description && (
                                  <p className="text-sm text-slate-400 mt-1 ml-4.5 truncate">{project.description}</p>
                                )}
                                {s?.nearestSchedule && (
                                  <p className="text-xs text-slate-400 mt-1.5 ml-4.5 truncate">
                                    📅 {s.nearestSchedule.date} · {s.nearestSchedule.content}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {s && s.recordCount > 0 && (
                                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{s.recordCount}개</span>
                                )}
                                {s && s.pendingCount > 0 && (
                                  <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full">미결 {s.pendingCount}</span>
                                )}
                                <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </Link>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          </>
        )}
      </main>

      <ProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={fetchData}
      />
    </div>
  )
}
