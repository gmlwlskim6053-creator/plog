'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Project, Meeting } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProjectEditDialog } from '@/components/project-edit-dialog'

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)

  async function fetchData() {
    const [{ data: proj }, { data: meets }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('meetings').select('*').eq('project_id', id).order('held_at', { ascending: false }),
    ])
    setProject(proj)
    setMeetings(meets ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  async function handleDelete() {
    if (!confirm('프로젝트를 삭제하시겠습니까? 모든 회의록도 함께 삭제됩니다.')) return
    await supabase.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    router.push('/')
  }

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-10">불러오는 중...</div>
  if (!project) return <div className="max-w-4xl mx-auto px-4 py-10">프로젝트를 찾을 수 없습니다.</div>

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:underline">프로젝트</Link>
        <span>/</span>
        <span>{project.name}</span>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.description && <p className="text-gray-600 mt-1">{project.description}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>수정</Button>
          <Button variant="outline" className="text-red-500 hover:text-red-600" onClick={handleDelete}>삭제</Button>
          <Link href={`/projects/${id}/meetings/new`}>
            <Button>+ 회의록 추가</Button>
          </Link>
        </div>
      </div>

      {meetings.length === 0 ? (
        <p className="text-gray-500">회의록이 없습니다.</p>
      ) : (
        <div className="grid gap-3">
          {meetings.map((meeting) => (
            <Link key={meeting.id} href={`/projects/${id}/meetings/${meeting.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{meeting.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500">
                    {new Date(meeting.held_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                    {meeting.attendees.length > 0 && ` · ${meeting.attendees.map((d) => d.department).join(', ')}`}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
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
    </div>
  )
}
