'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Meeting, Project } from '@/types'
import { getDeptColor } from '@/lib/utils'
import { PageLayout } from '@/components/layout'

export default function MeetingDetailPage() {
  const { id, meetingId } = useParams<{ id: string; meetingId: string }>()
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const [{ data: proj }, { data: meet }] = await Promise.all([
        supabase.from('projects').select('*').eq('id', id).single(),
        supabase.from('meetings').select('*').eq('id', meetingId).single(),
      ])
      setProject(proj)
      setMeeting(meet)
      setLoading(false)
    }
    fetchData()
  }, [id, meetingId])

  async function handleDelete() {
    if (!confirm('회의록을 삭제하시겠습니까?')) return
    await supabase.from('meetings').delete().eq('id', meetingId)
    router.push(`/projects/${id}`)
  }

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
                    <span className="text-xs text-slate-600">
                      {dept.members.join(', ')}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 회의 내용 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5">
        <p className="text-xs font-medium text-slate-400 mb-4">회의 내용</p>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-slate-700">
          {meeting.content}
        </pre>
      </div>
    </PageLayout>
  )
}
