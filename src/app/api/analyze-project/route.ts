import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(req: NextRequest) {
  const { projectId, password } = await req.json()

  if (password !== process.env.ANALYSIS_PASSWORD) {
    return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 401 })
  }

  // 프로젝트의 모든 기록 조회 (날짜순)
  const { data: records } = await supabase
    .from('records')
    .select('*')
    .eq('project_id', projectId)
    .order('record_date', { ascending: true })

  if (!records || records.length === 0) {
    return NextResponse.json({ error: '분석할 기록이 없습니다.' }, { status: 400 })
  }

  // 각 기록의 최신 분석 결과 조회
  const recordIds = records.map((r) => r.id)
  const { data: allAnalyses } = await supabase
    .from('record_analyses')
    .select('*')
    .in('record_id', recordIds)
    .order('version', { ascending: false })

  const latestAnalysisMap = new Map<string, { result: Record<string, unknown> }>()
  for (const a of allAnalyses ?? []) {
    if (!latestAnalysisMap.has(a.record_id)) latestAnalysisMap.set(a.record_id, a)
  }

  // 문서(기준)와 활동 기록 분리
  function buildRecordDetail(r: typeof records[0]) {
    const date = new Date(r.record_date).toLocaleDateString('ko-KR')
    const analysis = latestAnalysisMap.get(r.id)
    const meta = r.meta as Record<string, unknown>

    let detail = `[회의] ${r.title} (${date})\n내용: ${r.content.slice(0, 500)}${r.content.length > 500 ? '...' : ''}`

    if (r.type === 'email') {
      detail = `[이메일] ${r.title} (${date})\n발신: ${meta.from ?? ''} → 수신: ${meta.to ?? ''}\n내용: ${r.content.slice(0, 500)}${r.content.length > 500 ? '...' : ''}`
    } else if (r.type === 'memo') {
      detail = `[메모] ${date} / 출처: ${(meta.source as string) ?? ''}\n내용: ${r.content}`
    } else if (r.type === 'document') {
      detail = `[문서] ${r.title} (${date}) / 종류: ${(meta.docType as string) ?? ''} / 버전: ${(meta.version as string) ?? ''}\n내용: ${r.content.slice(0, 2000)}${r.content.length > 2000 ? '...' : ''}`
    }

    const textAtts = (r.attachments ?? []).filter((a: { type: string; extractedText?: string }) => a.extractedText)
    if (textAtts.length > 0) {
      detail += '\n첨부파일:\n' + textAtts.map((a: { name: string; extractedText?: string }) =>
        `[${a.name}]\n${a.extractedText?.slice(0, 1500)}`
      ).join('\n\n')
    }

    if (analysis) {
      detail += `\nAI 분석: ${JSON.stringify(analysis.result)}`
    }

    return detail
  }

  const baseDocuments = records.filter((r) => r.type === 'document')
  const activityRecords = records.filter((r) => r.type !== 'document')

  const baseSummary = baseDocuments.length > 0
    ? `=== 기준 문서 (요구사항/스펙/기획서 등) ===\n\n${baseDocuments.map(buildRecordDetail).join('\n\n---\n\n')}`
    : ''

  const activitySummary = activityRecords.length > 0
    ? `=== 활동 기록 (회의록/이메일/메모 등) ===\n\n${activityRecords.map(buildRecordDetail).join('\n\n---\n\n')}`
    : ''

  const recordSummaries = [baseSummary, activitySummary].filter(Boolean).join('\n\n')

  const { data: lastAnalysis } = await supabase
    .from('project_analyses')
    .select('version')
    .eq('project_id', projectId)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  const nextVersion = lastAnalysis ? lastAnalysis.version + 1 : 1

  const hasBaseDoc = baseDocuments.length > 0

  const prompt = `다음은 하나의 프로젝트에서 발생한 모든 기록입니다.
${hasBaseDoc ? '기준 문서(요구사항 정의서, 기획서, 스펙 등)를 기준으로, 활동 기록(회의록, 이메일, 메모)과 비교하여 현황을 분석해주세요.' : '기록들을 종합 분석해서 현재 프로젝트 현황을 JSON 형식으로 반환해주세요.'}

${recordSummaries}

아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.

{
  "summary": "프로젝트 전체 현황을 3~5문장으로 요약${hasBaseDoc ? '. 기준 문서 대비 현재 진행 상태 중심으로' : ''}",
  "confirmed": [
    { "content": "${hasBaseDoc ? '기준 문서에서 정의된 항목 중 회의/메모/이메일을 통해 실행 또는 확정된 사항' : '확정된 사항 내용'}", "source": "출처" }
  ],
  "changed": [
    { "content": "변경 내용 설명", "from": "${hasBaseDoc ? '기준 문서의 원래 내용' : '기존 내용'}", "to": "변경된 내용", "source": "출처" }
  ],
  "pending": [
    { "content": "${hasBaseDoc ? '기준 문서에 정의되어 있으나 아직 결정/실행되지 않은 사항, 또는 활동 기록에서 미결로 남은 사항' : '아직 결정되지 않은 사항'}", "source": "출처" }
  ],
  "milestones": [
    { "date": "날짜 또는 '미정'", "content": "핵심 마일스톤 (3~6개, 프로젝트 전체를 대표하는 중요 시점만)" }
  ],
  "schedules": [
    { "date": "날짜 또는 기간", "content": "세부 일정 내용", "source": "출처" }
  ]
}

규칙:
${hasBaseDoc ? `- 기준 문서를 분석의 출발점으로 삼아, 활동 기록(회의/이메일/메모)과 비교하여 각 항목을 채워주세요.
- confirmed: 기준 문서 항목 중 실제로 진행/확정된 것.
- changed: 기준 문서와 달라진 것 (회의나 메모에서 변경 결정된 것).
- pending: 기준 문서에 있으나 아직 논의/결정되지 않은 것, 또는 활동 기록에서 미결로 남은 것.` : `- confirmed/changed/pending: 활동 기록에서 추출.`}
- milestones: 프로젝트의 핵심 분기점만 추출. 날짜가 미정이면 "미정"으로 표기. 3~6개를 넘지 않도록.
- schedules: 기록에서 언급된 모든 세부 일정.
- 없으면 빈 배열로 반환하세요.
- 시간 흐름에 따라 변경된 사항은 반드시 changed에 포함하세요.`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return NextResponse.json({ error: 'AI 응답 파싱 실패' }, { status: 500 })
  }

  const result = JSON.parse(jsonMatch[0])

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
    })
    .select()
    .single()

  return NextResponse.json({ analysis })
}
