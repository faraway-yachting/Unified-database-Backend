import * as customerService from '../services/customerService.js';
import * as customerTagService from '../services/customerTagService.js';
import * as leadService from '../services/leadService.js';
import * as communicationLogService from '../services/communicationLogService.js';
import * as customerSurveyService from '../services/customerSurveyService.js';
import * as followUpSequenceService from '../services/followUpSequenceService.js';

// --- Customers ---
export async function listCustomers(req, res, next) {
  try {
    const { segment, region, tag, search, page, limit } = req.query;
    const result = await customerService.listCustomers({
      segment,
      regionId: region,
      tag,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getCustomer(req, res, next) {
  try {
    const customer = await customerService.getCustomerById(req.params.id);
    res.status(200).json(customer);
  } catch (err) {
    next(err);
  }
}

export async function createCustomer(req, res, next) {
  try {
    const customer = await customerService.createCustomer(req.body);
    res.status(201).json(customer);
  } catch (err) {
    next(err);
  }
}

export async function updateCustomer(req, res, next) {
  try {
    const customer = await customerService.updateCustomer(req.params.id, req.body);
    res.status(200).json(customer);
  } catch (err) {
    next(err);
  }
}

export async function softDeleteCustomer(req, res, next) {
  try {
    const customer = await customerService.softDeleteCustomer(req.params.id);
    res.status(200).json(customer);
  } catch (err) {
    next(err);
  }
}

export async function getCustomerBookings(req, res, next) {
  try {
    const { page, limit } = req.query;
    const result = await customerService.getCustomerBookings(req.params.id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getCustomerCommunications(req, res, next) {
  try {
    const { page, limit } = req.query;
    const result = await customerService.getCustomerCommunications(req.params.id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getCustomerSurveys(req, res, next) {
  try {
    const { page, limit } = req.query;
    const result = await customerService.getCustomerSurveys(req.params.id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// --- Customer Tags ---
export async function listCustomerTags(req, res, next) {
  try {
    const result = await customerTagService.listCustomerTags(req.params.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function addCustomerTag(req, res, next) {
  try {
    const tag = await customerTagService.addCustomerTag(req.params.id, req.body);
    res.status(201).json(tag);
  } catch (err) {
    next(err);
  }
}

export async function removeCustomerTag(req, res, next) {
  try {
    await customerTagService.removeCustomerTag(req.params.id, req.params.tagId);
    res.status(200).json({ message: 'Tag removed' });
  } catch (err) {
    next(err);
  }
}

// --- Leads ---
export async function listLeads(req, res, next) {
  try {
    const { status, region, assigned, page, limit } = req.query;
    const result = await leadService.listLeads({
      status,
      regionId: region,
      assigned,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getLead(req, res, next) {
  try {
    const lead = await leadService.getLeadById(req.params.id);
    res.status(200).json(lead);
  } catch (err) {
    next(err);
  }
}

export async function createLead(req, res, next) {
  try {
    const lead = await leadService.createLead(req.body);
    res.status(201).json(lead);
  } catch (err) {
    next(err);
  }
}

export async function updateLead(req, res, next) {
  try {
    const lead = await leadService.updateLead(req.params.id, req.body);
    res.status(200).json(lead);
  } catch (err) {
    next(err);
  }
}

export async function deleteLead(req, res, next) {
  try {
    await leadService.deleteLead(req.params.id);
    res.status(200).json({ message: 'Lead deleted' });
  } catch (err) {
    next(err);
  }
}

export async function updateLeadStatus(req, res, next) {
  try {
    const lead = await leadService.updateLeadStatus(req.params.id, req.body);
    res.status(200).json(lead);
  } catch (err) {
    next(err);
  }
}

export async function convertLeadToBooking(req, res, next) {
  try {
    const result = await leadService.convertLeadToBooking(req.params.id, req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// --- Communication Logs ---
export async function listCommunications(req, res, next) {
  try {
    const { customerId, channel, direction, page, limit } = req.query;
    const result = await communicationLogService.listCommunications({
      customerId,
      channel,
      direction,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getCommunication(req, res, next) {
  try {
    const log = await communicationLogService.getCommunicationById(req.params.id);
    res.status(200).json(log);
  } catch (err) {
    next(err);
  }
}

export async function createCommunication(req, res, next) {
  try {
    const log = await communicationLogService.createCommunication(req.body);
    res.status(201).json(log);
  } catch (err) {
    next(err);
  }
}

export async function updateCommunication(req, res, next) {
  try {
    const log = await communicationLogService.updateCommunication(req.params.id, req.body);
    res.status(200).json(log);
  } catch (err) {
    next(err);
  }
}

export async function deleteCommunication(req, res, next) {
  try {
    await communicationLogService.deleteCommunication(req.params.id);
    res.status(200).json({ message: 'Communication log deleted' });
  } catch (err) {
    next(err);
  }
}

// --- Surveys ---
export async function listSurveys(req, res, next) {
  try {
    const { customerId, bookingId, page, limit } = req.query;
    const result = await customerSurveyService.listSurveys({
      customerId,
      bookingId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getSurvey(req, res, next) {
  try {
    const survey = await customerSurveyService.getSurveyById(req.params.id);
    res.status(200).json(survey);
  } catch (err) {
    next(err);
  }
}

export async function createSurvey(req, res, next) {
  try {
    const survey = await customerSurveyService.createSurvey(req.body);
    res.status(201).json(survey);
  } catch (err) {
    next(err);
  }
}

export async function updateSurvey(req, res, next) {
  try {
    const survey = await customerSurveyService.updateSurvey(req.params.id, req.body);
    res.status(200).json(survey);
  } catch (err) {
    next(err);
  }
}

export async function deleteSurvey(req, res, next) {
  try {
    await customerSurveyService.deleteSurvey(req.params.id);
    res.status(200).json({ message: 'Survey deleted' });
  } catch (err) {
    next(err);
  }
}

// --- Follow-up Sequences ---
export async function listSequences(req, res, next) {
  try {
    const { isActive, page, limit } = req.query;
    const result = await followUpSequenceService.listSequences({
      isActive,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getSequence(req, res, next) {
  try {
    const sequence = await followUpSequenceService.getSequenceById(req.params.id);
    res.status(200).json(sequence);
  } catch (err) {
    next(err);
  }
}

export async function createSequence(req, res, next) {
  try {
    const sequence = await followUpSequenceService.createSequence(req.body);
    res.status(201).json(sequence);
  } catch (err) {
    next(err);
  }
}

export async function updateSequence(req, res, next) {
  try {
    const sequence = await followUpSequenceService.updateSequence(req.params.id, req.body);
    res.status(200).json(sequence);
  } catch (err) {
    next(err);
  }
}

export async function deleteSequence(req, res, next) {
  try {
    await followUpSequenceService.deleteSequence(req.params.id);
    res.status(200).json({ message: 'Sequence deleted' });
  } catch (err) {
    next(err);
  }
}

export async function updateSequenceStatus(req, res, next) {
  try {
    const sequence = await followUpSequenceService.updateSequenceStatus(req.params.id, req.body);
    res.status(200).json(sequence);
  } catch (err) {
    next(err);
  }
}

export async function listSequenceSteps(req, res, next) {
  try {
    const result = await followUpSequenceService.listSteps(req.params.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function addSequenceStep(req, res, next) {
  try {
    const step = await followUpSequenceService.addStep(req.params.id, req.body);
    res.status(201).json(step);
  } catch (err) {
    next(err);
  }
}

export async function updateSequenceStep(req, res, next) {
  try {
    const step = await followUpSequenceService.updateStep(req.params.id, req.params.stepId, req.body);
    res.status(200).json(step);
  } catch (err) {
    next(err);
  }
}

export async function deleteSequenceStep(req, res, next) {
  try {
    await followUpSequenceService.deleteStep(req.params.id, req.params.stepId);
    res.status(200).json({ message: 'Step deleted' });
  } catch (err) {
    next(err);
  }
}
