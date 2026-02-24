import express from 'express';
import * as crmController from '../controllers/crmController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// --- Customers ---
router.get('/customers', requireAuth, crmController.listCustomers);
router.post('/customers', requireAuth, crmController.createCustomer);
// Customer sub-routes (before /:id)
router.get('/customers/:id/bookings', requireAuth, crmController.getCustomerBookings);
router.get('/customers/:id/communications', requireAuth, crmController.getCustomerCommunications);
router.get('/customers/:id/surveys', requireAuth, crmController.getCustomerSurveys);
router.get('/customers/:id/tags', requireAuth, crmController.listCustomerTags);
router.post('/customers/:id/tags', requireAuth, crmController.addCustomerTag);
router.delete('/customers/:id/tags/:tagId', requireAuth, crmController.removeCustomerTag);
router.get('/customers/:id', requireAuth, crmController.getCustomer);
router.patch('/customers/:id', requireAuth, crmController.updateCustomer);
router.delete('/customers/:id', requireAuth, crmController.softDeleteCustomer);

// --- Leads ---
router.get('/leads', requireAuth, crmController.listLeads);
router.post('/leads', requireAuth, crmController.createLead);
router.patch('/leads/:id/status', requireAuth, crmController.updateLeadStatus);
router.post('/leads/:id/convert', requireAuth, crmController.convertLeadToBooking);
router.get('/leads/:id', requireAuth, crmController.getLead);
router.patch('/leads/:id', requireAuth, crmController.updateLead);
router.delete('/leads/:id', requireAuth, crmController.deleteLead);

// --- Communication Logs ---
router.get('/communications', requireAuth, crmController.listCommunications);
router.post('/communications', requireAuth, crmController.createCommunication);
router.get('/communications/:id', requireAuth, crmController.getCommunication);
router.patch('/communications/:id', requireAuth, crmController.updateCommunication);
router.delete('/communications/:id', requireAuth, crmController.deleteCommunication);

// --- Surveys ---
router.get('/surveys', requireAuth, crmController.listSurveys);
router.post('/surveys', requireAuth, crmController.createSurvey);
router.get('/surveys/:id', requireAuth, crmController.getSurvey);
router.patch('/surveys/:id', requireAuth, crmController.updateSurvey);
router.delete('/surveys/:id', requireAuth, crmController.deleteSurvey);

// --- Follow-up Sequences ---
router.get('/sequences', requireAuth, crmController.listSequences);
router.post('/sequences', requireAuth, crmController.createSequence);
router.patch('/sequences/:id/status', requireAuth, crmController.updateSequenceStatus);
router.get('/sequences/:id/steps', requireAuth, crmController.listSequenceSteps);
router.post('/sequences/:id/steps', requireAuth, crmController.addSequenceStep);
router.patch('/sequences/:id/steps/:stepId', requireAuth, crmController.updateSequenceStep);
router.delete('/sequences/:id/steps/:stepId', requireAuth, crmController.deleteSequenceStep);
router.get('/sequences/:id', requireAuth, crmController.getSequence);
router.patch('/sequences/:id', requireAuth, crmController.updateSequence);
router.delete('/sequences/:id', requireAuth, crmController.deleteSequence);

export default router;
