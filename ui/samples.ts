import {
  ContentTypeInfo,
  DatabaseConnectorInfo,
  DatabasePanelInfo,
  FilePanelInfo,
  GraphPanelInfo,
  ProgramPanelInfo,
  ProjectPage,
  ProjectState,
  TablePanelInfo,
} from '../shared/state';

export const SAMPLES = [
  {
    name: 'Working with files',
    samples: [
      {
        name: 'Query plant CSV data with SQL',
        project: (name: string) => {
          const page = new ProjectPage('Query plant CSV data with SQL');

          const fpi = new FilePanelInfo(page.id, {
            panelName: 'Load plant data',
            name: 'sampledata/Hudson_River_Park_Flora_-_Plantings___1997_-_2015.csv',
            contentTypeInfo: new ContentTypeInfo('text/csv'),
          });

          const ppi = new ProgramPanelInfo(page.id, {
            name: 'Neighborhood by plant installations',
            type: 'sql',
            content: `SELECT COUNT(1) plants, location FROM DM_getPanel('Load plant data') GROUP BY location ORDER BY plants DESC;`,
          });

          const gpi = new GraphPanelInfo(page.id, {
            name: 'Neighborhoods by plant installations graph',
          });
          gpi.graph.ys = [{ field: 'plants', label: 'Plants' }];
          gpi.graph.x = 'location';
          gpi.graph.panelSource = ppi.id;

          page.panels = [fpi, ppi, gpi];

          return new ProjectState(name, [page]);
        },
      },
      {
        name: 'Analyze JSON nginx logs with SQL',
        project: (name: string) => {
          const page = new ProjectPage('Analyze JSON nginx logs with SQL');

          const fpi = new FilePanelInfo(page.id, {
            panelName: 'Load JSON nginx logs',
            name: 'sampledata/nginx_logs.jsonl',
            contentTypeInfo: new ContentTypeInfo('application/jsonlines'),
          });

          const ppi = new ProgramPanelInfo(page.id, {
            name: 'Most requested path',
            type: 'sql',
            content: `SELECT COUNT(1) requests, url_path(split_part(request, ' ', 1)) path FROM DM_getPanel('Load JSON nginx logs') GROUP BY path ORDER BY requests DESC;`,
          });

          const gpi = new GraphPanelInfo(page.id, {
            name: 'Most requested path graph',
          });
          gpi.graph.ys = [{ field: 'requests', label: 'Requests' }];
          gpi.graph.x = 'path';
          gpi.graph.panelSource = ppi.id;

          page.panels = [fpi, ppi, gpi];

          return new ProjectState(name, [page]);
        },
      },
    ],
  },
  {
    name: 'Working with databases',
    samples: [
      {
        name: 'Analyze Washington State internet download speeds from SQLite',
        project: (name: string) => {
          const page = new ProjectPage(
            'Analyze Washington State internet download speeds from SQLite'
          );

          const db = new DatabaseConnectorInfo({
	    name: 'Speedtest database',
            type: 'sqlite',
            database: 'sampledata/speedtests.db',
          });

          const dpi = new DatabasePanelInfo(page.id, {
            name: 'Upload, download analysis',
            connectorId: db.id,
            content:
              'SELECT AVG(downloadsp) download_avg, STDDEV(downloadsp) download_std, AVG(uploadspee) upload_avg, STDDEV(uploadspee) upload_std FROM speedtests',
          });

          const tpi = new TablePanelInfo(page.id, {
            name: 'Upload, download analysis view',
          });
          tpi.table.columns = [
            { field: 'download_avg', label: 'Download (Average)' },
            { field: 'download_std', label: 'Download (Stddev)' },
            { field: 'upload_avg', label: 'Upload (Average)' },
            { field: 'upload_std', label: 'Upload (Stddev)' },
          ];
          tpi.table.panelSource = dpi.id;

          page.panels = [dpi, tpi];

          const p = new ProjectState(name, [page]);
          p.connectors = [db];
          return p;
        },
      },
    ],
  },
];
