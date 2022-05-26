const React = require('react');
const enzyme = require('enzyme');
const { Help } = require('./Help');

test('help page', () => {
  const component = enzyme.mount(<Help />);
});
