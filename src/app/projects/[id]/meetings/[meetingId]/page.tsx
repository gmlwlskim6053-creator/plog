'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Meeting, MeetingAnalysis, Project } from '@/types'
import { getDeptColor } from '@/lib/utils'
import { PageLayout } from '@/components/layout'

export default function MeetingDetailPage() {
  const { id, meetingId } = useParams<{ id: string; meetingId: string }>()
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [analyses, setAnalyses] = useState<MeetingAnalysis[]>([])
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [passwordModal, setPasswordModal] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  async function fetchData() {
    const [{ data: proj }, { data: meet }, { data: ana }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('meetings').select('*').eq('id', meetingId).single(),
      supabase.from('meeting_analyses').select('*').eq('meeting_id', meetingId).order('version', { ascending: false }),
    ])
    setProject(proj)
    setMeeting(meet)
    setAnalyses(ana ?? [])
    if (ana && ana.length > 0) setSelectedVersion(ana[0].version)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id, meetingId])

  async function handleDelete() {
    if (!confirm('회의록을 삭제하시겠습니까?')) return
    await supabase.from('meetings').delete().eq('id', meetingId)
    router.push(`/projects/${id}`)
  }

  async function handleAnalyze() {
    setPasswordError('')
    setAnalyzing(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPasswordError(data.error)
        setAnalyzing(false)
        return
      }
      setPasswordModal(false)
      setPassword('')
      await fetchData()
    } catch {
      setPasswordError('오류가 발생했습니다.')
    }
    setAnalyzing(false)
  }

  const currentAnalysis = analyses.find((a) => a.version === selectedVersion) ?? null

  const breadcrumbs = [
    { label: project?.name ?? '프로젝트', href: `/projects/${id}` },
    { label: meeting?.title ?? '회의록' },
  ]

  if (loading) return (
    <PageLayout>
      <div className="flex items-center justify-center py-24 text-slate-400">불러오는 중...</div>
    </PageLayout>
  )
  if (!meeting) return (
    <PageLayout>
      <div className="text-center py-24 text-slate-400">회의록을 찾을 수 없습니다.</div>
    </PageLayout>
  )

  const heldAt = new Date(meeting.held_at).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <PageLayout breadcrumbs={breadcrumbs}>
      {/* 회의록 헤더 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800">{meeting.title}</h1>
            <p className="text-sm text-slate-400 mt-1">📅 {heldAt}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href={`/projects/${id}/meetings/${meetingId}/edit`}>
              <button className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                수정
              </button>
            </Link>
            <button
              onClick={handleDelete}
              className="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
            >
              삭제
            </button>
          </div>
        </div>

        {/* 참석자 */}
        {meeting.attendees.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-400 mb-2">참석자</p>
            <div className="flex flex-wrap gap-3">
              {meeting.attendees.map((dept, i) => {
                const color = getDeptColor(dept.department)
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`text-[11px] font-normal px-1.5 py-0.5 rounded ${color.bg} ${color.text}`}>
                      {dept.department}
                    </span>
                    <span className="text-xs text-slate-600">{dept.members.join(', ')}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* AI 분석 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-slate-400">AI 분석</p>
            {analyses.length > 0 && (
              <select
                className="text-xs border border-slate-200 rounded px-2 py-0.5 text-slate-600"
                value={selectedVersion ?? ''}
                onChange={(e) => setSelectedVersion(Number(e.target.value))}
              >
                {analyses.map((a) => (
                  <option key={a.version} value={a.version}>
                    v{a.version} · {new Date(a.analyzed_at).toLocaleDateString('ko-KR')}
                  </option>
                ))}
              </select>
            )}
          </div>
          <button
            onClick={() => setPasswordModal(true)}
            className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium transition-colors flex items-center gap-1.5"
          >
            ✨ {analyses.length > 0 ? '재분석' : 'AI 분석하기'}
          </button>
        </div>

        {currentAnalysis ? (
          <div className="space-y-4">
            {/* 요약 */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1.5">회의 요약</p>
              <p className="text-sm text-slate-700 leading-6 bg-slate-50 rounded-lg px-4 py-3">{currentAnalysis.summary}</p>
            </div>

            {/* 결정사항 */}
            {currentAnalysis.decisions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1.5">결정사항</p>
                <ul className="space-y-1">
                  {currentAnalysis.decisions.map((d, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="text-blue-400 mt-0.5 shrink-0">•</span>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Item */}
            {currentAnalysis.action_items.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1.5">Action Item</p>
                <div className="space-y-1.5">
                  {currentAnalysis.action_items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="bg-blue-100 text-blue-700 text-[11px] px-1.5 py-0.5 rounded shrink-0">{item.assignee}</span>
                      <span className="text-slate-700">{item.task}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 일정 */}
            {currentAnalysis.schedules.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1.5">일정</p>
                <div className="space-y-1.5">
                  {currentAnalysis.schedules.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="bg-emerald-100 text-emerald-700 text-[11px] px-1.5 py-0.5 rounded shrink-0">{s.date}</span>
                      <span className="text-slate-700">{s.content}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-6">아직 분석된 내용이 없습니다.</p>
        )}
      </div>

      {/* 회의 내용 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5">
        <p className="text-xs font-medium text-slate-400 mb-4">회의 내용</p>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-slate-700">
          {meeting.content}
        </pre>
      </div>

      {/* 비밀번호 모달 */}
      {passwordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-base font-bold text-slate-800 mb-1">AI 분석 실행</h2>
            <p className="text-xs text-slate-400 mb-4">분석 실행 권한을 확인합니다.</p>
            <input
              type="password"
              placeholder="비밀번호 입력"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
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
                onClick={handleAnalyze}
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
