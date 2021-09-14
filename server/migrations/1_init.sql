BEGIN;

CREATE TABLE projects (
       project_name TEXT PRIMARY KEY,
       project_value JSONB NOT NULL,
       project_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE exports (
       project_name TEXT NOT NULL REFERENCES projects(project_name),
       export_name TEXT NOT NULL,
       export_emails TEXT[] NOT NULL,
       export_frequency TEXT NOT NULL,
       export_created_at TIMESTAMP WITH TIME ZONE
);

COMMIT;
