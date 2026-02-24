import * as settingsGeneralService from '../services/settingsGeneralService.js';
import * as adminUserService from '../services/adminUserService.js';
import * as emailTemplateService from '../services/emailTemplateService.js';
import * as settingsNotificationService from '../services/settingsNotificationService.js';
import * as settingsIntegrationService from '../services/settingsIntegrationService.js';
import * as auditLogService from '../services/auditLogService.js';

// --- General ---
export async function getGeneralSettings(req, res, next) {
  try {
    const settings = await settingsGeneralService.getGeneralSettings();
    res.status(200).json(settings);
  } catch (err) {
    next(err);
  }
}

export async function updateGeneralSettings(req, res, next) {
  try {
    const settings = await settingsGeneralService.updateGeneralSettings(req.body);
    res.status(200).json(settings);
  } catch (err) {
    next(err);
  }
}

// --- Admin Users ---
export async function listAdminUsers(req, res, next) {
  try {
    const { role, isActive, page, limit } = req.query;
    const result = await adminUserService.listAdminUsers({
      role,
      isActive,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getAdminUser(req, res, next) {
  try {
    const user = await adminUserService.getAdminUserById(req.params.id);
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
}

export async function createAdminUser(req, res, next) {
  try {
    const user = await adminUserService.createAdminUser(req.body);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

export async function updateAdminUser(req, res, next) {
  try {
    const user = await adminUserService.updateAdminUser(req.params.id, req.body);
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
}

export async function deactivateAdminUser(req, res, next) {
  try {
    const user = await adminUserService.deactivateAdminUser(req.params.id);
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
}

export async function updateAdminUserRole(req, res, next) {
  try {
    const user = await adminUserService.updateAdminUserRole(req.params.id, req.body);
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
}

export async function updateAdminUserRegions(req, res, next) {
  try {
    const user = await adminUserService.updateAdminUserRegions(req.params.id, req.body);
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
}

// --- Email Templates ---
export async function listEmailTemplates(req, res, next) {
  try {
    const { type, isActive, page, limit } = req.query;
    const result = await emailTemplateService.listEmailTemplates({
      type,
      isActive,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getEmailTemplate(req, res, next) {
  try {
    const template = await emailTemplateService.getEmailTemplateById(req.params.id);
    res.status(200).json(template);
  } catch (err) {
    next(err);
  }
}

export async function createEmailTemplate(req, res, next) {
  try {
    const template = await emailTemplateService.createEmailTemplate(req.body);
    res.status(201).json(template);
  } catch (err) {
    next(err);
  }
}

export async function updateEmailTemplate(req, res, next) {
  try {
    const template = await emailTemplateService.updateEmailTemplate(req.params.id, req.body);
    res.status(200).json(template);
  } catch (err) {
    next(err);
  }
}

export async function deleteEmailTemplate(req, res, next) {
  try {
    await emailTemplateService.deleteEmailTemplate(req.params.id);
    res.status(200).json({ message: 'Email template deleted' });
  } catch (err) {
    next(err);
  }
}

export async function sendTestEmail(req, res, next) {
  try {
    const { to } = req.body || {};
    const result = await emailTemplateService.sendTestEmail(req.params.id, to || req.user?.email);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// --- Notifications ---
export async function getNotificationPreferences(req, res, next) {
  try {
    const preferences = await settingsNotificationService.getNotificationPreferences();
    res.status(200).json(preferences);
  } catch (err) {
    next(err);
  }
}

export async function updateNotificationPreferences(req, res, next) {
  try {
    const preferences = await settingsNotificationService.updateNotificationPreferences(req.body);
    res.status(200).json(preferences);
  } catch (err) {
    next(err);
  }
}

// --- Integrations ---
export async function listIntegrations(req, res, next) {
  try {
    const result = await settingsIntegrationService.listIntegrations();
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateIntegration(req, res, next) {
  try {
    const result = await settingsIntegrationService.updateIntegration(req.params.key, req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function disconnectIntegration(req, res, next) {
  try {
    const result = await settingsIntegrationService.disconnectIntegration(req.params.key);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// --- Audit Log ---
export async function listAuditLogs(req, res, next) {
  try {
    const { user, action, module, from, to, page, limit } = req.query;
    const result = await auditLogService.listAuditLogs({
      user,
      action,
      module,
      from,
      to,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getAuditLog(req, res, next) {
  try {
    const log = await auditLogService.getAuditLogById(req.params.id);
    res.status(200).json(log);
  } catch (err) {
    next(err);
  }
}
