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
  data_json TEXT NOT NULL,
  page_id TEXT NOT NULL,
  FOREIGN KEY (page_id) REFERENCES ds_page(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE ds_result(
  panel_id TEXT NOT NULL,
  created_at INTEGER NOT NULL, -- UNIX timestamp
  data_json TEXT NOT NULL,
  FOREIGN KEY (panel_id) REFERENCES ds_panel(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE ds_metadata(
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

CREATE TABLE ds_dashboard(
  id TEXT PRIMARY KEY,
  position INTEGER NOT NULL,
  data_json TEXT NOT NULL,
) STRICT;

CREATE TABLE ds_dashboard_panel(
  panel_id TEXT NOT NULL,
  dashboard_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  data_json TEXT NOT NULL,
  FOREIGN KEY (panel_id) REFERENCES ds_panel(id) ON DELETE CASCADE,
  FOREIGN KEY (dashboard_id) REFERENCES ds_dashboard(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE ds_destination(
  id TEXT PRIMARY KEY,
  position INTEGER NOT NULL,
  data_json TEXT NOT NULL
);

CREATE TABLE ds_export(
  id TEXT NOT NULL,
  dashboard_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  data_json TEXT NOT NULL,
  FOREIGN KEY (dashboard_id) REFERENCES ds_dashboard(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE ds_export_destination (
  destination_id TEXT NOT NULL,
  export_id TEXT NOT NULL,
  FOREIGN KEY (export_id) REFERENCES ds_panel(id) ON DELETE CASCADE,
  FOREIGN KEY (destination_id) REFERENCES ds_dashboard(id) ON DELETE CASCADE
)
