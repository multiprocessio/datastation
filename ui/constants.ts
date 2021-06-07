export const APP_NAME = 'datathing';

export let IS_DESKTOP_APP = false;
try {
  IS_DESKTOP_APP = navigator.userAgent.toLowerCase().includes('electron');
} catch (e) {}

// TODO: handle hosted/saas mode
export const MODE = IS_DESKTOP_APP ? 'desktop' : 'demo';

export const DEBUG = true;

export const DEFAULT_PROJECT = {
  projectName: 'Untitled project',
  datasources: [] as any[],
  pages: [
    {
      name: 'Untitled page',
      panels: [
        {
          name: 'Raw Text',
          type: 'literal',
          content: 'name,age\nPhil,12\nJames,17',
          literal: {
            type: 'csv',
          },
        },
        {
          name: 'Display',
          type: 'graph',
          graph: {
            panelSource: 0,
            type: 'bar',
            x: 'name',
            y: {
              field: 'age',
              label: 'Age',
            },
          },
        },
      ],
    },
  ],
  currentPage: 0,
};
