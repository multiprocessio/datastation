const React = require('react');
const { act } = require('react-dom/test-utils');
const enzyme = require('enzyme');
const { LiteralPanelInfo } = require('../../shared/state');
const {
  LiteralPanel,
  LiteralPanelDetails,
  LiteralPanelBody,
} = require('./LiteralPanel');

test('shows literal panel details', async () => {
  const panel = new LiteralPanelInfo();
  const component = enzyme.mount(
    <LiteralPanelDetails
      panel={panel}
      panels={[panel]}
      updatePanel={() => {}}
    />
  );
  await componentLoad(component);
});

test('shows literal panel body', async () => {
  const panel = new LiteralPanelInfo();

  const component = enzyme.mount(
    <LiteralPanelBody
      panel={panel}
      panels={[panel]}
      updatePanel={jest.fn()}
      keyboardShortcuts={jest.fn()}
    />
  );
  await componentLoad(component);
});
