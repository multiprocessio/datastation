const React = require('react');
const enzyme = require('enzyme');
const { Dropdown } = require('./Dropdown');

test('dropdown', () => {
  const props = {
    groups: [],
    title: 'My dropdown',
    trigger: () => {},
  };
  const component = enzyme.mount(<Dropdown {...props} />);
});
