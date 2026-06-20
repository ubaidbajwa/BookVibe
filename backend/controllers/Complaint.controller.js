import fs from 'fs';
import Complaint from '../models/Complaintmodel.js';
import User from '../models/UserAndHostModel.js';
import BookingModel from '../models/BookingModel.js';
import PropertyModel from '../models/PropertyModel.js';
import cloudinary from '../middlewares/cloudinary.js';
import { notifyAdmin, notifyUser } from '../utils/notificationHelper.js';
import notificationService from '../services/notification.service.js';

const uploadComplaintEvidence = async (filesField) => {
  if (!filesField) return [];
  const files = Array.isArray(filesField) ? filesField : [filesField];
  const uploaded = await Promise.all(files.map(async (file) => {
    try {
      const res = await cloudinary.uploader.upload(file.tempFilePath, {
        folder: 'BookVibe/complaints',
        resource_type: 'auto',
      });
      return {
        url: res.secure_url,
        publicId: res.public_id,
        type: res.resource_type === 'video' ? 'video' : 'image',
      };
    } catch (err) {
      console.error('[Complaint] evidence upload failed:', err.message);
      return null;
    } finally {
      fs.unlink(file.tempFilePath, () => {});
    }
  }));
  return uploaded.filter(Boolean);
};

const complaintPopulate = [
  { path: 'complainant', select: 'username email profileImage role' },
  { path: 'against', select: 'username email profileImage role' },
  { path: 'property', select: 'name type city images hostBy' },
  { path: 'booking', select: 'checkIn checkOut bookingStatus paymentStatus totalPrice propertyId userId' },
  { path: 'responses.from', select: 'username email profileImage role' },
  { path: 'conversationThread.senderId', select: 'username role profileImage' },
];

const complaintLinkForRole = (role) => role === 'host' ? '/host/complaints' : '/my-complaints';

const fileComplaint = async (req, res) => {
  try {
    const { againstUserId, bookingId, propertyId, subject, description, category } = req.body;
    let resolvedAgainstUserId = againstUserId || null;
    let resolvedPropertyId = propertyId || null;

    if (bookingId) {
      const booking = await BookingModel.findById(bookingId).populate('propertyId', 'hostBy name').populate('userId', 'username role');
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

      const complainantId = req.user._id.toString();
      const guestId = booking.userId?._id?.toString();
      const hostId = booking.propertyId?.hostBy?.toString();

      resolvedPropertyId = resolvedPropertyId || booking.propertyId?._id?.toString() || null;

      if (!resolvedAgainstUserId) {
        if (complainantId === guestId && hostId) resolvedAgainstUserId = hostId;
        else if (complainantId === hostId && guestId) resolvedAgainstUserId = guestId;
      }
    }

    if (!resolvedAgainstUserId && resolvedPropertyId) {
      const property = await PropertyModel.findById(resolvedPropertyId).select('hostBy');
      if (!property) return res.status(404).json({ success: false, message: 'Property not found' });
      resolvedAgainstUserId = property.hostBy?.toString() || null;
    }

    if (!resolvedAgainstUserId || !subject || !description) {
      return res.status(400).json({ success: false, message: 'Against user, subject, and description required' });
    }
    if (resolvedAgainstUserId.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot file a complaint against yourself' });
    }

    const againstUser = await User.findById(resolvedAgainstUserId);
    if (!againstUser) return res.status(404).json({ success: false, message: 'User not found' });

    const evidence = await uploadComplaintEvidence(req.files?.evidence);

    const complaint = await Complaint.create({
      complainant: req.user._id,
      complainantRole: req.user.role,
      against: resolvedAgainstUserId,
      againstRole: againstUser.role,
      booking: bookingId || undefined,
      property: resolvedPropertyId || undefined,
      subject,
      description,
      category: category || 'other',
      evidence,
    });

    await notifyAdmin('complaint:new', {
      title: 'New Complaint',
      message: `${req.user.username} → ${againstUser.username}: ${subject}`,
      type: 'complaint',
      severity: 'danger',
      link: `/admin/complaints?id=${complaint._id}`,
      data: { complaintId: complaint._id },
    }, 'notifyComplaints');

    await notifyUser(againstUser._id, 'complaint:new', {
      title: 'Complaint Filed',
      message: `${req.user.username} filed a complaint involving you. Admin will review it.`,
      type: 'complaint',
      severity: 'warning',
      link: complaintLinkForRole(againstUser.role),
    });

    const pop = await Complaint.findById(complaint._id).populate('complainant', 'username').populate('against', 'username');
    res.status(201).json({ success: true, message: 'Complaint filed. Admin will review.', complaint: pop });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getMyComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({ complainant: req.user._id })
      .populate(complaintPopulate)
      .sort({ createdAt: -1 });
    res.json({ success: true, complaints });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getComplaintsAgainstMe = async (req, res) => {
  try {
    const complaints = await Complaint.find({ against: req.user._id })
      .populate(complaintPopulate)
      .sort({ createdAt: -1 });
    res.json({ success: true, complaints });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    const complaint = await Complaint.findById(id);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found', success: false });

    const isComplainant = complaint.complainant.toString() === userId;
    if (!isAdmin && !isComplainant) {
      return res.status(403).json({ message: 'Only the complainant can delete this complaint', success: false });
    }

    if (complaint.evidence?.length) {
      await Promise.all(
        complaint.evidence.map((e) =>
          cloudinary.uploader
            .destroy(e.publicId, { resource_type: e.type === 'video' ? 'video' : 'image' })
            .catch(() => {})
        )
      );
    }

    await Complaint.findByIdAndDelete(id);
    return res.status(200).json({ message: 'Complaint deleted', success: true });
  } catch (error) {
    return res.status(500).json({ message: 'Internal Server Error', success: false });
  }
};

const respondToComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const { response } = req.body;

    if (!response?.trim()) return res.status(400).json({ message: 'Response text is required', success: false });

    const complaint = await Complaint.findById(id);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found', success: false });
    if (complaint.against.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Unauthorized', success: false });
    }

    if (!complaint.responses) complaint.responses = [];
    complaint.responses.push({ from: userId, text: response.trim(), createdAt: new Date() });
    await complaint.save();

    await notifyAdmin('complaint:response', {
      title: 'Host Responded',
      message: `${req.user.username} responded to complaint: "${complaint.subject}".`,
      type: 'complaint',
      severity: 'info',
      link: `/admin/complaints?id=${id}`,
      data: { complaintId: id }
    });

    await notifyUser(complaint.complainant, 'complaint:response', {
      title: 'Host Responded',
      message: `${req.user.username} responded to your complaint: "${complaint.subject}". Tap to read their response.`,
      type: 'complaint',
      severity: 'info',
      link: `/my-complaints?id=${id}`
    });

    const populated = await Complaint.findById(id).populate(complaintPopulate);
    return res.status(200).json({ message: 'Response added', success: true, complaint: populated });
  } catch (error) {
    console.error('respondToComplaint error:', error);
    return res.status(500).json({ message: 'Internal Server Error', success: false });
  }
};

const addComplaintMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const { message } = req.body;

    if (!message?.trim()) return res.status(400).json({ message: 'Message text is required', success: false });

    const complaint = await Complaint.findById(id);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found', success: false });

    const isComplainant = complaint.complainant.toString() === userId.toString();
    const isRespondent = complaint.against.toString() === userId.toString();
    if (!isComplainant && !isRespondent) {
      return res.status(403).json({ message: 'Unauthorized', success: false });
    }

    if (!complaint.responses) complaint.responses = [];
    if (complaint.responses.length >= 20) {
      return res.status(400).json({ message: 'Maximum messages reached.', success: false });
    }

    complaint.responses.push({ from: userId, text: message.trim(), createdAt: new Date() });
    await complaint.save();

    const otherPartyId = isComplainant ? complaint.against : complaint.complainant;

    await notifyAdmin('complaint:response', {
      title: 'New Complaint Message',
      message: `${req.user.username} sent a message on complaint: "${complaint.subject}".`,
      type: 'complaint',
      severity: 'info',
      link: `/admin/complaints?id=${id}`,
      data: { complaintId: id }
    });

    if (otherPartyId) {
      const otherRole = isComplainant ? complaint.againstRole : complaint.complainantRole;
      await notifyUser(otherPartyId, 'complaint:response', {
        title: 'New Message on Complaint',
        message: `${req.user.username} sent a message on complaint: "${complaint.subject}". Tap to read.`,
        type: 'complaint',
        severity: 'info',
        link: `${complaintLinkForRole(otherRole)}?id=${id}`
      });
    }

    const populated = await Complaint.findById(id).populate(complaintPopulate);
    return res.status(200).json({ message: 'Message added', success: true, complaint: populated });
  } catch (error) {
    console.error('addComplaintMessage error:', error);
    return res.status(500).json({ message: 'Internal Server Error', success: false });
  }
};

const replyToComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { messageText } = req.body;
    const user = req.user;

    if (!messageText?.trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required' });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });

    if (complaint.status === 'resolved' || complaint.status === 'dismissed') {
      return res.status(400).json({ success: false, message: 'Cannot reply to a closed complaint' });
    }

    const isComplainant = complaint.complainant.toString() === user._id.toString();
    const isRespondent = complaint.against.toString() === user._id.toString();
    const isAdmin = user.role === 'admin';

    if (!isComplainant && !isRespondent && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const roleMap = { guest: 'Guest', host: 'Host', admin: 'Admin' };
    const senderRole = roleMap[user.role] || 'Guest';

    complaint.conversationThread.push({
      senderId: user._id,
      senderRole,
      messageText: messageText.trim(),
      createdAt: new Date(),
    });

    if (isAdmin) {
      complaint.adminResponse = messageText.trim();
    }

    await complaint.save();

    if (isAdmin) {
      const preview = messageText.length > 120 ? `${messageText.slice(0, 120)}…` : messageText;
      await Promise.all([
        notifyUser(complaint.complainant, 'complaint:response', {
          title: 'Admin replied to your complaint',
          message: `Admin: ${preview}`,
          type: 'complaint',
          severity: 'info',
          link: `${complaintLinkForRole(complaint.complainantRole)}?id=${id}`,
        }),
        notifyUser(complaint.against, 'complaint:response', {
          title: 'Admin replied on a complaint',
          message: `Admin: ${preview}`,
          type: 'complaint',
          severity: 'info',
          link: `${complaintLinkForRole(complaint.againstRole)}?id=${id}`,
        }),
      ]);
    } else {
      const otherPartyId = isComplainant ? complaint.against : complaint.complainant;
      const otherRole = isComplainant ? complaint.againstRole : complaint.complainantRole;
      await notifyAdmin('complaint:response', {
        title: 'New Complaint Message',
        message: `${user.username} sent a message on "${complaint.subject}".`,
        type: 'complaint',
        severity: 'info',
        link: `/admin/complaints?id=${id}`,
        data: { complaintId: id },
      });
      if (otherPartyId) {
        await notifyUser(otherPartyId, 'complaint:response', {
          title: 'New Message on Complaint',
          message: `${user.username} sent a message on "${complaint.subject}".`,
          type: 'complaint',
          severity: 'info',
          link: `${complaintLinkForRole(otherRole)}?id=${id}`,
        });
      }
    }

    const populated = await Complaint.findById(id).populate(complaintPopulate);

    notificationService.emitRaw(`user:${complaint.complainant}`, 'complaint:message', { complaint: populated });
    notificationService.emitRaw(`user:${complaint.against}`, 'complaint:message', { complaint: populated });
    notificationService.emitRaw('admin', 'complaint:message', { complaint: populated });

    return res.status(200).json({ success: true, message: 'Message sent', complaint: populated });
  } catch (error) {
    console.error('replyToComplaint error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

export {
  fileComplaint,
  getMyComplaints,
  getComplaintsAgainstMe,
  deleteComplaint,
  respondToComplaint,
  addComplaintMessage,
  replyToComplaint,
};
