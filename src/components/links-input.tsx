'use client'

import { RecordLink } from '@/types'
import { Input } from '@/components/ui/input'

interface Props {
  value: RecordLink[]
  onChange: (value: RecordLink[]) => void
}

export function LinksInput({ value, onChange }: Props) {
  function add() {
    onChange([...value, { url: '', note: '' }])
  }

  function update(i: number, field: 'url' | 'note', val: string) {
    const next = [...value]
    next[i] = { ...next[i], [field]: val }
    onChange(next)
  }

  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-2">
      {value.map((link, i) => (
        <div key={i} className="flex gap-2 items-start">
          <div className="flex-1 space-y-1.5">
            <Input
              value={link.url}
              onChange={(e) => update(i, 'url', e.target.value)}
              placeholder="https://..."
              className="text-sm"
            />
            <Input
              value={link.note}
              onChange={(e) => update(i, 'note', e.target.value)}
              placeholder="비고 (예: 1차 프로토타입 링크)"
              className="text-sm"
            />
          </div>
          <button
            onClick={() => remove(i)}
            className="text-slate-400 hover:text-red-500 mt-2 shrink-0"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="text-xs text-blue-600 hover:underline"
      >
        + 링크 추가
      </button>
      <p className="text-[11px] text-slate-400">AI 분석 시 링크에 직접 접속해서 내용을 읽습니다</p>
    </div>
  )
}
