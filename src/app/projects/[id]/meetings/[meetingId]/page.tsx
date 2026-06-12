'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Meeting, Project } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

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

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-10">불러오는 중...</div>
  if (!meeting) return <div className="max-w-4xl mx-auto px-4 py-10">회의록을 찾을 수 없습니다.</div>

  const heldAt = new Date(meeting.held_at).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:underline">프로젝트</Link>
        <span>/</span>
        <Link href={`/projects/${id}`} className="hover:underline">{project?.name}</Link>
        <span>/</span>
        <span>{meeting.title}</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <h1 className="text-2xl font-bold">{meeting.title}</h1>
        <div className="flex gap-2">
          <Link href={`/projects/${id}/meetings/${meetingId}/edit`}>
            <Button variant="outline">수정</Button>
          </Link>
          <Button variant="outline" className="text-red-500 hover:text-red-600" onClick={handleDelete}>삭제</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-6">
        <span>📅 {heldAt}</span>
      </div>

      {meeting.attendees.length > 0 && (
        <div className="mb-6 space-y-2">
          <h2 className="text-sm font-medium text-gray-500">참석자</h2>
          <div className="flex flex-wrap gap-3">
            {meeting.attendees.map((dept, i) => (
              <div key={i} className="bg-gray-50 border rounded-lg px-3 py-2">
                <p className="text-xs font-medium text-gray-500 mb-1">{dept.department}</p>
                <div className="flex flex-wrap gap-1">
                  {dept.members.map((m) => (
                    <Badge key={m} variant="secondary">{m}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-sm font-medium text-gray-500 mb-4">회의 내용</h2>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-800">
          {meeting.content}
        </pre>
      </div>
    </div>
  )
}
