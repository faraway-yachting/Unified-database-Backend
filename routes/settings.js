import express from 'express';
import * as settingsController from '../controllers/settingsController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// --- General ---
router.get('/general', requireAuth, settingsController.getGeneralSettings);
router.patch('/general', requireAuth, settingsController.updateGeneralSettings);

// --- Admin Users ---
router.get('/users', requireAuth, settingsController.listAdminUsers);
router.post('/users', requireAuth, settingsController.createAdminUser);
router.patch('/users/:id/role', requireAuth, settingsController.updateAdminUserRole);
router.patch('/users/:id/regions', requireAuth, settingsController.updateAdminUserRegions);
router.get('/users/:id', requireAuth, settingsController.getAdminUser);
router.patch('/users/:id', requireAuth, settingsController.updateAdminUser);
router.delete('/users/:id', requireAuth, settingsController.deactivateAdminUser);

// --- Email Templates ---
router.get('/email-templates', requireAuth, settingsController.listEmailTemplates);
router.post('/email-templates', requireAuth, settingsController.createEmailTemplate);
router.post('/email-templates/:id/test', requireAuth, settingsController.sendTestEmail);
router.get('/email-templates/:id', requireAuth, settingsController.getEmailTemplate);
router.patch('/email-templates/:id', requireAuth, settingsController.updateEmailTemplate);
router.delete('/email-templates/:id', requireAuth, settingsController.deleteEmailTemplate);

// --- Notifications ---
router.get('/notifications', requireAuth, settingsController.getNotificationPreferences);
router.patch('/notifications', requireAuth, settingsController.updateNotificationPreferences);

// --- Integrations ---
router.get('/integrations', requireAuth, settingsController.listIntegrations);
router.patch('/integrations/:key', requireAuth, settingsController.updateIntegration);
router.delete('/integrations/:key', requireAuth, settingsController.disconnectIntegration);

// --- Audit Log ---
router.get('/audit-logs', requireAuth, settingsController.listAuditLogs);
router.get('/audit-logs/:id', requireAuth, settingsController.getAuditLog);

export default router;
