'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { DepartmentAttendee, Project, RecordType, DocumentMeta, Attachment, RecordLink } from '@/types'
import { AttachmentsInput } from '@/components/attachments-input'
import { LinksInput } from '@/components/links-input'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AttendeesInput } from '@/components/attendees-input'
import { PageLayout } from '@/components/layout'
import mammoth from 'mammoth'

const TYPE_LABELS: Record<RecordType, string> = {
  meeting: '회의록',
  email: '이메일',
  memo: '메모',
  document: '문서',
}

export default function NewRecordPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const fileRef = useRef<HTMLInputElement>(null)

  const [project, setProject] = useState<Project | null>(null)
  const [type, setType] = useState<RecordType>((searchParams.get('type') as RecordType) ?? 'meeting')
  const [title, setTitle] = useState('')
  const [recordDate, setRecordDate] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [fileLoading, setFileLoading] = useState(false)

  // meeting
  const [attendees, setAttendees] = useState<DepartmentAttendee[]>([])
  // email
  const [emailFrom, setEmailFrom] = useState('')
  const [emailTo, setEmailTo] = useState('')
  const [thread, setThread] = useState<{ content: string; date: string }[]>([])
  // memo
  const [memoSource, setMemoSource] = useState('')
  // attachments
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isBaseline, setIsBaseline] = useState(false)
  const [links, setLinks] = useState<RecordLink[]>([])
  // document
  const [docType, setDocType] = useState('')
  const [docVersion, setDocVersion] = useState('')

  useEffect(() => {
    supabase.from('projects').select('*').eq('id', id).single().then(({ data }) => setProject(data))
  }, [id])

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
    } catch {
      alert('파일을 읽을 수 없습니다.')
    } finally {
      setFileLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function buildMeta() {
    if (type === 'meeting') {
      return {
        attendees: attendees
          .filter((d) => d.department.trim())
          .map((d) => ({ department: d.department.trim(), members: d.members.filter(Boolean) })),
      }
    }
    if (type === 'email') {
      return { from: emailFrom.trim(), to: emailTo.trim(), thread }
    }
    if (type === 'document') {
      return { docType: docType.trim(), version: docVersion.trim() } as DocumentMeta
    }
    return { source: memoSource.trim() }
  }

  async function handleSave() {
    if (!title.trim() || !recordDate || !content.trim()) return
    setSaving(true)
    const { data } = await supabase.from('records').insert({
      project_id: id,
      type,
      title: title.trim(),
      record_date: recordDate,
      content: content.trim(),
      meta: buildMeta(),
      attachments,
      is_baseline: isBaseline,
      links,
    }).select().single()
    setSaving(false)
    if (data) router.push(`/projects/${id}/records/${data.id}`)
  }

  function addThread() {
    setThread([...thread, { content: '', date: '' }])
  }

  function updateThread(i: number, field: 'content' | 'date', val: string) {
    const next = [...thread]
    next[i] = { ...next[i], [field]: val }
    setThread(next)
  }

  function removeThread(i: number) {
    setThread(thread.filter((_, idx) => idx !== i))
  }

  const breadcrumbs = [
    { label: project?.name ?? '프로젝트', href: `/projects/${id}` },
    { label: '새 기록' },
  ]

  const isValid = title.trim() && recordDate && content.trim()

  return (
    <PageLayout breadcrumbs={breadcrumbs}>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-6 space-y-5">
        <h1 className="text-lg font-bold text-slate-800 pb-1 border-b border-slate-100">새 기록 추가</h1>

        {/* 유형 선택 */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">유형</label>
          <div className="flex gap-2">
            {(['meeting', 'email', 'memo', 'document'] as RecordType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`text-sm px-4 py-1.5 rounded-lg border font-medium transition-colors ${
                  type === t
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* 제목 */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
            {type === 'memo' ? '제목 (선택)' : '제목 *'}
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              type === 'meeting' ? '예: 1차 기획 회의' :
              type === 'email' ? '예: 계약 관련 문의' :
              '예: 팀장님 전달사항'
            }
          />
        </div>

        {/* 날짜 */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">날짜 *</label>
          <Input type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} className="w-48" />
        </div>

        {/* 유형별 추가 필드 */}
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
              <Input value={emailFrom} onChange={(e) => setEmailFrom(e.target.value)} placeholder="보낸 사람" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">수신자</label>
              <Input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="받는 사람" />
            </div>
          </div>
        )}

        {type === 'memo' && (
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">출처</label>
            <Input value={memoSource} onChange={(e) => setMemoSource(e.target.value)} placeholder="예: 팀장님, 카톡, 구두 전달" className="w-72" />
          </div>
        )}

        {type === 'document' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">문서 종류</label>
              <Input value={docType} onChange={(e) => setDocType(e.target.value)} placeholder="예: 요구사항 정의서, 기획서, 스펙" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">버전</label>
              <Input value={docVersion} onChange={(e) => setDocVersion(e.target.value)} placeholder="예: v1.0" className="w-32" />
            </div>
          </div>
        )}

        {/* 내용 */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {type === 'meeting' ? '회의 내용' : type === 'email' ? '이메일 본문' : '내용'} *
            </label>
            {type !== 'memo' && (
              <label className={`text-xs px-2.5 py-1 rounded-md border cursor-pointer transition-colors ${fileLoading ? 'text-slate-400 border-slate-200' : 'text-blue-600 border-blue-200 hover:bg-blue-50'}`}>
                {fileLoading ? '읽는 중...' : '📎 파일에서 불러오기'}
                <input ref={fileRef} type="file" accept=".docx,.txt" className="hidden" onChange={handleFileUpload} disabled={fileLoading} />
              </label>
            )}
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              type === 'meeting' ? '회의 내용을 입력하거나 파일에서 불러오세요' :
              type === 'email' ? '이메일 본문을 붙여넣으세요' :
              type === 'document' ? '문서 내용을 붙여넣으세요' :
              '전달받은 내용을 입력하세요'
            }
            rows={type === 'memo' ? 6 : 14}
            className="font-mono text-sm"
          />
        </div>

        {/* 이메일 답장 스레드 */}
        {type === 'email' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">답장 스레드</label>
              <button onClick={addThread} className="text-xs text-blue-600 hover:underline">+ 답장 추가</button>
            </div>
            {thread.length === 0 && (
              <p className="text-xs text-slate-400">답장이 있으면 추가하세요.</p>
            )}
            {thread.map((t, i) => (
              <div key={i} className="border border-slate-200 rounded-lg p-3 space-y-2 mb-2 bg-slate-50">
                <div className="flex items-center gap-2">
                  <Input type="date" value={t.date} onChange={(e) => updateThread(i, 'date', e.target.value)} className="w-40 bg-white" />
                  <button onClick={() => removeThread(i)} className="text-slate-400 hover:text-red-500 text-sm ml-auto">✕</button>
                </div>
                <Textarea
                  value={t.content}
                  onChange={(e) => updateThread(i, 'content', e.target.value)}
                  placeholder="답장 내용"
                  rows={4}
                  className="text-sm bg-white"
                />
              </div>
            ))}
          </div>
        )}

        {/* 링크 */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">링크</label>
          <LinksInput value={links} onChange={setLinks} />
        </div>

        {/* 첨부파일 */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">첨부파일</label>
          <AttachmentsInput value={attachments} onChange={setAttachments} />
        </div>

        {/* 기준 문서 */}
        <label className="flex items-center gap-3 cursor-pointer select-none py-3 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
          <input
            type="checkbox"
            checked={isBaseline}
            onChange={(e) => setIsBaseline(e.target.checked)}
            className="w-4 h-4 rounded accent-teal-600"
          />
          <div>
            <p className="text-sm font-medium text-slate-700">기준 문서로 사용</p>
            <p className="text-xs text-slate-400 mt-0.5">AI 분석 시 이 기록을 기준으로 다른 기록들과 비교합니다</p>
          </div>
        </label>

        <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
          <Link href={`/projects/${id}`}>
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
