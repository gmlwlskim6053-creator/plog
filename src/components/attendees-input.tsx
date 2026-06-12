'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DepartmentAttendee } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  value: DepartmentAttendee[]
  onChange: (value: DepartmentAttendee[]) => void
}

function MembersInput({
  initialValue,
  onBlur,
  knownMembers,
}: {
  initialValue: string
  onBlur: (raw: string) => void
  knownMembers: string[]
}) {
  const [raw, setRaw] = useState(initialValue)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setRaw(initialValue) }, [initialValue])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setRaw(v)

    const parts = v.split(',')
    const current = parts[parts.length - 1].trim()
    if (current.length > 0) {
      const already = parts.slice(0, -1).map((p) => p.trim())
      const filtered = knownMembers.filter((m) => m.includes(current) && !already.includes(m))
      setSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
    } else {
      setShowSuggestions(false)
    }
  }

  function selectSuggestion(member: string) {
    const parts = raw.split(',')
    parts[parts.length - 1] = ' ' + member
    const next = parts.join(',') + ', '
    setRaw(next)
    onBlur(next)
    setShowSuggestions(false)
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={raw}
        onChange={handleChange}
        onBlur={() => onBlur(raw)}
        placeholder="홍길동, 김철수, 이영희"
        className="bg-white text-sm"
      />
      {showSuggestions && (
        <ul className="absolute z-10 w-full bg-white border rounded-md shadow-md mt-1 max-h-40 overflow-y-auto">
          {suggestions.map((m) => (
            <li
              key={m}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100"
              onMouseDown={() => selectSuggestion(m)}
            >
              {m}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function AttendeesInput({ value, onChange }: Props) {
  const [knownDepts, setKnownDepts] = useState<string[]>([])
  const [knownMembers, setKnownMembers] = useState<string[]>([])

  useEffect(() => {
    supabase.from('meetings').select('attendees').then(({ data }) => {
      const depts = new Set<string>()
      const members = new Set<string>()
      for (const row of data ?? []) {
        for (const d of row.attendees ?? []) {
          if (d.department) depts.add(d.department)
          for (const m of d.members ?? []) {
            if (m) members.add(m)
          }
        }
      }
      setKnownDepts([...depts])
      setKnownMembers([...members])
    })
  }, [])

  function addDepartment() {
    onChange([...value, { department: '', members: [] }])
  }

  function removeDepartment(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  function updateDepartment(index: number, department: string) {
    const next = [...value]
    next[index] = { ...next[index], department }
    onChange(next)
  }

  function updateMembers(index: number, raw: string) {
    const next = [...value]
    const members = raw.split(',').map((m) => m.trim()).filter(Boolean)
    next[index] = { ...next[index], members }
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {value.map((dept, deptIndex) => (
        <div key={deptIndex} className="border rounded-lg p-3 space-y-2 bg-gray-50">
          <div className="flex gap-2 items-center">
            <Input
              list={`dept-list-${deptIndex}`}
              placeholder="부서명 (예: 개발팀)"
              value={dept.department}
              onChange={(e) => updateDepartment(deptIndex, e.target.value)}
              className="bg-white"
              autoComplete="off"
            />
            <datalist id={`dept-list-${deptIndex}`}>
              {knownDepts.map((d) => <option key={d} value={d} />)}
            </datalist>
            <button
              type="button"
              onClick={() => removeDepartment(deptIndex)}
              className="text-gray-400 hover:text-red-500 text-lg leading-none flex-shrink-0"
            >
              ✕
            </button>
          </div>
          <MembersInput
            initialValue={dept.members.join(', ')}
            onBlur={(raw) => updateMembers(deptIndex, raw)}
            knownMembers={knownMembers}
          />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addDepartment}>
        + 부서 추가
      </Button>
    </div>
  )
}
