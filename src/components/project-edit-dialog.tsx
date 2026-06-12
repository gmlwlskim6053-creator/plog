'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Project } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  project: Project
}

export function ProjectEditDialog({ open, onClose, onSaved, project }: Props) {
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [saving, setSaving] = useState(false)

  if (!open) return null

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    await supabase
      .from('projects')
      .update({ name: name.trim(), description: description.trim() || null })
      .eq('id', project.id)
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
        <h2 className="text-lg font-bold mb-4">프로젝트 수정</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block">프로젝트명 *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">설명</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-6">
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>
    </div>
  )
}
