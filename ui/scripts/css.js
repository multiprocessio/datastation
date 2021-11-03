const fs = require('fs');
const { transform } = require('@multiprocess/cssplus');

const input = fs.readFileSync(process.argv[2]).toString();
fs.writeFileSync(process.argv[3], transform(input));
