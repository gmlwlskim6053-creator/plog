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
  summary: string | null
  decisions: string | null
  action_items: ActionItem[] | null
  analyzed_at: string | null
}

export interface ActionItem {
  assignee: string
  task: string
  done: boolean
}
