const { seed } = require('./seed');

async function main() {
  const confirmed = process.argv.includes('--yes-seed-demo');
  if (!confirmed) {
    console.error('This command truncates and reseeds demo data.');
    console.error('Run again with: node database/seed-demo.js --yes-seed-demo');
    process.exitCode = 1;
    return;
  }

  await seed();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { main };
