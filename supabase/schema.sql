-- 在 Supabase SQL Editor 中执行此文件
-- https://sasfkjvdrzgzujoykbqn.supabase.co → SQL Editor → New Query

-- Tasks table
CREATE TABLE tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode        TEXT NOT NULL,
  categories  TEXT NOT NULL,
  grid_size   REAL,
  region_geo  JSONB,
  bounds      JSONB,
  status      TEXT DEFAULT 'pending',
  total_cells INTEGER DEFAULT 0,
  done_cells  INTEGER DEFAULT 0,
  total_pois  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- POIs table
CREATE TABLE pois (
  id           BIGSERIAL PRIMARY KEY,
  task_id      UUID REFERENCES tasks(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  category     TEXT,
  subcategory  TEXT,
  address      TEXT,
  lng          DOUBLE PRECISION NOT NULL,
  lat          DOUBLE PRECISION NOT NULL,
  phone        TEXT,
  rating       DOUBLE PRECISION,
  collected_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_pois_task ON pois(task_id);
CREATE INDEX idx_pois_category ON pois(category);

-- RLS: 个人数据个人看（先用宽松策略，后面可以收紧）
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pois ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for now" ON tasks FOR ALL USING (true);
CREATE POLICY "Allow all for now" ON pois FOR ALL USING (true);
