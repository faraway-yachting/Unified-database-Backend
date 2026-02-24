import { prisma } from '../config/database.js';

const VALID_TRIGGER_EVENTS = ['booking_confirmed', 'booking_completed', 'inquiry_received', 'no_activity_30d'];
const VALID_STEP_CHANNELS = ['email', 'whatsapp', 'sms'];

export async function listSequences(options = {}) {
  const { isActive, page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;
  const where = {};
  if (isActive !== undefined) where.isActive = isActive === 'true' || isActive === true;

  const [sequences, total] = await Promise.all([
    prisma.followUpSequence.findMany({
      where,
      include: { _count: { select: { steps: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.followUpSequence.count({ where }),
  ]);

  return { sequences, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getSequenceById(id) {
  const sequence = await prisma.followUpSequence.findUnique({
    where: { id },
    include: {
      steps: {
        orderBy: { stepOrder: 'asc' },
        include: { template: { select: { id: true, name: true, type: true } } },
      },
    },
  });
  if (!sequence) {
    const err = new Error('Sequence not found');
    err.status = 404;
    throw err;
  }
  return sequence;
}

export async function createSequence(data) {
  const { name, triggerEvent, isActive = true } = data;

  if (!name || !triggerEvent) {
    const err = new Error('name and triggerEvent are required');
    err.status = 400;
    throw err;
  }

  if (!VALID_TRIGGER_EVENTS.includes(triggerEvent)) {
    const err = new Error(`triggerEvent must be one of: ${VALID_TRIGGER_EVENTS.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const sequence = await prisma.followUpSequence.create({
    data: {
      name: name.trim(),
      triggerEvent,
      isActive: isActive !== false,
    },
  });
  return sequence;
}

export async function updateSequence(id, data) {
  const sequence = await prisma.followUpSequence.findUnique({ where: { id } });
  if (!sequence) {
    const err = new Error('Sequence not found');
    err.status = 404;
    throw err;
  }

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.triggerEvent !== undefined) {
    if (!VALID_TRIGGER_EVENTS.includes(data.triggerEvent)) {
      const err = new Error(`triggerEvent must be one of: ${VALID_TRIGGER_EVENTS.join(', ')}`);
      err.status = 400;
      throw err;
    }
    updateData.triggerEvent = data.triggerEvent;
  }
  if (data.isActive !== undefined) updateData.isActive = data.isActive !== false;

  return prisma.followUpSequence.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteSequence(id) {
  const sequence = await prisma.followUpSequence.findUnique({ where: { id } });
  if (!sequence) {
    const err = new Error('Sequence not found');
    err.status = 404;
    throw err;
  }
  await prisma.followUpSequence.delete({ where: { id } });
}

export async function updateSequenceStatus(id, data) {
  const { isActive } = data;
  const sequence = await prisma.followUpSequence.findUnique({ where: { id } });
  if (!sequence) {
    const err = new Error('Sequence not found');
    err.status = 404;
    throw err;
  }
  return prisma.followUpSequence.update({
    where: { id },
    data: { isActive: isActive !== false },
  });
}

// --- Steps ---
export async function listSteps(sequenceId) {
  const sequence = await prisma.followUpSequence.findUnique({ where: { id: sequenceId } });
  if (!sequence) {
    const err = new Error('Sequence not found');
    err.status = 404;
    throw err;
  }
  const steps = await prisma.followUpSequenceStep.findMany({
    where: { sequenceId },
    include: { template: { select: { id: true, name: true, type: true } } },
    orderBy: { stepOrder: 'asc' },
  });
  return { sequenceId, steps };
}

export async function addStep(sequenceId, data) {
  const { stepOrder, delayDays, channel, templateId, subject } = data;

  if (!sequenceId || !channel) {
    const err = new Error('sequenceId and channel are required');
    err.status = 400;
    throw err;
  }

  const sequence = await prisma.followUpSequence.findUnique({ where: { id: sequenceId } });
  if (!sequence) {
    const err = new Error('Sequence not found');
    err.status = 404;
    throw err;
  }

  if (!VALID_STEP_CHANNELS.includes(channel)) {
    const err = new Error(`channel must be one of: ${VALID_STEP_CHANNELS.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const maxOrder = await prisma.followUpSequenceStep.findFirst({
    where: { sequenceId },
    orderBy: { stepOrder: 'desc' },
    select: { stepOrder: true },
  });
  const order = stepOrder != null ? parseInt(stepOrder, 10) : (maxOrder?.stepOrder ?? -1) + 1;
  const delay = delayDays != null ? parseInt(delayDays, 10) : 0;

  const step = await prisma.followUpSequenceStep.create({
    data: {
      sequenceId,
      stepOrder: order,
      delayDays: delay,
      channel,
      templateId: templateId || null,
      subject: subject?.trim() || null,
    },
    include: { template: { select: { id: true, name: true } } },
  });
  return step;
}

export async function updateStep(sequenceId, stepId, data) {
  const sequence = await prisma.followUpSequence.findUnique({ where: { id: sequenceId } });
  if (!sequence) {
    const err = new Error('Sequence not found');
    err.status = 404;
    throw err;
  }

  const step = await prisma.followUpSequenceStep.findFirst({
    where: { id: stepId, sequenceId },
  });
  if (!step) {
    const err = new Error('Step not found');
    err.status = 404;
    throw err;
  }

  const updateData = {};
  if (data.stepOrder !== undefined) updateData.stepOrder = parseInt(data.stepOrder, 10);
  if (data.delayDays !== undefined) updateData.delayDays = parseInt(data.delayDays, 10);
  if (data.channel !== undefined) {
    if (!VALID_STEP_CHANNELS.includes(data.channel)) {
      const err = new Error(`channel must be one of: ${VALID_STEP_CHANNELS.join(', ')}`);
      err.status = 400;
      throw err;
    }
    updateData.channel = data.channel;
  }
  if (data.templateId !== undefined) updateData.templateId = data.templateId || null;
  if (data.subject !== undefined) updateData.subject = data.subject?.trim() || null;

  return prisma.followUpSequenceStep.update({
    where: { id: stepId },
    data: updateData,
    include: { template: { select: { id: true, name: true } } },
  });
}

export async function deleteStep(sequenceId, stepId) {
  const sequence = await prisma.followUpSequence.findUnique({ where: { id: sequenceId } });
  if (!sequence) {
    const err = new Error('Sequence not found');
    err.status = 404;
    throw err;
  }

  const step = await prisma.followUpSequenceStep.findFirst({
    where: { id: stepId, sequenceId },
  });
  if (!step) {
    const err = new Error('Step not found');
    err.status = 404;
    throw err;
  }

  await prisma.followUpSequenceStep.delete({ where: { id: stepId } });
}
