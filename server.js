require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 5000;

/**
 * ------------------------------------------------------------------
 * Fail fast on missing required env vars.
 *
 * Without this check, a missing JWT_SECRET stays silent until the
 * FIRST login attempt, where jwt.sign() throws the cryptic
 * "secretOrPrivateKey must have a value" — hard to diagnose from a
 * 401 response alone. Checking it here, at boot, gives an
 * immediate, clear error instead:
 *
 *   [server] Missing required .env values: JWT_SECRET
 *   -> Copy .env.example to .env and fill in real values
 *      (JWT_SECRET especially must not be left empty).
 * ------------------------------------------------------------------
 */
const REQUIRED_ENV_VARS = ['JWT_SECRET', 'MONGO_URI'];

const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

if (missingEnvVars.length > 0) {
  console.error(
    `[server] Missing required .env values: ${missingEnvVars.join(', ')}`,
  );
  console.error(
    '[server] Copy .env.example to .env and fill in real values ' +
      '(JWT_SECRET especially must not be left empty).',
  );
  process.exit(1);
}

(async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[server] Wealth backend running on http://localhost:${PORT}`);
  });
})();
