import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

type DbRecord = {
  id: string
  project_id: string
  type: string
  title: string
  record_date: string
  content: string
  meta: Record<string, unknown>
  attachments?: { name: string; type: string; extractedText?: string }[]
  links?: { url: string; note: string }[]
  is_baseline?: boolean
}

async function fetchLinkText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Plog-Bot/1.0)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return ''
    const html = await res.text()
    // HTML 태그 제거, 공백 정리
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 3000)
  } catch {
    return ''
  }
}

async function buildRecordDetail(r: DbRecord) {
  const date = new Date(r.record_date).toLocaleDateString('ko-KR')
  const meta = r.meta

  let detail = `[회의] ${r.title} (${date})\n내용: ${r.content.slice(0, 500)}${r.content.length > 500 ? '...' : ''}`

  if (r.type === 'email') {
    const thread = (meta.thread as { date: string; content: string }[] | undefined) ?? []
    const threadText = thread.length > 0
      ? '\n답장:\n' + thread.map((t) => `  [${t.date}] ${t.content.slice(0, 300)}${t.content.length > 300 ? '...' : ''}`).join('\n')
      : ''
    detail = `[이메일] ${r.title} (${date})\n발신: ${meta.from ?? ''} → 수신: ${meta.to ?? ''}\n내용: ${r.content.slice(0, 500)}${r.content.length > 500 ? '...' : ''}${threadText}`
  } else if (r.type === 'memo') {
    detail = `[메모] ${date} / 출처: ${(meta.source as string) ?? ''}\n내용: ${r.content}`
  } else if (r.type === 'document') {
    detail = `[문서] ${r.title} (${date}) / 종류: ${(meta.docType as string) ?? ''} / 버전: ${(meta.version as string) ?? ''}\n내용: ${r.content.slice(0, 2000)}${r.content.length > 2000 ? '...' : ''}`
  }

  const textAtts = (r.attachments ?? []).filter((a) => a.extractedText)
  if (textAtts.length > 0) {
    detail += '\n첨부파일:\n' + textAtts.map((a) =>
      `[${a.name}]\n${a.extractedText?.slice(0, 1500)}`
    ).join('\n\n')
  }

  const links = r.links ?? []
  if (links.length > 0) {
    const linkTexts = await Promise.all(
      links.map(async (l) => {
        const text = await fetchLinkText(l.url)
        const noteStr = l.note ? ` (비고: ${l.note})` : ''
        return text
          ? `[링크${noteStr}] ${l.url}\n${text}`
          : `[링크${noteStr}] ${l.url}\n(내용을 불러올 수 없습니다)`
      })
    )
    detail += '\n링크:\n' + linkTexts.join('\n\n')
  }

  return detail
}

export async function POST(req: NextRequest) {
  const { projectId, password } = await req.json()

  if (password !== process.env.ANALYSIS_PASSWORD) {
    return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 401 })
  }

  // 상위 프로젝트 정보 조회
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (!project) return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 })

  // 하위 프로젝트 조회
  const { data: childProjects } = await supabase
    .from('projects')
    .select('*')
    .eq('parent_id', projectId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  const hasChildren = childProjects && childProjects.length > 0

  // 분석 대상 프로젝트 목록 (상위 본인 + 하위들)
  const allProjectIds = [projectId, ...(childProjects?.map((p) => p.id) ?? [])]

  // 모든 기록 조회
  const { data: allRecords } = await supabase
    .from('records')
    .select('*')
    .in('project_id', allProjectIds)
    .order('record_date', { ascending: true })

  if (!allRecords || allRecords.length === 0) {
    return NextResponse.json({ error: '분석할 기록이 없습니다.' }, { status: 400 })
  }

  // 버전 계산
  const { data: lastAnalysis } = await supabase
    .from('project_analyses')
    .select('version')
    .eq('project_id', projectId)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  const nextVersion = lastAnalysis ? lastAnalysis.version + 1 : 1

  let prompt: string
  let result: Record<string, unknown>

  if (hasChildren) {
    // ── 하위 프로젝트가 있는 경우: 프로젝트별로 분리하여 분석 ──
    const sections: string[] = []

    // 상위 프로젝트 자체 기록
    const parentRecords = allRecords.filter((r) => r.project_id === projectId)
    if (parentRecords.length > 0) {
      const baseDocs = parentRecords.filter((r) => r.is_baseline)
      const activityRecs = parentRecords.filter((r) => !r.is_baseline)
      let section = `=== [상위] ${project.name} ===`
      if (baseDocs.length > 0) section += `\n\n[기준 문서]\n${(await Promise.all(baseDocs.map(buildRecordDetail))).join('\n---\n')}`
      if (activityRecs.length > 0) section += `\n\n[활동 기록]\n${(await Promise.all(activityRecs.map(buildRecordDetail))).join('\n---\n')}`
      sections.push(section)
    }

    // 각 하위 프로젝트 기록
    for (const child of childProjects!) {
      const childRecords = allRecords.filter((r) => r.project_id === child.id)
      if (childRecords.length === 0) continue
      const baseDocs = childRecords.filter((r) => r.is_baseline)
      const activityRecs = childRecords.filter((r) => !r.is_baseline)
      let section = `=== [하위] ${child.name} (id: ${child.id}) ===`
      if (baseDocs.length > 0) section += `\n\n[기준 문서]\n${(await Promise.all(baseDocs.map(buildRecordDetail))).join('\n---\n')}`
      if (activityRecs.length > 0) section += `\n\n[활동 기록]\n${(await Promise.all(activityRecs.map(buildRecordDetail))).join('\n---\n')}`
      sections.push(section)
    }

    const subProjectList = childProjects!.map((c) => `- ${c.name} (id: ${c.id})`).join('\n')

    prompt = `다음은 "${project.name}" 프로젝트와 그 하위 프로젝트들의 기록입니다.
하위 프로젝트별로 나눠서 현황을 분석하고, 전체 요약과 핵심 마일스톤도 함께 추출해주세요.

하위 프로젝트 목록:
${subProjectList}

${sections.join('\n\n')}

아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.

{
  "summary": "전체 프로젝트 현황을 3~5문장으로 요약",
  "milestones": [
    { "date": "날짜 또는 '미정'", "content": "핵심 마일스톤 (전체를 대표하는 3~6개)" }
  ],
  "sub_projects": [
    {
      "project_id": "하위 프로젝트 id (위 목록의 id 그대로)",
      "project_name": "하위 프로젝트명",
      "summary": "이 하위 프로젝트 현황 요약 (2~3문장)",
      "confirmed": [{ "category": "카테고리명", "content": "확정된 사항", "source": "출처" }],
      "changed": [{ "category": "카테고리명", "content": "변경 내용", "from": "기존", "to": "변경 후", "source": "출처" }],
      "pending": [{ "category": "카테고리명", "content": "미결 사항", "source": "출처" }],
      "schedules": [{ "date": "날짜", "content": "세부 일정", "source": "출처" }]
    }
  ]
}

규칙:
- sub_projects 배열에 기록이 있는 하위 프로젝트만 포함하세요.
- 상위 프로젝트 자체 기록(기준 문서 등)은 모든 하위 프로젝트 분석의 기준으로 활용하세요.
- 기준 문서가 있으면 그것을 기반으로 confirmed/changed/pending을 채우세요.
- milestones는 전체 프로젝트를 대표하는 핵심 시점만 3~6개.
- category는 해당 항목의 성격에 맞는 한국어 카테고리명 (예: 기획, 홍보, 개발, 심사, 운영, 법무, 디자인, 예산 등 프로젝트에 맞게 자유롭게).
- 없는 항목은 빈 배열로 반환하세요.
- [중복 금지] confirmed / changed / pending 세 배열은 서로 겹치지 않아야 합니다. 하나의 사안은 반드시 하나의 배열에만 넣으세요.
  - changed: 한 번이라도 내용이 바뀐 사안 (from → to 로 변화를 표현). 현재 확정된 상태여도 변경 이력이 있으면 changed에만 넣습니다.
  - confirmed: 처음 결정된 이후 한 번도 변경되지 않고 확정된 사안만.
  - pending: 아직 결정되지 않은 사안. 확정이나 변경이 있었더라도 현재 미결이면 pending에만 넣습니다.`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'AI 응답 파싱 실패' }, { status: 500 })

    try {
      result = JSON.parse(jsonMatch[0])
    } catch {
      return NextResponse.json(
        { error: '분석 결과가 너무 길어 처리할 수 없습니다. 잠시 후 다시 시도해주세요.' },
        { status: 500 }
      )
    }

  } else {
    // ── 하위 프로젝트 없음: 기존 방식 ──
    const records = allRecords
    const baseDocuments = records.filter((r) => r.is_baseline)
    const activityRecords = records.filter((r) => !r.is_baseline)

    const baseSummary = baseDocuments.length > 0
      ? `=== 기준 문서 ===\n\n${(await Promise.all(baseDocuments.map(buildRecordDetail))).join('\n\n---\n\n')}`
      : ''
    const activitySummary = activityRecords.length > 0
      ? `=== 활동 기록 ===\n\n${(await Promise.all(activityRecords.map(buildRecordDetail))).join('\n\n---\n\n')}`
      : ''

    const hasBaseDoc = baseDocuments.length > 0

    prompt = `다음은 "${project.name}" 프로젝트의 기록입니다.
${hasBaseDoc ? '기준 문서를 기반으로 활동 기록과 비교하여 현황을 분석해주세요.' : '기록들을 종합 분석해서 현재 프로젝트 현황을 반환해주세요.'}

${[baseSummary, activitySummary].filter(Boolean).join('\n\n')}

아래 JSON 형식으로만 응답하세요.

{
  "summary": "프로젝트 전체 현황 3~5문장 요약",
  "confirmed": [{ "category": "카테고리명", "content": "확정 사항", "source": "출처" }],
  "changed": [{ "category": "카테고리명", "content": "변경 내용", "from": "기존", "to": "변경 후", "source": "출처" }],
  "pending": [{ "category": "카테고리명", "content": "미결 사항", "source": "출처" }],
  "milestones": [{ "date": "날짜 또는 '미정'", "content": "핵심 마일스톤 (3~6개)" }],
  "schedules": [{ "date": "날짜", "content": "세부 일정", "source": "출처" }],
  "sub_projects": []
}

규칙:
${hasBaseDoc ? `- 기준 문서를 기반으로 confirmed/changed/pending을 채우세요.` : `- 활동 기록에서 confirmed/changed/pending을 추출하세요.`}
- milestones는 핵심 시점만 3~6개.
- category는 해당 항목의 성격에 맞는 한국어 카테고리명 (예: 기획, 홍보, 개발, 심사, 운영, 법무, 디자인, 예산 등 프로젝트에 맞게 자유롭게).
- 없으면 빈 배열.
- [중복 금지] confirmed / changed / pending 세 배열은 서로 겹치지 않아야 합니다. 하나의 사안은 반드시 하나의 배열에만 넣으세요.
  - changed: 한 번이라도 내용이 바뀐 사안 (from → to 로 변화를 표현). 현재 확정된 상태여도 변경 이력이 있으면 changed에만 넣습니다.
  - confirmed: 처음 결정된 이후 한 번도 변경되지 않고 확정된 사안만.
  - pending: 아직 결정되지 않은 사안. 확정이나 변경이 있었더라도 현재 미결이면 pending에만 넣습니다.`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'AI 응답 파싱 실패' }, { status: 500 })

    try {
      result = JSON.parse(jsonMatch[0])
    } catch {
      return NextResponse.json(
        { error: '분석 결과가 너무 길어 처리할 수 없습니다. 잠시 후 다시 시도해주세요.' },
        { status: 500 }
      )
    }
  }

  const { data: analysis } = await supabase
    .from('project_analyses')
    .insert({
      project_id: projectId,
      version: nextVersion,
      summary: result.summary,
      confirmed: result.confirmed ?? [],
      changed: result.changed ?? [],
      pending: result.pending ?? [],
      milestones: result.milestones ?? [],
      schedules: result.schedules ?? [],
      sub_projects: result.sub_projects ?? [],
    })
    .select()
    .single()

  return NextResponse.json({ analysis })
}
