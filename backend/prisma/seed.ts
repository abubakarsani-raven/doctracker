/**
 * Local Prisma seed entry — delegates to the compiled-friendly module.
 *
 * Run after migrate reset: `npm run prisma:seed`
 * On Railway deploy the same logic runs as: `node dist/seed/run-seed.js`
 */
import { runSeed } from '../src/seed/run-seed';

runSeed().catch((error) => {
  console.error('\n❌ Seed failed:');
  console.error(error);
  process.exit(1);
});
