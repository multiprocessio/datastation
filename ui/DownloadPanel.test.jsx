const {
  htmlTableFormat,
  csvFormat,
  markdownTableFormat,
} = require('./DownloadPanel');

describe('markdownTableFormat', () => {
  test('basic markdown', () => {
    expect(
      markdownTableFormat(
        [
          { name: 'Kimmy', age: 19 },
          { name: 'Alex', age: 20 },
        ],
        [
          { label: 'Name', field: 'name' },
          { label: 'Age', field: 'age' },
        ]
      ).text
    ).toBe(
      `
| Name  | Age |
| ----- | --- |
| Kimmy | 19  |
| Alex  | 20  |
`.trim()
    );
  });
});

describe('htmlTableFormat', () => {
  test('basic html', () => {
    expect(
      htmlTableFormat(
        [
          { name: 'Kimmy', age: 19 },
          { name: 'Alex', age: 20 },
        ],
        [
          { label: 'Name', field: 'name' },
          { label: 'Age', field: 'age' },
        ]
      ).text
    ).toBe(
      `
<table class="table">
  <thead>
    <tr>
      <th>Name</th>
      <th>Age</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Kimmy</td>
      <td>19</td>
    </tr>
    <tr>
      <td>Alex</td>
      <td>20</td>
    </tr>
  </tbody>
</table>
`.trim()
    );
  });
});

describe('csvTableFormat', () => {
  test('basic csv', () => {
    expect(
      csvFormat(
        [
          { name: 'Kimmy', age: 19 },
          { name: 'Alex', age: 20 },
        ],
        [
          { label: 'Name', field: 'name' },
          { label: 'Age', field: 'age' },
        ]
      ).text
    ).toBe(
      `
Name,Age
Kimmy,19
Alex,20
`.trim()
    );
  });

  test('csv with whitespace and commas', () => {
    expect(
      csvFormat(
        [
          { name: 'Kimmy,', age: '19"' },
          { name: 'Alex', age: ' 20' },
          { name: 'Garbage', age: { x: 12 } },
        ],
        [
          { label: 'Name', field: 'name' },
          { label: ' Age', field: 'age' },
        ]
      ).text
    ).toBe(
      `
Name," Age"
"Kimmy,","19\\""
Alex," 20"
Garbage,"{\\"x\\":12}"
`.trim()
    );
  });
});
