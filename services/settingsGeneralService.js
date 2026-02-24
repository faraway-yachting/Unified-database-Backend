import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SETTINGS_DIR = path.join(ROOT_DIR, 'data');
const GENERAL_SETTINGS_FILE = path.join(SETTINGS_DIR, 'general-settings.json');

const DEFAULTS = {
  siteName: process.env.SITE_NAME || 'YachtOS',
  timezone: process.env.TZ || 'UTC',
  defaultCurrency: process.env.DEFAULT_CURRENCY || 'USD',
  supportEmail: process.env.SUPPORT_EMAIL || '',
  language: process.env.LANGUAGE || 'en',
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export async function getGeneralSettings() {
  try {
    ensureDir(SETTINGS_DIR);
    if (fs.existsSync(GENERAL_SETTINGS_FILE)) {
      const raw = fs.readFileSync(GENERAL_SETTINGS_FILE, 'utf8');
      const data = JSON.parse(raw);
      return { ...DEFAULTS, ...data };
    }
  } catch (err) {
    console.warn('Could not read general settings file:', err.message);
  }
  return { ...DEFAULTS };
}

export async function updateGeneralSettings(data) {
  const current = await getGeneralSettings();
  const allowed = ['siteName', 'timezone', 'defaultCurrency', 'supportEmail', 'language'];
  const updated = { ...current };
  for (const key of allowed) {
    if (data[key] !== undefined) {
      updated[key] = typeof data[key] === 'string' ? data[key].trim() : data[key];
    }
  }
  ensureDir(SETTINGS_DIR);
  fs.writeFileSync(GENERAL_SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}
