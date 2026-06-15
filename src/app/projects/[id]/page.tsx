'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getDeptColor } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { Project, Record as AppRecord, ProjectAnalysis, MeetingMeta, EmailMeta, MemoMeta, DocumentMeta, RecordType } from '@/types'
import { PageLayout } from '@/components/layout'
import { ProjectEditDialog } from '@/components/project-edit-dialog'

const TYPE_LABELS: Record<RecordType, string> = { meeting: '회의록', email: '이메일', memo: '메모', document: '문서' }
const TYPE_COLORS: Record<RecordType, string> = {
  meeting: 'bg-blue-100 text-blue-700',
  email: 'bg-violet-100 text-violet-700',
  memo: 'bg-amber-100 text-amber-700',
  document: 'bg-teal-100 text-teal-700',
}

type Tab = 'records' | 'analysis'

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [parentProject, setParentProject] = useState<Project | null>(null)
  const [records, setRecords] = useState<AppRecord[]>([])
  const [projectAnalyses, setProjectAnalyses] = useState<ProjectAnalysis[]>([])
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('records')
  const [passwordModal, setPasswordModal] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  async function fetchData() {
    const [{ data: proj }, { data: recs }, { data: analyses }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('records').select('*').eq('project_id', id).order('record_date', { ascending: false }),
      supabase.from('project_analyses').select('*').eq('project_id', id).order('version', { ascending: false }),
    ])
    setProject(proj)
    setRecords(recs ?? [])
    setProjectAnalyses(analyses ?? [])
    if (analyses && analyses.length > 0) setSelectedVersion(analyses[0].version)

    if (proj?.parent_id) {
      const { data: parent } = await supabase.from('projects').select('*').eq('id', proj.parent_id).single()
      setParentProject(parent)
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  async function handleDelete() {
    if (!confirm('프로젝트를 삭제하시겠습니까? 모든 기록도 함께 삭제됩니다.')) return
    await supabase.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    router.push('/')
  }

  async function handleAnalyzeProject() {
    setPasswordError('')
    setAnalyzing(true)
    try {
      const res = await fetch('/api/analyze-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id, password }),
      })
      const data = await res.json()
      if (!res.ok) { setPasswordError(data.error); setAnalyzing(false); return }
      setPasswordModal(false)
      setPassword('')
      await fetchData()
    } catch {
      setPasswordError('오류가 발생했습니다.')
    }
    setAnalyzing(false)
  }

  const currentAnalysis = projectAnalyses.find((a) => a.version === selectedVersion) ?? null

  const breadcrumbs = project ? [
    ...(parentProject ? [{ label: parentProject.name }] : []),
    { label: project.name },
  ] : []

  if (loading) return <PageLayout><div className="flex items-center justify-center py-24 text-slate-400">불러오는 중...</div></PageLayout>
  if (!project) return <PageLayout><div className="text-center py-24 text-slate-400">프로젝트를 찾을 수 없습니다.</div></PageLayout>

  return (
    <PageLayout breadcrumbs={breadcrumbs}>
      {/* 프로젝트 헤더 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5 mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{project.name}</h1>
          {project.description && <p className="text-slate-500 text-sm mt-1">{project.description}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditOpen(true)} className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">수정</button>
          <button onClick={handleDelete} className="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors">삭제</button>
          <Link href={`/projects/${id}/records/new`}>
            <button className="text-sm px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors">+ 기록 추가</button>
          </Link>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-1 w-fit">
        {(['records', 'analysis'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-sm px-4 py-1.5 rounded-md font-medium transition-colors ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t === 'records' ? `기록 (${records.length})` : '프로젝트 현황 분석'}
          </button>
        ))}
      </div>

      {/* 기록 목록 탭 */}
      {tab === 'records' && (
        records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
              <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-slate-500 font-medium">기록이 없습니다</p>
            <Link href={`/projects/${id}/records/new`}>
              <button className="text-sm px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors mt-1">첫 기록 추가하기</button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-2">
            {records.map((record, idx) => {
              const date = new Date(record.record_date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
              const meta = record.meta

              return (
                <Link key={record.id} href={`/projects/${id}/records/${record.id}`}>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 hover:border-blue-300 hover:shadow-md transition-all group">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <span className="text-slate-300 text-sm font-mono w-5 text-right shrink-0">{String(idx + 1).padStart(2, '0')}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${TYPE_COLORS[record.type]}`}>{TYPE_LABELS[record.type]}</span>
                            <p className="font-semibold text-slate-800 group-hover:text-blue-700 transition-colors truncate">{record.title}</p>
                          </div>
                          {record.type === 'meeting' && (meta as MeetingMeta).attendees?.length > 0 && (
                            <div className="flex gap-1.5 mt-1 flex-wrap">
                              {(meta as MeetingMeta).attendees.map((d, i) => {
                                const color = getDeptColor(d.department)
                                return (
                                  <span key={i} className="flex items-center gap-1">
                                    <span className={`text-[11px] px-1.5 py-0.5 rounded ${color.bg} ${color.text}`}>{d.department}</span>
                                    {d.members.length > 0 && <span className="text-[11px] text-slate-400">{d.members.join(', ')}</span>}
                                  </span>
                                )
                              })}
                            </div>
                          )}
                          {record.type === 'email' && (
                            <p className="text-xs text-slate-400 mt-0.5">{(meta as EmailMeta).from} → {(meta as EmailMeta).to}</p>
                          )}
                          {record.type === 'memo' && (meta as MemoMeta).source && (
                            <p className="text-xs text-slate-400 mt-0.5">출처: {(meta as MemoMeta).source}</p>
                          )}
                          {record.type === 'document' && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              {(meta as DocumentMeta).docType}{(meta as DocumentMeta).version ? ` · ${(meta as DocumentMeta).version}` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-medium text-slate-500">{date}</span>
                        <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )
      )}

      {/* 프로젝트 현황 분석 탭 */}
      {tab === 'analysis' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-700">프로젝트 현황 분석</p>
              {projectAnalyses.length > 0 && (
                <select
                  className="text-xs border border-slate-200 rounded px-2 py-0.5 text-slate-600"
                  value={selectedVersion ?? ''}
                  onChange={(e) => setSelectedVersion(Number(e.target.value))}
                >
                  {projectAnalyses.map((a) => (
                    <option key={a.version} value={a.version}>
                      v{a.version} · {new Date(a.analyzed_at).toLocaleDateString('ko-KR')}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <button
              onClick={() => setPasswordModal(true)}
              disabled={records.length === 0}
              className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium transition-colors"
            >
              ✨ {projectAnalyses.length > 0 ? '재분석' : '전체 분석 시작'}
            </button>
          </div>

          {currentAnalysis ? (
            <div className="space-y-6">
              {/* 요약 */}
              <div className="bg-slate-50 rounded-xl px-5 py-4">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">전체 요약</p>
                <p className="text-sm text-slate-700 leading-7">{currentAnalysis.summary}</p>
              </div>

              {/* 확정 */}
              {currentAnalysis.confirmed.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-widest mb-3">✅ 확정된 사항</p>
                  <div className="space-y-2">
                    {currentAnalysis.confirmed.map((item, i) => (
                      <div key={i} className="bg-emerald-50 rounded-xl px-5 py-3.5">
                        <p className="text-sm text-slate-700 leading-6">{item.content}</p>
                        {item.source && <p className="text-xs text-emerald-600 mt-1.5">{item.source}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 변경 */}
              {currentAnalysis.changed.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-widest mb-3">🔄 변경된 사항</p>
                  <div className="space-y-2">
                    {currentAnalysis.changed.map((item, i) => (
                      <div key={i} className="bg-amber-50 rounded-xl px-5 py-3.5">
                        <p className="text-sm font-medium text-slate-700 leading-6 mb-2">{item.content}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-slate-400 line-through">{item.from}</span>
                          <span className="text-slate-400">→</span>
                          <span className="text-amber-700 font-semibold">{item.to}</span>
                        </div>
                        {item.source && <p className="text-xs text-amber-600 mt-1.5">{item.source}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 미결 */}
              {currentAnalysis.pending.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-red-500 uppercase tracking-widest mb-3">⚠️ 미결 사항</p>
                  <div className="space-y-2">
                    {currentAnalysis.pending.map((item, i) => (
                      <div key={i} className="bg-red-50 rounded-xl px-5 py-3.5">
                        <p className="text-sm text-slate-700 leading-6">{item.content}</p>
                        {item.source && <p className="text-xs text-red-400 mt-1.5">{item.source}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 일정 */}
              {currentAnalysis.schedules.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-widest mb-3">📅 일정</p>
                  <div className="space-y-2">
                    {currentAnalysis.schedules.map((item, i) => (
                      <div key={i} className="bg-blue-50 rounded-xl px-5 py-3.5 flex items-start gap-3">
                        <span className="bg-emerald-100 text-emerald-700 text-xs font-medium px-2.5 py-1 rounded-lg shrink-0 mt-0.5">{item.date}</span>
                        <div className="min-w-0">
                          <p className="text-sm text-slate-700 leading-6">{item.content}</p>
                          {item.source && <p className="text-xs text-blue-400 mt-1">{item.source}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-400 text-sm mb-1">아직 분석된 내용이 없습니다.</p>
              <p className="text-slate-300 text-xs">기록을 추가한 후 전체 분석을 실행하세요.</p>
            </div>
          )}
        </div>
      )}

      {project && (
        <ProjectEditDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={fetchData}
          project={project}
        />
      )}

      {/* 비밀번호 모달 */}
      {passwordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-base font-bold text-slate-800 mb-1">프로젝트 전체 분석</h2>
            <p className="text-xs text-slate-400 mb-4">모든 기록을 종합 분석합니다. 권한을 확인합니다.</p>
            <input
              type="password"
              placeholder="비밀번호 입력"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyzeProject()}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-violet-300"
              autoFocus
            />
            {passwordError && <p className="text-xs text-red-500 mb-2">{passwordError}</p>}
            <div className="flex gap-2 justify-end mt-4">
              <button
                onClick={() => { setPasswordModal(false); setPassword(''); setPasswordError('') }}
                className="text-sm px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleAnalyzeProject}
                disabled={analyzing || !password}
                className="text-sm px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium transition-colors"
              >
                {analyzing ? '분석 중...' : '분석 시작'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}
