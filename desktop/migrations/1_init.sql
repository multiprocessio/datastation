CREATE TABLE ds_server(
  id TEXT PRIMARY KEY,
  position INTEGER NOT NULL,
  data_json TEXT NOT NULL
) STRICT;

CREATE TABLE ds_connector(
  id TEXT PRIMARY KEY,
  position INTEGER NOT NULL,
  data_json TEXT NOT NULL
) STRICT;

CREATE TABLE ds_page(
  id TEXT PRIMARY KEY,
  position INTEGER NOT NULL,
  data_json TEXT NOT NULL
) STRICT;

CREATE TABLE ds_panel(
  id TEXT PRIMARY KEY,
  position INTEGER NOT NULL,
  data_json TEXT NOT NULL
) STRICT;

CREATE TABLE ds_metadata(
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;
