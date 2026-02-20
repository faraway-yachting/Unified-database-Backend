import { prisma } from '../config/database.js';

const VALID_MAINTENANCE_TYPES = ['scheduled', 'emergency', 'inspection'];
const VALID_STATUSES = ['scheduled', 'in_progress', 'completed', 'overdue'];

/**
 * Get all maintenance records for a yacht.
 * @param {string} yachtId - Yacht UUID
 * @param {object} options - { maintenanceType, status, page, limit }
 * @returns {Promise<{ maintenance: Array, total: number, page: number, limit: number }>}
 */
export async function getYachtMaintenance(yachtId, options = {}) {
  const {
    maintenanceType,
    status,
    page = 1,
    limit = 50,
  } = options;

  // Verify yacht exists
  const yacht = await prisma.yacht.findUnique({
    where: { id: yachtId },
  });

  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  const skip = (page - 1) * limit;
  const where = { yachtId };
  if (maintenanceType) where.maintenanceType = maintenanceType;
  if (status) where.status = status;

  const [maintenance, total] = await Promise.all([
    prisma.yachtMaintenance.findMany({
      where,
      orderBy: [
        { scheduledDate: 'desc' },
        { createdAt: 'desc' },
      ],
      skip,
      take: limit,
    }),
    prisma.yachtMaintenance.count({ where }),
  ]);

  return {
    maintenance,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Create a maintenance record for a yacht.
 * @param {string} yachtId - Yacht UUID
 * @param {object} data - Maintenance data
 * @returns {Promise<object>}
 */
export async function createYachtMaintenance(yachtId, data) {
  const {
    maintenanceType,
    description,
    scheduledDate,
    completedDate,
    status = 'scheduled',
    cost,
    performedBy,
    notes,
  } = data;

  // Validate required fields
  if (!maintenanceType || !description || !scheduledDate) {
    const err = new Error('maintenanceType, description, and scheduledDate are required');
    err.status = 400;
    throw err;
  }

  // Validate maintenanceType
  if (!VALID_MAINTENANCE_TYPES.includes(maintenanceType)) {
    const err = new Error(`maintenanceType must be one of: ${VALID_MAINTENANCE_TYPES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  // Validate status
  if (status && !VALID_STATUSES.includes(status)) {
    const err = new Error(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  // Verify yacht exists
  const yacht = await prisma.yacht.findUnique({
    where: { id: yachtId },
  });

  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  // Parse dates
  const parsedScheduledDate = new Date(scheduledDate);
  if (isNaN(parsedScheduledDate.getTime())) {
    const err = new Error('Invalid scheduledDate format');
    err.status = 400;
    throw err;
  }

  let parsedCompletedDate = null;
  if (completedDate) {
    parsedCompletedDate = new Date(completedDate);
    if (isNaN(parsedCompletedDate.getTime())) {
      const err = new Error('Invalid completedDate format');
      err.status = 400;
      throw err;
    }
  }

  // Auto-set status to overdue if scheduled date is in the past and status is still scheduled
  let finalStatus = status;
  if (status === 'scheduled' && parsedScheduledDate < new Date() && !parsedCompletedDate) {
    finalStatus = 'overdue';
  }

  const maintenance = await prisma.yachtMaintenance.create({
    data: {
      yachtId,
      maintenanceType,
      description,
      scheduledDate: parsedScheduledDate,
      completedDate: parsedCompletedDate,
      status: finalStatus,
      cost: cost ? parseFloat(cost) : null,
      performedBy: performedBy || null,
      notes: notes || null,
    },
  });

  return maintenance;
}

/**
 * Update a maintenance record.
 * @param {string} yachtId - Yacht UUID
 * @param {string} maintenanceId - Maintenance UUID
 * @param {object} data - Partial maintenance data
 * @returns {Promise<object>}
 */
export async function updateYachtMaintenance(yachtId, maintenanceId, data) {
  const {
    maintenanceType,
    description,
    scheduledDate,
    completedDate,
    status,
    cost,
    performedBy,
    notes,
  } = data;

  // Verify yacht exists
  const yacht = await prisma.yacht.findUnique({
    where: { id: yachtId },
  });

  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  // Verify maintenance exists and belongs to yacht
  const maintenance = await prisma.yachtMaintenance.findFirst({
    where: {
      id: maintenanceId,
      yachtId,
    },
  });

  if (!maintenance) {
    const err = new Error('Maintenance record not found');
    err.status = 404;
    throw err;
  }

  const updateData = {};

  if (maintenanceType !== undefined) {
    if (!VALID_MAINTENANCE_TYPES.includes(maintenanceType)) {
      const err = new Error(`maintenanceType must be one of: ${VALID_MAINTENANCE_TYPES.join(', ')}`);
      err.status = 400;
      throw err;
    }
    updateData.maintenanceType = maintenanceType;
  }

  if (description !== undefined) updateData.description = description;
  if (performedBy !== undefined) updateData.performedBy = performedBy || null;
  if (notes !== undefined) updateData.notes = notes || null;
  if (cost !== undefined) updateData.cost = cost ? parseFloat(cost) : null;

  if (scheduledDate !== undefined) {
    const parsed = new Date(scheduledDate);
    if (isNaN(parsed.getTime())) {
      const err = new Error('Invalid scheduledDate format');
      err.status = 400;
      throw err;
    }
    updateData.scheduledDate = parsed;
  }

  if (completedDate !== undefined) {
    if (completedDate === null) {
      updateData.completedDate = null;
    } else {
      const parsed = new Date(completedDate);
      if (isNaN(parsed.getTime())) {
        const err = new Error('Invalid completedDate format');
        err.status = 400;
        throw err;
      }
      updateData.completedDate = parsed;
    }
  }

  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) {
      const err = new Error(`status must be one of: ${VALID_STATUSES.join(', ')}`);
      err.status = 400;
      throw err;
    }
    updateData.status = status;
  }

  // Auto-update status logic
  const finalScheduledDate = updateData.scheduledDate || maintenance.scheduledDate;
  const finalCompletedDate = updateData.completedDate !== undefined ? updateData.completedDate : maintenance.completedDate;
  const finalStatus = updateData.status !== undefined ? updateData.status : maintenance.status;

  // If completed date is set and status is not completed, auto-set to completed
  if (finalCompletedDate && finalStatus !== 'completed') {
    updateData.status = 'completed';
  }
  // If scheduled date is in the past and status is scheduled, set to overdue
  else if (!finalCompletedDate && finalScheduledDate < new Date() && finalStatus === 'scheduled') {
    updateData.status = 'overdue';
  }

  const updatedMaintenance = await prisma.yachtMaintenance.update({
    where: { id: maintenanceId },
    data: updateData,
  });

  return updatedMaintenance;
}

/**
 * Delete a maintenance record.
 * @param {string} yachtId - Yacht UUID
 * @param {string} maintenanceId - Maintenance UUID
 * @returns {Promise<void>}
 */
export async function deleteYachtMaintenance(yachtId, maintenanceId) {
  // Verify yacht exists
  const yacht = await prisma.yacht.findUnique({
    where: { id: yachtId },
  });

  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  // Verify maintenance exists and belongs to yacht
  const maintenance = await prisma.yachtMaintenance.findFirst({
    where: {
      id: maintenanceId,
      yachtId,
    },
  });

  if (!maintenance) {
    const err = new Error('Maintenance record not found');
    err.status = 404;
    throw err;
  }

  await prisma.yachtMaintenance.delete({
    where: { id: maintenanceId },
  });
}
