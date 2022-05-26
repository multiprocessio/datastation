const React = require('react');
const enzyme = require('enzyme');
const { Datetime } = require('./Datetime');

test('datetime', () => {
  const props = {
    value: new Date(),
    onChange: () => {},
    label: 'My datetime',
  };
  const component = enzyme.mount(<Datetime {...props} />);
});
