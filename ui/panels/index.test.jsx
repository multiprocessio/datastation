const { PANEL_UI_DETAILS } = require('./index');

for (const [panelType, info] of Object.entries(PANEL_UI_DETAILS)) {
  test(panelType + ' factory', () => {
    const p = info.factory(12, 'my great panel');
    expect(p.pageId).toBe(12);
    expect(p.name).toBe('my great panel');
  });
}
