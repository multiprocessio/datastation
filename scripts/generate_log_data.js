const faker = require('faker');

const data = [];
for (let i = 0; i < 1000; i++) {
  data.push({
    url: faker.image.imageUrl(),
    time: faker.date.past(),
    status: faker.random.number({ min: 200, max: 500 }),
  });
}

console.log(JSON.stringify(data));
