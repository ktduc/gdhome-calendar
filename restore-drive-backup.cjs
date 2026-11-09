const {restoreSnapshot} = require('./backup-snapshot');

async function main() {
  const [file,email,...flags] = process.argv.slice(2);
  if (!file || !/^[^\s@]+@[^\s@]+$/.test(email || '') || flags.some(flag => !['--apply','--allow-missing'].includes(flag))) {
    throw new Error('Cách dùng: node restore-drive-backup.cjs <ban-sao.ndjson.gz> <email> [--apply] [--allow-missing]');
  }
  const apply = flags.includes('--apply');
  const store = apply ? await require('./server').initStore() : undefined;
  const snapshot = await restoreSnapshot(file,{store,account:email.toLowerCase(),dataDir:process.env.DATA_DIR || __dirname,
    apply,allowMissing:flags.includes('--allow-missing')});
  console.log(JSON.stringify({restored:apply,createdAt:snapshot.createdAt,files:snapshot.files,missing:snapshot.missing},null,2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
