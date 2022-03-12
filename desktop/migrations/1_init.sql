CREATE TABLE ds_server(
  id TEXT PRIMARY KEY,
  position INTEGER NOT NULL,
  data_json TEXT NOT NULL,
) STRICT;

CREATE TABLE ds_connector(
  id TEXT NOT NULL PRIMARY KEY,
  position INTEGER NOT NULL,
  data_json TEXT NOT NULL,
  FOREIGN KEY (server_id) REFERENCES ds_server(id)
) STRICT;

CREATE TABLE ds_page(
  id TEXT PRIMARY KEY,
  position INTEGER NOT NULL,
  data_json TEXT NOT NULL,
) STRICT;

CREATE TABLE ds_panel(
  id TEXT PRIMARY KEY,
  position INTEGER NOT NULL,
  data_json TEXT NOT NULL,
) STRICT;

CREATE TABLE ds_page_panels(
  page_id TEXT NOT NULL,
  panel_id TEXT NOT NULL,
  FOREIGN KEY (page_id) REFERENCES ds_page(id),
  FOREIGN KEY (panel_id) REFERENCES ds_panel(id)
) STRICT;

CREATE TABLE ds_metadata(
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
