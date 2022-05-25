import {
  ContentTypeInfo,
  FilePanelInfo,
  GraphPanelInfo,
  ProgramPanelInfo,
  ProjectPage,
  ProjectState,
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
            name: 'sampledata/Hudson_River_Park_Flora_-_Plantings___Beginning_1997.csv',
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
          gpi.graph.ys = [{ field: 'location', label: 'Neighborhood' }];
          gpi.graph.x = 'plants';
          gpi.graph.panelSource = ppi.id;

          page.panels = [fpi, ppi, gpi];

          return new ProjectState(name, [page]);
        },
      },
    ],
  },
  {
    name: 'Working with logs',
    samples: [
      {
        name: 'Analyze nginx logs with SQL',
        project: (name: string) => {
          const page = new ProjectPage('Analyze nginx logs with SQL');

          const fpi = new FilePanelInfo(page.id, {
            panelName: 'Load nginx JSON logs',
            name: 'sampledata/nginx_logs.json',
            contentTypeInfo: new ContentTypeInfo('application/jsonlines'),
          });

          const ppi = new ProgramPanelInfo(page.id, {
            name: 'Most requested path',
            type: 'sql',
            content: `SELECT COUNT(1) requests, url_path(split_part(request, ' ', 1)) path FROM DM_getPanel('Load nginx JSON loads') GROUP BY path ORDER BY requests DESC;`,
          });

          const gpi = new GraphPanelInfo(page.id, {
            name: 'Most requested path graph',
          });
          gpi.graph.ys = [{ field: 'path', label: 'path' }];
          gpi.graph.x = 'requests';
          gpi.graph.panelSource = ppi.id;

          page.panels = [fpi, ppi, gpi];

          return new ProjectState(name, [page]);
        },
      },
    ],
  },
];
