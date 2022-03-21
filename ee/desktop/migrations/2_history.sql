-- Copyright 2022 Multiprocess Labs LLC

CREATE TABLE ds_history(
  id TEXT PRIMARY KEY,
  table TEXT NOT NULL,
  column TEXT NOT NULL,
  pk TEXT NOT NULL, -- Primary key **value** of the row being edited in the table being edited
  dt TEXT NOT NULL,
  old_value TEXT NOT NULL,
  new_value TEXT NOT NULL,
  FOREIGN KEY (id) REFERENCES ds_user(id)
) STRICT;

CREATE INDEX ds_history_foreign_pk ON ds_history(pk);
