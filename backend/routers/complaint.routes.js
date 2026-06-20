import express from 'express';
import { isAuthenticated } from '../middlewares/authMiddleware.js';
import {
  fileComplaint,
  getMyComplaints,
  getComplaintsAgainstMe,
  deleteComplaint,
  respondToComplaint,
  addComplaintMessage,
  replyToComplaint,
} from '../controllers/Complaint.controller.js';

const router = express.Router();

router.post('/', isAuthenticated, fileComplaint);
router.get('/my', isAuthenticated, getMyComplaints);
router.get('/against-me', isAuthenticated, getComplaintsAgainstMe);
router.post('/:id/respond', isAuthenticated, respondToComplaint);
router.post('/:id/message', isAuthenticated, addComplaintMessage);
router.post('/:id/reply', isAuthenticated, replyToComplaint);
router.delete('/:id', isAuthenticated, deleteComplaint);

export default router;
