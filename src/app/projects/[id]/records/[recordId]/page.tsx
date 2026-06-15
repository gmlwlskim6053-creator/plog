'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Project, Record as AppRecord, MeetingMeta, EmailMeta, MemoMeta, DocumentMeta, Attachment } from '@/types'
import { getDeptColor } from '@/lib/utils'
import { PageLayout } from '@/components/layout'

const TYPE_LABELS = { meeting: '회의록', email: '이메일', memo: '메모', document: '문서' }

export default function RecordDetailPage() {
  const { id, recordId } = useParams<{ id: string; recordId: string }>()
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [record, setRecord] = useState<AppRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const [{ data: proj }, { data: rec }] = await Promise.all([
        supabase.from('projects').select('*').eq('id', id).single(),
        supabase.from('records').select('*').eq('id', recordId).single(),
      ])
      setProject(proj)
      setRecord(rec)
      setLoading(false)
    }
    fetchData()
  }, [id, recordId])

  async function handleDelete() {
    if (!confirm('이 기록을 삭제하시겠습니까?')) return
    await supabase.from('records').delete().eq('id', recordId)
    router.push(`/projects/${id}`)
  }

  const breadcrumbs = [
    { label: project?.name ?? '프로젝트', href: `/projects/${id}` },
    { label: record?.title ?? '기록' },
  ]

  if (loading) return <PageLayout><div className="flex items-center justify-center py-24 text-slate-400">불러오는 중...</div></PageLayout>
  if (!record) return <PageLayout><div className="text-center py-24 text-slate-400">기록을 찾을 수 없습니다.</div></PageLayout>

  const dateStr = new Date(record.record_date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  const meta = record.meta

  return (
    <PageLayout breadcrumbs={breadcrumbs}>
      {/* 헤더 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-500">{TYPE_LABELS[record.type]}</span>
              <p className="text-xs text-slate-400">📅 {dateStr}</p>
            </div>
            <h1 className="text-xl font-bold text-slate-800">{record.title}</h1>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href={`/projects/${id}/records/${recordId}/edit`}>
              <button className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">수정</button>
            </Link>
            <button onClick={handleDelete} className="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors">삭제</button>
          </div>
        </div>

        {/* 유형별 메타 */}
        {record.type === 'meeting' && (meta as MeetingMeta).attendees?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-400 mb-2">참석자</p>
            <div className="flex flex-wrap gap-3">
              {(meta as MeetingMeta).attendees.map((dept, i) => {
                const color = getDeptColor(dept.department)
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`text-[11px] px-1.5 py-0.5 rounded ${color.bg} ${color.text}`}>{dept.department}</span>
                    <span className="text-xs text-slate-600">{dept.members.join(', ')}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {record.type === 'email' && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex gap-6">
            <span className="text-xs text-slate-400">발신 <span className="text-slate-700 font-medium">{(meta as EmailMeta).from}</span></span>
            <span className="text-xs text-slate-400">수신 <span className="text-slate-700 font-medium">{(meta as EmailMeta).to}</span></span>
          </div>
        )}

        {record.type === 'memo' && (meta as MemoMeta).source && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <span className="text-xs text-slate-400">출처 <span className="text-slate-600 font-medium">{(meta as MemoMeta).source}</span></span>
          </div>
        )}

        {record.type === 'document' && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex gap-6">
            {(meta as DocumentMeta).docType && (
              <span className="text-xs text-slate-400">종류 <span className="text-slate-600 font-medium">{(meta as DocumentMeta).docType}</span></span>
            )}
            {(meta as DocumentMeta).version && (
              <span className="text-xs text-slate-400">버전 <span className="text-slate-600 font-medium">{(meta as DocumentMeta).version}</span></span>
            )}
          </div>
        )}
      </div>

      {/* 첨부파일 */}
      {(record as AppRecord & { attachments?: Attachment[] }).attachments?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5 mb-5">
          <p className="text-xs font-medium text-slate-400 mb-3">첨부파일</p>
          <div className="space-y-1.5">
            {(record as AppRecord & { attachments?: Attachment[] }).attachments!.map((att, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 text-sm">
                <span>{att.type === 'image' ? '🖼️' : att.type === 'pdf' ? '📄' : att.type === 'docx' ? '📝' : att.type === 'pptx' ? '📊' : '📃'}</span>
                <span className="text-slate-700 flex-1">{att.name}</span>
                {att.extractedText
                  ? <span className="text-xs text-emerald-600 shrink-0">텍스트 추출됨 · AI 분석에 포함</span>
                  : <span className="text-xs text-slate-400 shrink-0">이미지 · AI 분석 미포함</span>
                }
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 본문 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5">
        <p className="text-xs font-medium text-slate-400 mb-4">내용</p>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-slate-700">{record.content}</pre>

        {/* 이메일 답장 스레드 */}
        {record.type === 'email' && (meta as EmailMeta).thread?.length > 0 && (
          <div className="mt-6 space-y-4">
            {(meta as EmailMeta).thread.map((t, i) => (
              <div key={i} className="border-l-2 border-slate-200 pl-4">
                <p className="text-xs text-slate-400 mb-1">답장 · {t.date}</p>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-slate-700">{t.content}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  )
}
