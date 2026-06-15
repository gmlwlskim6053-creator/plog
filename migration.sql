-- =============================================
-- Step 1: 새 테이블 생성
-- =============================================

CREATE TABLE IF NOT EXISTS records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('meeting', 'email', 'memo')),
  title text NOT NULL,
  record_date timestamptz NOT NULL,
  content text NOT NULL DEFAULT '',
  meta jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS record_analyses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  record_id uuid REFERENCES records(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  result jsonb NOT NULL DEFAULT '{}',
  analyzed_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_analyses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  summary text,
  confirmed jsonb DEFAULT '[]',
  changed jsonb DEFAULT '[]',
  pending jsonb DEFAULT '[]',
  schedules jsonb DEFAULT '[]',
  analyzed_at timestamptz DEFAULT now()
);

-- =============================================
-- Step 2: 기존 meetings → records 마이그레이션
-- =============================================

INSERT INTO records (id, project_id, type, title, record_date, content, meta, created_at)
SELECT
  id,
  project_id,
  'meeting',
  title,
  held_at,
  content,
  jsonb_build_object('attendees', attendees),
  created_at
FROM meetings
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- Step 3: 기존 meeting_analyses → record_analyses 마이그레이션
-- =============================================

INSERT INTO record_analyses (record_id, version, result, analyzed_at)
SELECT
  meeting_id,
  version,
  jsonb_build_object(
    'summary', summary,
    'decisions', decisions,
    'action_items', action_items,
    'schedules', schedules
  ),
  analyzed_at
FROM meeting_analyses
ON CONFLICT DO NOTHING;
