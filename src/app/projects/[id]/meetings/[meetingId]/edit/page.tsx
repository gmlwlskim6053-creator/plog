'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { DepartmentAttendee, Project } from '@/types'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AttendeesInput } from '@/components/attendees-input'
import { PageLayout } from '@/components/layout'
import mammoth from 'mammoth'

export default function EditMeetingPage() {
  const { id, meetingId } = useParams<{ id: string; meetingId: string }>()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [project, setProject] = useState<Project | null>(null)

  const [title, setTitle] = useState('')
  const [heldAt, setHeldAt] = useState('')
  const [attendees, setAttendees] = useState<DepartmentAttendee[]>([])
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [fileLoading, setFileLoading] = useState(false)

  useEffect(() => {
    async function fetchData() {
      const [{ data: proj }, { data: meet }] = await Promise.all([
        supabase.from('projects').select('*').eq('id', id).single(),
        supabase.from('meetings').select('*').eq('id', meetingId).single(),
      ])
      setProject(proj)
      if (meet) {
        setTitle(meet.title)
        setHeldAt(meet.held_at.slice(0, 10))
        setAttendees(meet.attendees ?? [])
        setContent(meet.content)
      }
    }
    fetchData()
  }, [id, meetingId])

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileLoading(true)
    try {
      if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer })
        setContent(result.value)
      } else {
        const text = await file.text()
        setContent(text)
      }
    } catch {
      alert('파일을 읽을 수 없습니다.')
    } finally {
      setFileLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleSave() {
    if (!title.trim() || !heldAt || !content.trim()) return
    setSaving(true)

    const cleanAttendees = attendees
      .filter((d) => d.department.trim())
      .map((d) => ({ department: d.department.trim(), members: d.members.filter((m) => m.trim()) }))

    await supabase.from('meetings').update({
      title: title.trim(),
      held_at: heldAt,
      attendees: cleanAttendees,
      content: content.trim(),
    }).eq('id', meetingId)

    setSaving(false)
    router.push(`/projects/${id}/meetings/${meetingId}`)
  }

  const breadcrumbs = [
    { label: project?.name ?? '프로젝트', href: `/projects/${id}` },
    { label: title || '회의록', href: `/projects/${id}/meetings/${meetingId}` },
    { label: '수정' },
  ]

  const isValid = title.trim() && heldAt && content.trim()

  return (
    <PageLayout breadcrumbs={breadcrumbs}>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-6 space-y-5">
        <h1 className="text-lg font-bold text-slate-800 pb-1 border-b border-slate-100">회의록 수정</h1>

        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">회의 제목 *</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">회의 일자 *</label>
          <Input type="date" value={heldAt} onChange={(e) => setHeldAt(e.target.value)} className="w-48" />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">참석자 (부서별)</label>
          <AttendeesInput value={attendees} onChange={setAttendees} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">회의 내용 *</label>
            <label className={`text-xs px-2.5 py-1 rounded-md border cursor-pointer transition-colors ${fileLoading ? 'text-slate-400 border-slate-200' : 'text-blue-600 border-blue-200 hover:bg-blue-50'}`}>
              {fileLoading ? '읽는 중...' : '📎 파일에서 불러오기'}
              <input ref={fileRef} type="file" accept=".docx,.txt" className="hidden" onChange={handleFileUpload} disabled={fileLoading} />
            </label>
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            className="font-mono text-sm"
          />
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
          <Link href={`/projects/${id}/meetings/${meetingId}`}>
            <button className="text-sm px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
              취소
            </button>
          </Link>
          <button
            onClick={handleSave}
            disabled={saving || !isValid}
            className="text-sm px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium transition-colors"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </PageLayout>
  )
}
