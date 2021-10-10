const fs = require('fs');
const faker = require('faker');
const XLSX = require('xlsx');
const CSV = require('papaparse');
const parquet = require('parquetjs-lite');

const data = [];
for (let i = 0; i < 1000; i++) {
  data.push({
    name: faker.name.findName(),
    phone: faker.phone.phoneNumber(),
    email: faker.internet.email(),
    street: faker.address.streetAddress(),
    city: faker.address.city(),
    state: faker.address.state(),
    zipCode: faker.address.zipCode(),
    routingNumber: faker.finance.routingNumber(),
    department: faker.commerce.department(),
    company: faker.company.companyName(),
    createdAt: faker.date.past(),
    profilePhoto: faker.image.imageUrl(),
    description: faker.lorem.paragraph(),
    activated: faker.datatype.boolean(),
  });
}
console.log(`Generated ${data.length} test data rows`);

const directory = 'testdata/';

async function write() {
  // Write as CSV
  const csvname = directory + 'userdata.csv';
  fs.writeFileSync(csvname, CSV.unparse(data));
  console.log(`Wrote ${csvname}`);

  // Write as Excel file
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet 1');
  const excelname = directory + 'userdata.xlsx';
  XLSX.writeFile(wb, excelname);
  console.log(`Wrote ${excelname}`);

  // Write as parquet file
  const schema = new parquet.ParquetSchema({
    name: { type: 'UTF8' },
    phone: { type: 'UTF8' },
    email: { type: 'UTF8' },
    street: { type: 'UTF8' },
    city: { type: 'UTF8' },
    state: { type: 'UTF8' },
    zipCode: { type: 'UTF8' },
    routingNumber: { type: 'INT64' },
    department: { type: 'UTF8' },
    company: { type: 'UTF8' },
    createdAt: { type: 'TIMESTAMP_MILLIS' },
    profilePhoto: { type: 'UTF8' },
    description: { type: 'UTF8' },
    activated: { type: 'BOOLEAN' },
  });
  const parquetname = directory + 'userdata.parquet';
  const writer = await parquet.ParquetWriter.openFile(schema, parquetname);
  for (const row of data) {
    await writer.appendRow(row);
  }
  await writer.close();
  console.log(`Wrote ${parquetname}`);
}

write();
