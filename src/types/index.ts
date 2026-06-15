export interface Project {
  id: string
  name: string
  description: string | null
  parent_id: string | null
  created_at: string
  deleted_at: string | null
}

export interface DepartmentAttendee {
  department: string
  members: string[]
}

export interface ActionItem {
  assignee: string
  task: string
}

export interface Schedule {
  date: string
  content: string
}

// 기록 유형별 meta 구조
export interface MeetingMeta {
  attendees: DepartmentAttendee[]
}

export interface EmailMeta {
  from: string
  to: string
  thread: { content: string; date: string }[]
}

export interface MemoMeta {
  source: string
}

export interface DocumentMeta {
  docType: string
  version: string
}

export type RecordType = 'meeting' | 'email' | 'memo' | 'document'
export interface Attachment {
  name: string
  type: 'image' | 'pdf' | 'docx' | 'txt' | 'pptx'
  extractedText?: string
}

export type RecordMeta = MeetingMeta | EmailMeta | MemoMeta

export interface Record {
  id: string
  project_id: string
  type: RecordType
  title: string
  record_date: string
  content: string
  meta: RecordMeta
  is_baseline: boolean
  created_at: string
  updated_at: string
}

// 기록별 AI 분석 결과
export interface MeetingAnalysisResult {
  summary: string
  decisions: string[]
  action_items: ActionItem[]
  schedules: Schedule[]
}

export interface EmailAnalysisResult {
  summary: string
  requests: string[]
  conclusions: string[]
}

export interface MemoAnalysisResult {
  category: 'confirmed' | 'changed' | 'pending' | 'info'
  summary: string
}

export type AnalysisResult = MeetingAnalysisResult | EmailAnalysisResult | MemoAnalysisResult

export interface RecordAnalysis {
  id: string
  record_id: string
  version: number
  result: AnalysisResult
  analyzed_at: string
}

// 하위 프로젝트별 분석 결과
export interface SubProjectAnalysis {
  project_id: string
  project_name: string
  summary: string
  confirmed: { content: string; source: string }[]
  changed: { content: string; from: string; to: string; source: string }[]
  pending: { content: string; source: string }[]
  schedules: { date: string; content: string; source: string }[]
}

// 프로젝트 전체 AI 분석
export interface ProjectAnalysis {
  id: string
  project_id: string
  version: number
  summary: string | null
  confirmed: { content: string; source: string }[]
  changed: { content: string; from: string; to: string; source: string }[]
  pending: { content: string; source: string }[]
  milestones: { date: string; content: string }[]
  schedules: { date: string; content: string; source: string }[]
  sub_projects: SubProjectAnalysis[]
  analyzed_at: string
}

// 기존 호환용 (점진적 제거)
export interface Meeting {
  id: string
  project_id: string
  title: string
  held_at: string
  attendees: DepartmentAttendee[]
  content: string
  created_at: string
}

export interface MeetingAnalysis {
  id: string
  meeting_id: string
  version: number
  summary: string | null
  decisions: string[]
  action_items: ActionItem[]
  schedules: Schedule[]
  analyzed_at: string
}
