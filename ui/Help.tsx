import * as React from 'react';
import { DOCS_ROOT, SITE_ROOT } from '../shared/constants';

const tutorials = [
  {
    link: SITE_ROOT + '/docs/tutorials/Query_PostgreSQL_with_DataStation.html',
    name: 'Query PostgreSQL with DataStation',
  },
  {
    link: SITE_ROOT + '/docs/tutorials/Query_MySQL_with_DataStation.html',
    name: 'Query MySQL with DataStation',
  },
  {
    link: SITE_ROOT + '/docs/tutorials/Query_SQLite_with_DataStation.html',
    name: 'Query SQLite with DataStation',
  },
  {
    link: SITE_ROOT + '/docs/tutorials/Query_Oracle_with_DataStation.html',
    name: 'Query Oracle with DataStation',
  },
  {
    link: SITE_ROOT + '/docs/tutorials/Query_SQL_Server_with_DataStation.html',
    name: 'Query SQL Server with DataStation',
  },
  {
    link: SITE_ROOT + '/docs/tutorials/Query_CockroachDB_with_DataStation.html',
    name: 'Query CockroachDB with DataStation',
  },
  {
    link: SITE_ROOT + '/docs/tutorials/Query_AWS_Athena_with_DataStation.html',
    name: 'Query AWS Athena with DataStation',
  },
  {
    link: SITE_ROOT + '/docs/tutorials/Query_BigQuery_with_DataStation.html',
    name: 'Query BigQuery with DataStation',
  },
  {
    link:
      SITE_ROOT + '/docs/tutorials/Query_Elasticsearch_with_DataStation.html',
    name: 'Query Elasticsearch with DataStation',
  },
  {
    link: SITE_ROOT + '/docs/tutorials/Query_Airtable_with_DataStation.html',
    name: 'Query Airtable with DataStation',
  },
  {
    link: SITE_ROOT + '/docs/tutorials/Query_Scylla_with_DataStation.html',
    name: 'Query Scylla with DataStation',
  },
  {
    link:
      SITE_ROOT +
      '/docs/tutorials/Query_Influx_(2.x)_with_DataStation_(Flux).html',
    name: 'Query Influx 2.x (Flux) with DataStation',
  },
  {
    link:
      SITE_ROOT +
      '/docs/tutorials/Query_Influx_(1.x)_with_DataStation_(InfluxQL).html',
    name: 'Query Influx 1.x (InfluxQL) with DataStation',
  },
];

const videos = [
  {
    link: 'https://www.youtube.com/watch?v=tIh99YVHoRE',
    name: 'Customer API usage stats from Elasticsearch data filtered on customer metadata stored in PostgreSQL',
  },
  {
    link: 'https://www.youtube.com/watch?v=q_jRBvbwIzU',
    name: 'Using Pandas in DataStation to explore employee data in CockroachDB',
  },
  {
    link: 'https://www.youtube.com/watch?v=sCx2mF2jyUQ',
    name: 'Nginx access log exploration with DataStation 0.1.0',
  },
  {
    link: 'https://www.youtube.com/watch?v=GnJP0zPMlek',
    name: 'Graphing Top Referring Domains from Nginx Access Logs using DataStation',
  },
  {
    link: 'https://www.youtube.com/watch?v=C-4YKFq0h9Q',
    name: 'Getting Started With DataStation for Exploring Your Data',
  },
  {
    link: 'https://www.youtube.com/watch?v=iKryzvyvHYw',
    name: 'Making an HTTP request for CSVs and joining the results with SQL in DataStation',
  },
  {
    link: 'https://www.youtube.com/watch?v=_7LEV3ZeQWU',
    name: 'Visualization and SQL manipulation of CSVs with DataStation',
  },
];

const reference = [
  {
    link: DOCS_ROOT + '/Panels/Database_Panels.html',
    name: 'Database Panels',
  },
  {
    link: DOCS_ROOT + '/Panels/Code_Panels.html',
    name: 'Code Panels',
  },
  {
    link: DOCS_ROOT + '/Panels/HTTP_Panels.html',
    name: 'HTTP Panels',
  },
  {
    link: DOCS_ROOT + '/Panels/File_Panels.html',
    name: 'File Panels',
  },
  {
    link: DOCS_ROOT + '/Data_Sources.html',
    name: 'Data Sources',
  },
  {
    link: DOCS_ROOT + '/SSH_Connections.html',
    name: 'SSH Connections',
  },
  {
    link: DOCS_ROOT + '/Panels/Macros.html',
    name: 'Macros',
  },
];

export function Help() {
  return (
    <div className="main-body">
      <div className="card settings">
        <h1>Help</h1>
        Contents
        <ul>
          <li>
            <a href="#tutorials">Tutorials</a>
          </li>
          <li>
            <a href="#video-library">Video Library</a>
          </li>
          <li>
            <a href="#reference">Reference</a>
          </li>
        </ul>
        <h2 id="tutorials">Tutorials</h2>
        <ul>
          {tutorials.map((t) => (
            <li key={t.link}>
              <a target="_blank" href={t.link}>
                {t.name}
              </a>
            </li>
          ))}
        </ul>
        <h2 id="video-library">Video library</h2>
        <ul>
          {videos.map((t) => (
            <li key={t.link}>
              <a target="_blank" href={t.link}>
                {t.name}
              </a>
            </li>
          ))}
        </ul>
        <h2 id="reference">Reference</h2>
        <ul>
          {reference.map((t) => (
            <li key={t.link}>
              <a target="_blank" href={t.link}>
                {t.name}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
