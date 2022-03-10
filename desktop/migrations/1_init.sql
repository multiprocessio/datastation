CREATE TABLE ds_server(
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  order INTEGER NOT NULL,
  address TEXT NOT NULL,
  port INTEGER NOT NULL,
  type TEXT NOT NULL,
  username TEXT NOT NULL,
  password_encrypt TEXT NOT NULL,
  private_key_file TEXT NOT NULL,
  passphrase_encrypt TEXT NOT NULL,
) STRICT;

CREATE TABLE ds_connector(
  id TEXT NOT NULL PRIMARY KEY,
  order INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL
  server_id TEXT, -- Can be null
  database_type TEXT NOT NULL,
  database_database TEXT NOT NULL,
  database_username TEXT NOT NULL,
  database_password_encrypt TEXT NOT NULL,
  database_address TEXT NOT NULL,
  database_apiKey_encrypt TEXT NOT NULL,
  database_extra TEXT NOT NULL,
  FOREIGN KEY (server_id) REFERENCES ds_server(id)
) STRICT;

CREATE TABLE ds_page(
  id TEXT PRIMARY KEY,
  order INTEGER NOT NULL,
  name TEXT NOT NULL,
  visibility TEXT NOT NULL,
  refresh_period INTEGER
) STRICT;

CREATE TABLE ds_scheduled_export(
  id TEXT PRIMARY KEY,
  order INTEGER NOT NULL,
  period TEXT NOT NULL,
  name TEXT NOT NULL,
  destination_type TEXT NOT NULL,
  destination_from TEXT NOT NULL,
  destination_recipients TEXT NOT NULL,
  destination_server TEXT NOT NULL,
  destination_username TEXT NOT NULL,
  destination_password_encrypt TEXT
) STRICT;

CREATE TABLE ds_page_scheduled_exports(
  schedule_export_id TEXT NOT NULL,
  panel_id TEXT NOT NULL,
  FOREIGN KEY (schedule_id) REFERENCES ds_scheduled_export(id),
  FOREIGN KEY (panel_id) REFERENCES ds_panel(id)
) STRICT;

CREATE TABLE ds_panel(
  id TEXT PRIMARY KEY,
  order INTEGER NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  server_id TEXT NOT NULL,
  result_meta TEXT NOT NULL,
  last_edited TEXT NOT NULL,
  program_type TEXT NOT NULL,
  graph_panel_source TEXT NOT NULL,
  graph_ys TEXT NOT NULL,
  graph_x TEXT NOT NULL,
  graph_unique_by TEXT NOT NULL,
  graph_type TEXT NOT NULL,
  graph_width TEXT NOT NULL,
  colors_unique TEXT NOT NULL,
  database_connector_id TEXT, -- Can be null
  database_range TEXT NOT NULL,
  database_table TEXT NOT NULL,
  database_step INTEGER NOT NULL,
  database_extra TEXT NOT NULL,
  http_headers TEXT NOT NULL,
  http_url TEXT NOT NULL,
  http_method TEXT NOT NULL,
  http_content_type_info TEXT NOT NULL,
  table_columns TEXT NOT NULL,
  table_panel_source TEXT NOT NULL,
  table_width TEXT NOT NULL,
  table_row_numbers TEXT NOT NULL,
  filagg_panel_source TEXT NOT NULL,
  filagg_filter TEXT NOT NULL,
  filagg_range TEXT NOT NULL,
  filagg_aggregate_type TEXT NOT NULL,
  filagg_group_by TEXT NOT NULL,
  filagg_aggregate_on TEXT NOT NULL,
  filagg_sort_on TEXT NOT NULL,
  filagg_sort_asc TEXT NOT NULL,
  filagg_window_interval TEXT NOT NULL,
  filagg_limit INTEGER NOT NULL,
  file_content_type_info TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_content TEXT NOT NULL,
  literal_content_type_info TEXT NOT NULL,
  result_exception TEXT NOT NULL,
  result_preview TEXT NOT NULL,
  result_stdout TEXT NOT NULL,
  result_shape TEXT NOT NULL,
  result_array_count INTEGER NOT NULL,
  result_size INTEGER NOT NULL,
  result_content_type TEXT NOT NULL,
  result_elapsed REAL NOT NULL,
  result_last_run INTEGER NOT NULL,
) STRICT;

CREATE TABLE ds_page_panels(
  page_id TEXT NOT NULL,
  panel_id TEXT NOT NULL,
  FOREIGN KEY (page_id) REFERENCES ds_page(id),
  FOREIGN KEY (panel_id) REFERENCES ds_panel(id)
) STRICT;
