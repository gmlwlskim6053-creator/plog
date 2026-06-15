import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

function buildPrompt(record: { type: string; title: string; record_date: string; content: string; meta: Record<string, unknown> }): string {
  if (record.type === 'meeting') {
    const attendees = (record.meta.attendees as { department: string; members: string[] }[] ?? [])
      .map((a) => `${a.department}: ${a.members.join(', ')}`)
      .join(' / ')
    return `다음 회의록을 분석해서 JSON 형식으로 반환해주세요.

회의 제목: ${record.title}
회의 일자: ${record.record_date}
참석자: ${attendees}
회의 내용:
${record.content}

아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.

{
  "summary": "회의 전체 내용을 3~5문장으로 요약",
  "decisions": ["결정사항 1", "결정사항 2"],
  "action_items": [{ "assignee": "담당자 이름", "task": "해야 할 일" }],
  "schedules": [{ "date": "YYYY-MM-DD 또는 날짜 표현", "content": "일정 내용" }]
}

결정사항, Action Item, 일정이 없으면 빈 배열로 반환하세요.`
  }

  if (record.type === 'email') {
    const meta = record.meta as { from?: string; to?: string; thread?: { content: string; date: string }[] }
    const thread = (meta.thread ?? []).map((t, i) => `[답장 ${i + 1} - ${t.date}]\n${t.content}`).join('\n\n')
    return `다음 이메일을 분석해서 JSON 형식으로 반환해주세요.

제목: ${record.title}
날짜: ${record.record_date}
발신: ${meta.from ?? ''} → 수신: ${meta.to ?? ''}
본문:
${record.content}
${thread ? `\n답장:\n${thread}` : ''}

아래 JSON 형식으로만 응답하세요.

{
  "summary": "이메일 전체 맥락을 2~3문장으로 요약",
  "requests": ["요청사항 1", "요청사항 2"],
  "conclusions": ["결론/합의된 내용 1", "결론/합의된 내용 2"]
}

없으면 빈 배열로 반환하세요.`
  }

  // memo
  const meta = record.meta as { source?: string }
  return `다음 메모를 분석해서 JSON 형식으로 반환해주세요.

날짜: ${record.record_date}
출처: ${meta.source ?? ''}
내용:
${record.content}

아래 JSON 형식으로만 응답하세요.

{
  "category": "confirmed | changed | pending | info",
  "summary": "메모 내용을 1~2문장으로 요약"
}

category 기준:
- confirmed: 확정된 사항
- changed: 기존과 달라진 변경사항
- pending: 아직 결정되지 않은 사항
- info: 단순 참고/전달 정보`
}

export async function POST(req: NextRequest) {
  const { recordId, password } = await req.json()

  if (password !== process.env.ANALYSIS_PASSWORD) {
    return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 401 })
  }

  const { data: record } = await supabase
    .from('records')
    .select('*')
    .eq('id', recordId)
    .single()

  if (!record) {
    return NextResponse.json({ error: '기록을 찾을 수 없습니다.' }, { status: 404 })
  }

  const { data: lastAnalysis } = await supabase
    .from('record_analyses')
    .select('version')
    .eq('record_id', recordId)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  const nextVersion = lastAnalysis ? lastAnalysis.version + 1 : 1

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: buildPrompt(record) }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return NextResponse.json({ error: 'AI 응답 파싱 실패' }, { status: 500 })
  }

  const result = JSON.parse(jsonMatch[0])

  const { data: analysis } = await supabase
    .from('record_analyses')
    .insert({ record_id: recordId, version: nextVersion, result })
    .select()
    .single()

  return NextResponse.json({ analysis })
}
