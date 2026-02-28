import express from 'express';
import * as bookingController from '../controllers/bookingController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Calendar and availability (must be before /)
router.get('/calendar', requireAuth, bookingController.getCalendarView);
router.get('/availability', requireAuth, bookingController.checkAvailability);
router.get('/upcoming', requireAuth, bookingController.getUpcomingBookings);

router.get('/', requireAuth, bookingController.listBookings);
router.post('/', requireAuth, bookingController.createBooking);
// Status and action routes (must be before /:id)
router.patch('/:id/status', requireAuth, bookingController.updateBookingStatus);
router.post('/:id/confirm', requireAuth, bookingController.confirmBooking);
router.post('/:id/cancel', requireAuth, bookingController.cancelBookingPost);
router.post('/:id/complete', requireAuth, bookingController.completeBooking);
// Documents and emails (must be before /:id)
router.get('/:id/invoice', requireAuth, bookingController.getInvoice);
router.post('/:id/send-confirmation', requireAuth, bookingController.sendConfirmation);
router.post('/:id/send-reminder', requireAuth, bookingController.sendReminder);
// Add-ons and payments (must be before /:id)
router.get('/:id/addons', requireAuth, bookingController.listBookingAddons);
router.post('/:id/addons', requireAuth, bookingController.addAddonToBooking);
router.delete('/:id/addons/:addonId', requireAuth, bookingController.removeAddonFromBooking);
router.get('/:id/payments', requireAuth, bookingController.listPayments);
router.post('/:id/payments', requireAuth, bookingController.recordPayment);
router.patch('/:id/payments/:paymentId', requireAuth, bookingController.updatePayment);
router.post('/:id/payments/:paymentId/refund', requireAuth, bookingController.processRefund);
router.get('/:id', requireAuth, bookingController.getBookingById);
router.patch('/:id', requireAuth, bookingController.updateBooking);
router.delete('/:id', requireAuth, bookingController.cancelBooking);

export default router;
