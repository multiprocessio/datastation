BEGIN;

CREATE TABLE projects (
       project_name TEXT PRIMARY KEY,
       project_value JSONB NOT NULL,
       project_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE migrations (
       migration_name TEXT PRIMARY KEY,
       migration_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMIT;
