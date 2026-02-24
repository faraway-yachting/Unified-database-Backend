import { prisma } from '../config/database.js';

export async function listCustomerTags(customerId) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    const err = new Error('Customer not found');
    err.status = 404;
    throw err;
  }
  const tags = await prisma.customerTag.findMany({
    where: { customerId },
    orderBy: { tag: 'asc' },
  });
  return { customerId, tags };
}

export async function addCustomerTag(customerId, data) {
  const { tag } = data;

  if (!tag || !tag.trim()) {
    const err = new Error('tag is required');
    err.status = 400;
    throw err;
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    const err = new Error('Customer not found');
    err.status = 404;
    throw err;
  }

  const trimmed = tag.trim();
  const existing = await prisma.customerTag.findFirst({
    where: { customerId, tag: trimmed },
  });
  if (existing) {
    const err = new Error('Tag already exists for this customer');
    err.status = 409;
    throw err;
  }

  const customerTag = await prisma.customerTag.create({
    data: { customerId, tag: trimmed },
  });
  return customerTag;
}

export async function removeCustomerTag(customerId, tagId) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    const err = new Error('Customer not found');
    err.status = 404;
    throw err;
  }

  const customerTag = await prisma.customerTag.findFirst({
    where: { id: tagId, customerId },
  });
  if (!customerTag) {
    const err = new Error('Tag not found');
    err.status = 404;
    throw err;
  }

  await prisma.customerTag.delete({ where: { id: tagId } });
}
