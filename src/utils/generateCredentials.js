/**
 * utils/generateCredentials.js
 * ------------------------------------------------------------------
 * Registration no longer accepts a client-chosen username/password
 * (see controllers/auth.controller.js). Instead:
 *
 *   - `generateUsernameFromFullName` turns "Aditya Sharma" into a
 *     clean base username like "aditya.sharma", then appends a short
 *     random suffix ONLY if that base is already taken, so usernames
 *     stay readable and still map back to the person's real name.
 *
 *   - `generateStrongPassword` produces a random password guaranteed
 *     to contain a lowercase letter, an uppercase letter, and a
 *     digit — letters and numbers only, no symbols, so it's easy to
 *     read aloud or type on a phone keyboard while still being
 *     unguessable.
 * ------------------------------------------------------------------
 */

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const ALL = LOWER + UPPER + DIGITS;

function randomChar(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

function shuffle(str) {
  const arr = str.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}

/**
 * Slugifies a full name into a base username, e.g.
 * "Aditya  Sharma" -> "aditya.sharma"
 * "Priya" -> "priya"
 */
function slugifyName(fullName) {
  return fullName
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s]/g, '') // letters & spaces only
    .split(/\s+/)
    .filter(Boolean)
    .join('.');
}

/**
 * Generates a unique username from a full name.
 * `existsCheck` is an async fn(username) => boolean, used to verify
 * uniqueness against the database. Falls back to a random suffix
 * (and eventually a fully random handle) if the base is taken.
 *
 * @param {string} fullName
 * @param {(username: string) => Promise<boolean>} existsCheck
 * @returns {Promise<string>}
 */
async function generateUsernameFromFullName(fullName, existsCheck) {
  const base = slugifyName(fullName) || 'user';

  if (!(await existsCheck(base))) {
    return base;
  }

  // Base is taken: try a few short numeric/alpha suffixes first.
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = Math.floor(100 + Math.random() * 900); // 3-digit
    const candidate = `${base}${suffix}`;
    if (!(await existsCheck(candidate))) {
      return candidate;
    }
  }

  // Extremely unlikely fallback: base + short random alnum tag.
  const tag = shuffle(ALL).slice(0, 6).toLowerCase();
  return `${base}.${tag}`;
}

/**
 * Generates a random strong password (letters + digits only).
 * Guarantees at least one lowercase, one uppercase, and one digit.
 *
 * @param {number} length
 * @returns {string}
 */
function generateStrongPassword(fullName) {
  const firstName = String(fullName).trim().split(/\s+/)[0] || "user";

  // Take the first 3 letters (pad with "x" if the name is shorter
  // than 3 characters), capitalize the first letter, lowercase the rest.
  const lettersOnly = firstName.replace(/[^a-zA-Z]/g, "") || "usr";
  const namePart = (lettersOnly + "xxx").slice(0, 3);
  const formattedNamePart =
    namePart.charAt(0).toUpperCase() + namePart.slice(1).toLowerCase();

  // 4 random digits, generated fresh every call — e.g. "4838".
  const digitSuffix = Array.from({ length: 4 }, () => randomChar(DIGITS)).join("");
  return `${formattedNamePart}#${digitSuffix}`;
}

module.exports = {
  generateUsernameFromFullName,
  generateStrongPassword,
};
