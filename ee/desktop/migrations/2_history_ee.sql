-- Copyright 2022 Multiprocess Labs LLC

CREATE TABLE ds_user(
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
) STRICT;

CREATE TABLE ds_history(
  id TEXT PRIMARY KEY,
  tbl TEXT NOT NULL,
  pk TEXT NOT NULL, -- Primary key **value** of the row being edited in the table being edited
  dt INTEGER NOT NULL, -- UNIX timestamp
  error TEXT NOT NULL,
  old_value TEXT NOT NULL,
  new_value TEXT NOT NULL,
  user_id TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES ds_user(id)
) STRICT;

CREATE INDEX ds_history_foreign_pk ON ds_history(pk);
CREATE INDEX ds_history_dt_idx ON ds_history(dt);
