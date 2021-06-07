import lmdb from 'lmdb-store';

export class DesktopStore {
  constructor(ipcMain) {
    this.ipcMain = ipcMain;
  }

  register() {
    this.ipcMain.on('updateProjectState', (e, [projectId, newState]) => {
      this.update(projectId, newState);
    });

    this.ipcMain.on('getProjectState', (e, [projectId]) => {
      event.sender.send('receiveProjectState', this.get(projectId));
    });
  }

  #withStore(projectId: string, cb: (any) => any) {
    const store = lmdb.open({
      path: `projects/${projectId}.project`,
      compression: true,
    });

    try {
      return cb(store);
    } finally {
      store.close();
    }
  }

  update(projectId: string, newState: any) {
    this.withStore(projectId, (store: any) => {
      store.put('projectState', newState);
    });
  }

  get(projectId: string) {
    return this.withStore(
      projectId,
      (store: any) => store.get('projectState') || DEFAULT_PROJECT
    );
  }
}
