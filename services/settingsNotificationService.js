import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SETTINGS_DIR = path.join(ROOT_DIR, 'data');
const NOTIFICATIONS_FILE = path.join(SETTINGS_DIR, 'notification-preferences.json');

const DEFAULTS = {
  emailOnBooking: true,
  emailOnLead: true,
  emailOnCancellation: true,
  emailOnPayment: true,
  inAppNotifications: true,
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export async function getNotificationPreferences() {
  try {
    ensureDir(SETTINGS_DIR);
    if (fs.existsSync(NOTIFICATIONS_FILE)) {
      const raw = fs.readFileSync(NOTIFICATIONS_FILE, 'utf8');
      const data = JSON.parse(raw);
      return { ...DEFAULTS, ...data };
    }
  } catch (err) {
    console.warn('Could not read notification preferences:', err.message);
  }
  return { ...DEFAULTS };
}

export async function updateNotificationPreferences(data) {
  const current = await getNotificationPreferences();
  const allowed = ['emailOnBooking', 'emailOnLead', 'emailOnCancellation', 'emailOnPayment', 'inAppNotifications'];
  const updated = { ...current };
  for (const key of allowed) {
    if (data[key] !== undefined) {
      updated[key] = data[key] === true || data[key] === 'true';
    }
  }
  ensureDir(SETTINGS_DIR);
  fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}
