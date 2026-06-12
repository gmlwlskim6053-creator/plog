'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { DepartmentAttendee } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AttendeesInput } from '@/components/attendees-input'
import mammoth from 'mammoth'

export default function EditMeetingPage() {
  const { id, meetingId } = useParams<{ id: string; meetingId: string }>()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [heldAt, setHeldAt] = useState('')
  const [attendees, setAttendees] = useState<DepartmentAttendee[]>([])
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [fileLoading, setFileLoading] = useState(false)

  useEffect(() => {
    async function fetchMeeting() {
      const { data } = await supabase.from('meetings').select('*').eq('id', meetingId).single()
      if (data) {
        setTitle(data.title)
        setHeldAt(data.held_at.slice(0, 10))
        setAttendees(data.attendees ?? [])
        setContent(data.content)
      }
    }
    fetchMeeting()
  }, [meetingId])

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

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:underline">프로젝트</Link>
        <span>/</span>
        <Link href={`/projects/${id}`} className="hover:underline">프로젝트</Link>
        <span>/</span>
        <Link href={`/projects/${id}/meetings/${meetingId}`} className="hover:underline">{title}</Link>
        <span>/</span>
        <span>수정</span>
      </div>

      <h1 className="text-2xl font-bold mb-8">회의록 수정</h1>

      <div className="space-y-5">
        <div>
          <label className="text-sm font-medium mb-1 block">회의 제목 *</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">회의 일시 *</label>
          <Input type="date" value={heldAt} onChange={(e) => setHeldAt(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">참석자 (부서별)</label>
          <AttendeesInput value={attendees} onChange={setAttendees} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium">회의 내용 *</label>
            <label className="text-sm text-blue-600 cursor-pointer hover:underline">
              {fileLoading ? '파일 읽는 중...' : '파일에서 불러오기 (docx, txt)'}
              <input ref={fileRef} type="file" accept=".docx,.txt" className="hidden" onChange={handleFileUpload} disabled={fileLoading} />
            </label>
          </div>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={16} className="font-mono text-sm" />
        </div>
      </div>

      <div className="flex gap-2 justify-end mt-6">
        <Link href={`/projects/${id}/meetings/${meetingId}`}>
          <Button variant="outline">취소</Button>
        </Link>
        <Button onClick={handleSave} disabled={saving || !title.trim() || !heldAt || !content.trim()}>
          {saving ? '저장 중...' : '저장'}
        </Button>
      </div>
    </div>
  )
}
