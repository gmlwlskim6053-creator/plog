'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getDeptColor } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { Project, Meeting } from '@/types'
import { PageLayout } from '@/components/layout'
import { ProjectEditDialog } from '@/components/project-edit-dialog'

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [parentProject, setParentProject] = useState<Project | null>(null)
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

    if (proj?.parent_id) {
      const { data: parent } = await supabase.from('projects').select('*').eq('id', proj.parent_id).single()
      setParentProject(parent)
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  async function handleDelete() {
    if (!confirm('프로젝트를 삭제하시겠습니까? 모든 회의록도 함께 삭제됩니다.')) return
    await supabase.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    router.push('/')
  }

  const breadcrumbs = project ? [
    ...(parentProject ? [{ label: parentProject.name }] : []),
    { label: project.name },
  ] : []

  if (loading) return (
    <PageLayout>
      <div className="flex items-center justify-center py-24 text-slate-400">불러오는 중...</div>
    </PageLayout>
  )
  if (!project) return (
    <PageLayout>
      <div className="text-center py-24 text-slate-400">프로젝트를 찾을 수 없습니다.</div>
    </PageLayout>
  )

  return (
    <PageLayout breadcrumbs={breadcrumbs}>
      {/* 프로젝트 헤더 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{project.name}</h1>
          {project.description && <p className="text-slate-500 text-sm mt-1">{project.description}</p>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditOpen(true)}
            className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            수정
          </button>
          <button
            onClick={handleDelete}
            className="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
          >
            삭제
          </button>
          <Link href={`/projects/${id}/meetings/new`}>
            <button className="text-sm px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors">
              + 회의록 추가
            </button>
          </Link>
        </div>
      </div>

      {/* 회의록 목록 */}
      {meetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
            <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-slate-500 font-medium">회의록이 없습니다</p>
          <Link href={`/projects/${id}/meetings/new`}>
            <button className="text-sm px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors mt-1">
              첫 회의록 추가하기
            </button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-2">
          {meetings.map((meeting, idx) => {
            const date = new Date(meeting.held_at).toLocaleDateString('ko-KR', {
              year: 'numeric', month: 'long', day: 'numeric',
            })
            return (
              <Link key={meeting.id} href={`/projects/${id}/meetings/${meeting.id}`}>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 hover:border-blue-300 hover:shadow-md transition-all group">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="text-slate-300 text-sm font-mono w-5 text-right shrink-0">{String(idx + 1).padStart(2, '0')}</span>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 group-hover:text-blue-700 transition-colors truncate">{meeting.title}</p>
                        {meeting.attendees.length > 0 && (
                          <div className="flex gap-1.5 mt-1.5 flex-wrap">
                            {meeting.attendees.map((d, i) => {
                              const color = getDeptColor(d.department)
                              return (
                                <span key={i} className="flex items-center gap-1">
                                  <span className={`text-[11px] font-normal px-1.5 py-0.5 rounded ${color.bg} ${color.text}`}>
                                    {d.department}
                                  </span>
                                  {d.members.length > 0 && (
                                    <span className="text-[11px] text-slate-400">{d.members.join(', ')}</span>
                                  )}
                                </span>
                              )
                            })}
                          </div>
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
      )}

      {project && (
        <ProjectEditDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={fetchData}
          project={project}
        />
      )}
    </PageLayout>
  )
}
