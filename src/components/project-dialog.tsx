'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Project } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  project?: Project
}

export function ProjectDialog({ open, onClose, onSaved, project }: Props) {
  const [parentName, setParentName] = useState('')
  const [childName, setChildName] = useState('')
  const [description, setDescription] = useState(project?.description ?? '')
  const [parentProjects, setParentProjects] = useState<Project[]>([])
  const [childProjects, setChildProjects] = useState<Project[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    supabase
      .from('projects')
      .select('*')
      .is('deleted_at', null)
      .is('parent_id', null)
      .order('name')
      .then(({ data }) => setParentProjects(data ?? []))
  }, [open])

  useEffect(() => {
    if (!parentName.trim()) {
      setChildProjects([])
      return
    }
    const matched = parentProjects.find((p) => p.name === parentName.trim())
    if (!matched) {
      setChildProjects([])
      return
    }
    supabase
      .from('projects')
      .select('*')
      .is('deleted_at', null)
      .eq('parent_id', matched.id)
      .order('name')
      .then(({ data }) => setChildProjects(data ?? []))
  }, [parentName, parentProjects])

  if (!open) return null

  async function handleSave() {
    if (!parentName.trim()) return
    setSaving(true)

    let parentId: string

    const existingParent = parentProjects.find((p) => p.name === parentName.trim())
    if (existingParent) {
      parentId = existingParent.id
    } else {
      const { data } = await supabase
        .from('projects')
        .insert({ name: parentName.trim(), parent_id: null })
        .select()
        .single()
      parentId = data.id
    }

    if (childName.trim()) {
      const existingChild = childProjects.find((p) => p.name === childName.trim())
      if (!existingChild) {
        await supabase.from('projects').insert({
          name: childName.trim(),
          parent_id: parentId,
          description: description.trim() || null,
        })
      }
    } else {
      if (description.trim() && existingParent) {
        await supabase.from('projects').update({ description: description.trim() }).eq('id', parentId)
      }
    }

    setSaving(false)
    setParentName('')
    setChildName('')
    setDescription('')
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
        <h2 className="text-lg font-bold mb-4">프로젝트 추가</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block">상위 프로젝트 *</label>
            <Input
              list="parent-list"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="예: 스피치콘테스트"
              autoComplete="off"
            />
            <datalist id="parent-list">
              {parentProjects.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">프로젝트명 (선택)</label>
            <Input
              list="child-list"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              placeholder="예: 솔루션 업데이트 대발"
              autoComplete="off"
            />
            <datalist id="child-list">
              {childProjects.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
            <p className="text-xs text-gray-400 mt-1">입력하지 않으면 상위 프로젝트만 생성됩니다.</p>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">설명 (선택)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="프로젝트 설명"
              rows={3}
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-6">
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={handleSave} disabled={saving || !parentName.trim()}>
            {saving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>
    </div>
  )
}
