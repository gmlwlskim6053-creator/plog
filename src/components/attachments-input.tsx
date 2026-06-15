'use client'

import { useRef, useState } from 'react'
import { Attachment } from '@/types'
import mammoth from 'mammoth'

interface Props {
  value: Attachment[]
  onChange: (value: Attachment[]) => void
}

const TYPE_ICONS: Record<string, string> = { image: '🖼️', pdf: '📄', docx: '📝', txt: '📃', pptx: '📊' }
const TYPE_LABELS: Record<string, string> = {
  image: '이미지 (텍스트 추출 불가)',
  pdf: 'PDF',
  docx: 'Word 문서',
  txt: '텍스트',
  pptx: 'PPT',
}

export function AttachmentsInput({ value, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [processing, setProcessing] = useState(false)

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setProcessing(true)

    const results: Attachment[] = []

    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)

      if (isImage) {
        results.push({ name: file.name, type: 'image' })
        continue
      }

      if (ext === 'docx') {
        try {
          const arrayBuffer = await file.arrayBuffer()
          const result = await mammoth.extractRawText({ arrayBuffer })
          results.push({ name: file.name, type: 'docx', extractedText: result.value })
        } catch {
          results.push({ name: file.name, type: 'docx' })
        }
        continue
      }

      if (ext === 'txt') {
        const text = await file.text()
        results.push({ name: file.name, type: 'txt', extractedText: text })
        continue
      }

      if (ext === 'pdf' || ext === 'pptx' || ext === 'ppt') {
        // PDF/PPT는 서버에서 추출
        const formData = new FormData()
        formData.append('file', file)
        try {
          const res = await fetch('/api/upload', { method: 'POST', body: formData })
          if (res.ok) results.push(await res.json())
          else results.push({ name: file.name, type: ext === 'pdf' ? 'pdf' : 'pptx' })
        } catch {
          results.push({ name: file.name, type: ext === 'pdf' ? 'pdf' : 'pptx' })
        }
        continue
      }

      results.push({ name: file.name, type: 'txt' })
    }

    onChange([...value, ...results])
    setProcessing(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="space-y-1.5">
          {value.map((att, i) => (
            <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 text-sm">
              <span>{TYPE_ICONS[att.type] ?? '📎'}</span>
              <span className="text-slate-700 truncate flex-1">{att.name}</span>
              <span className="text-xs shrink-0">
                {att.extractedText
                  ? <span className="text-emerald-600">텍스트 추출됨</span>
                  : <span className="text-slate-400">{TYPE_LABELS[att.type]}</span>
                }
              </span>
              <button onClick={() => remove(i)} className="text-slate-400 hover:text-red-500 shrink-0">✕</button>
            </div>
          ))}
        </div>
      )}

      <label className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${processing ? 'text-slate-400 border-slate-200 bg-slate-50' : 'text-blue-600 border-blue-200 hover:bg-blue-50'}`}>
        {processing ? '처리 중...' : '📎 파일 첨부'}
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.docx,.pptx,.ppt"
          className="hidden"
          onChange={handleFiles}
          disabled={processing}
        />
      </label>
      <p className="text-[11px] text-slate-400">PDF, Word, PPT, TXT, 이미지 지원 · 이미지는 파일명만 기록됩니다</p>
    </div>
  )
}
