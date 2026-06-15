'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { DepartmentAttendee, Project, RecordType, MeetingMeta, EmailMeta, MemoMeta, DocumentMeta, Attachment } from '@/types'
import { AttachmentsInput } from '@/components/attachments-input'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AttendeesInput } from '@/components/attendees-input'
import { PageLayout } from '@/components/layout'
import mammoth from 'mammoth'

const TYPE_LABELS: Record<RecordType, string> = { meeting: '회의록', email: '이메일', memo: '메모', document: '문서' }

export default function EditRecordPage() {
  const { id, recordId } = useParams<{ id: string; recordId: string }>()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [type, setType] = useState<RecordType>('meeting')
  const [title, setTitle] = useState('')
  const [recordDate, setRecordDate] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [fileLoading, setFileLoading] = useState(false)
  const [attendees, setAttendees] = useState<DepartmentAttendee[]>([])
  const [emailFrom, setEmailFrom] = useState('')
  const [emailTo, setEmailTo] = useState('')
  const [thread, setThread] = useState<{ content: string; date: string }[]>([])
  const [memoSource, setMemoSource] = useState('')
  const [docType, setDocType] = useState('')
  const [docVersion, setDocVersion] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])

  useEffect(() => {
    async function fetchData() {
      const [{ data: proj }, { data: rec }] = await Promise.all([
        supabase.from('projects').select('*').eq('id', id).single(),
        supabase.from('records').select('*').eq('id', recordId).single(),
      ])
      setProject(proj)
      if (rec) {
        setType(rec.type)
        setTitle(rec.title)
        setRecordDate(rec.record_date.slice(0, 10))
        setContent(rec.content)
        if (rec.type === 'meeting') setAttendees((rec.meta as MeetingMeta).attendees ?? [])
        if (rec.type === 'email') {
          const m = rec.meta as EmailMeta
          setEmailFrom(m.from ?? '')
          setEmailTo(m.to ?? '')
          setThread(m.thread ?? [])
        }
        if (rec.type === 'memo') setMemoSource((rec.meta as MemoMeta).source ?? '')
        if (rec.type === 'document') {
          const m = rec.meta as DocumentMeta
          setDocType(m.docType ?? '')
          setDocVersion(m.version ?? '')
        }
        setAttachments(rec.attachments ?? [])
      }
    }
    fetchData()
  }, [id, recordId])

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
        setContent(await file.text())
      }
    } catch { alert('파일을 읽을 수 없습니다.') }
    finally {
      setFileLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function buildMeta() {
    if (type === 'meeting') return { attendees: attendees.filter((d) => d.department.trim()).map((d) => ({ department: d.department.trim(), members: d.members.filter(Boolean) })) }
    if (type === 'email') return { from: emailFrom.trim(), to: emailTo.trim(), thread }
    if (type === 'document') return { docType: docType.trim(), version: docVersion.trim() }
    return { source: memoSource.trim() }
  }

  async function handleSave() {
    if (!title.trim() || !recordDate || !content.trim()) return
    setSaving(true)
    await supabase.from('records').update({
      title: title.trim(),
      record_date: recordDate,
      content: content.trim(),
      meta: buildMeta(),
      attachments,
      updated_at: new Date().toISOString(),
    }).eq('id', recordId)
    setSaving(false)
    router.push(`/projects/${id}/records/${recordId}`)
  }

  function addThread() { setThread([...thread, { content: '', date: '' }]) }
  function updateThread(i: number, field: 'content' | 'date', val: string) {
    const next = [...thread]; next[i] = { ...next[i], [field]: val }; setThread(next)
  }
  function removeThread(i: number) { setThread(thread.filter((_, idx) => idx !== i)) }

  const breadcrumbs = [
    { label: project?.name ?? '프로젝트', href: `/projects/${id}` },
    { label: title || TYPE_LABELS[type], href: `/projects/${id}/records/${recordId}` },
    { label: '수정' },
  ]

  const isValid = title.trim() && recordDate && content.trim()

  return (
    <PageLayout breadcrumbs={breadcrumbs}>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-6 space-y-5">
        <h1 className="text-lg font-bold text-slate-800 pb-1 border-b border-slate-100">{TYPE_LABELS[type]} 수정</h1>

        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">제목 *</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">날짜 *</label>
          <Input type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} className="w-48" />
        </div>

        {type === 'meeting' && (
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">참석자</label>
            <AttendeesInput value={attendees} onChange={setAttendees} />
          </div>
        )}

        {type === 'email' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">발신자</label>
              <Input value={emailFrom} onChange={(e) => setEmailFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">수신자</label>
              <Input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} />
            </div>
          </div>
        )}

        {type === 'memo' && (
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">출처</label>
            <Input value={memoSource} onChange={(e) => setMemoSource(e.target.value)} className="w-72" />
          </div>
        )}

        {type === 'document' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">문서 종류</label>
              <Input value={docType} onChange={(e) => setDocType(e.target.value)} placeholder="예: 요구사항 정의서, 기획서" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">버전</label>
              <Input value={docVersion} onChange={(e) => setDocVersion(e.target.value)} placeholder="예: v1.0" className="w-32" />
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">내용 *</label>
            {type !== 'memo' && (
              <label className={`text-xs px-2.5 py-1 rounded-md border cursor-pointer transition-colors ${fileLoading ? 'text-slate-400 border-slate-200' : 'text-blue-600 border-blue-200 hover:bg-blue-50'}`}>
                {fileLoading ? '읽는 중...' : '📎 파일에서 불러오기'}
                <input ref={fileRef} type="file" accept=".docx,.txt" className="hidden" onChange={handleFileUpload} disabled={fileLoading} />
              </label>
            )}
          </div>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={type === 'memo' ? 6 : 14} className="font-mono text-sm" />
        </div>

        {type === 'email' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">답장 스레드</label>
              <button onClick={addThread} className="text-xs text-blue-600 hover:underline">+ 답장 추가</button>
            </div>
            {thread.map((t, i) => (
              <div key={i} className="border border-slate-200 rounded-lg p-3 space-y-2 mb-2 bg-slate-50">
                <div className="flex items-center gap-2">
                  <Input type="date" value={t.date} onChange={(e) => updateThread(i, 'date', e.target.value)} className="w-40 bg-white" />
                  <button onClick={() => removeThread(i)} className="text-slate-400 hover:text-red-500 text-sm ml-auto">✕</button>
                </div>
                <Textarea value={t.content} onChange={(e) => updateThread(i, 'content', e.target.value)} rows={4} className="text-sm bg-white" />
              </div>
            ))}
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">첨부파일</label>
          <AttachmentsInput value={attachments} onChange={setAttachments} />
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
          <Link href={`/projects/${id}/records/${recordId}`}>
            <button className="text-sm px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">취소</button>
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
