import { prisma } from '../config/database.js';
import { Resend } from 'resend';
import authConfig from '../config/auth.js';

const resend = authConfig.resend?.apiKey ? new Resend(authConfig.resend.apiKey) : null;

const VALID_TYPES = ['booking_confirmation', 'invoice', 'cancellation', 'follow_up', 'inquiry_response', 'loyalty'];

export async function listEmailTemplates(options = {}) {
  const { type, isActive, page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;
  const where = {};
  if (type) {
    if (!VALID_TYPES.includes(type)) {
      const err = new Error(`type must be one of: ${VALID_TYPES.join(', ')}`);
      err.status = 400;
      throw err;
    }
    where.type = type;
  }
  if (isActive !== undefined) where.isActive = isActive === 'true' || isActive === true;

  const [templates, total] = await Promise.all([
    prisma.emailTemplate.findMany({
      where,
      orderBy: { type: 'asc' },
      skip,
      take: limit,
    }),
    prisma.emailTemplate.count({ where }),
  ]);

  return { templates, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getEmailTemplateById(id) {
  const template = await prisma.emailTemplate.findUnique({
    where: { id },
  });
  if (!template) {
    const err = new Error('Email template not found');
    err.status = 404;
    throw err;
  }
  return template;
}

export async function createEmailTemplate(data) {
  const { name, type, subject, bodyHtml, bodyText, isActive = true } = data;

  if (!name || !type || !subject || !bodyHtml) {
    const err = new Error('name, type, subject, and bodyHtml are required');
    err.status = 400;
    throw err;
  }

  if (!VALID_TYPES.includes(type)) {
    const err = new Error(`type must be one of: ${VALID_TYPES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const template = await prisma.emailTemplate.create({
    data: {
      name: name.trim(),
      type,
      subject: subject.trim(),
      bodyHtml: bodyHtml.trim(),
      bodyText: bodyText?.trim() || null,
      isActive: isActive !== false,
    },
  });
  return template;
}

export async function updateEmailTemplate(id, data) {
  const template = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!template) {
    const err = new Error('Email template not found');
    err.status = 404;
    throw err;
  }

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.type !== undefined) {
    if (!VALID_TYPES.includes(data.type)) {
      const err = new Error(`type must be one of: ${VALID_TYPES.join(', ')}`);
      err.status = 400;
      throw err;
    }
    updateData.type = data.type;
  }
  if (data.subject !== undefined) updateData.subject = data.subject.trim();
  if (data.bodyHtml !== undefined) updateData.bodyHtml = data.bodyHtml.trim();
  if (data.bodyText !== undefined) updateData.bodyText = data.bodyText?.trim() || null;
  if (data.isActive !== undefined) updateData.isActive = data.isActive !== false;

  return prisma.emailTemplate.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteEmailTemplate(id) {
  const template = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!template) {
    const err = new Error('Email template not found');
    err.status = 404;
    throw err;
  }
  await prisma.emailTemplate.delete({ where: { id } });
}

export async function sendTestEmail(templateId, toEmail) {
  const template = await prisma.emailTemplate.findUnique({ where: { id: templateId } });
  if (!template) {
    const err = new Error('Email template not found');
    err.status = 404;
    throw err;
  }

  if (!toEmail || !toEmail.trim()) {
    const err = new Error('toEmail is required');
    err.status = 400;
    throw err;
  }

  if (!resend) {
    const err = new Error('Email service not configured (RESEND_API_KEY)');
    err.status = 502;
    throw err;
  }

  const from = authConfig.resend?.from || 'YachtOS Admin <onboarding@resend.dev>';
  const { data, error } = await resend.emails.send({
    from,
    to: [toEmail.trim()],
    subject: `[Test] ${template.subject}`,
    html: template.bodyHtml,
    text: template.bodyText || undefined,
  });

  if (error) {
    const err = new Error(error.message || 'Failed to send test email');
    err.status = 502;
    err.cause = error;
    throw err;
  }

  return { sent: true, id: data?.id, to: toEmail.trim() };
}
