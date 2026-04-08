import { prisma } from '../config/database.js';
import { uploadFile, deleteFile, generateS3Key } from './s3Service.js';
import { s3Config } from './s3Service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveImageUrl(url) {
  if (!url) return url;
  if (url.startsWith('https://') || url.startsWith('http://')) return url;
  if (url.startsWith('s3://')) {
    const key = url.replace('s3://', '').split('/').slice(1).join('/');
    if (!key) return url;
    if (s3Config.publicUrl) return `${s3Config.publicUrl.replace(/\/$/, '')}/${key}`;
    if (s3Config.bucket) return `https://${s3Config.bucket}.s3.${s3Config.region || 'us-east-1'}.amazonaws.com/${key}`;
  }
  return url;
}

function extractS3KeyFromUrl(url) {
  if (!url) return null;
  if (url.startsWith('s3://')) {
    return url.replace('s3://', '').split('/').slice(1).join('/') || null;
  }
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return null;
    if (s3Config.bucket && parts[0] === s3Config.bucket) return parts.slice(1).join('/');
    return parts.join('/');
  } catch (_) {
    return null;
  }
}

function resolveBlog(blog) {
  if (!blog) return blog;
  if (blog.primaryImage) blog.primaryImage = resolveImageUrl(blog.primaryImage);
  return blog;
}

/** Parse region_ids from multipart body — supports array or comma-separated string. */
function parseRegionIds(raw) {
  if (!raw) return null; // null = not provided (no change)
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') return raw.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

const BLOG_INCLUDE = {
  translations: { orderBy: { locale: 'asc' } },
  regionVisibility: { include: { region: { select: { id: true, name: true, slug: true } } } },
};

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listBlogs(options = {}) {
  const {
    page = 1,
    limit = 12,
    status,
    regionId,
    regionSlug,
    includeTranslations = false,
  } = options;

  const skip = (page - 1) * limit;

  const where = {};
  if (status) where.status = status;
  if (regionId) {
    where.regionVisibility = { some: { regionId } };
  } else if (regionSlug) {
    where.regionVisibility = { some: { region: { slug: regionSlug } } };
  }

  const include = {
    regionVisibility: { include: { region: { select: { id: true, name: true, slug: true } } } },
  };
  if (includeTranslations) include.translations = { orderBy: { locale: 'asc' } };

  const [blogs, total] = await Promise.all([
    prisma.blog.findMany({ where, include, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    prisma.blog.count({ where }),
  ]);

  blogs.forEach(resolveBlog);

  return { blogs, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─── Get by ID ────────────────────────────────────────────────────────────────

export async function getBlogById(id, options = {}) {
  const { includeTranslations = true } = options;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const include = {
    regionVisibility: { include: { region: { select: { id: true, name: true, slug: true } } } },
  };
  if (includeTranslations) include.translations = { orderBy: { locale: 'asc' } };

  const blog = await prisma.blog.findUnique({
    where: isUuid ? { id } : { slug: id },
    include,
  });

  if (!blog) {
    const err = new Error('Blog not found');
    err.status = 404;
    throw err;
  }

  return resolveBlog(blog);
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createBlog(data, files = {}) {
  const {
    slug,
    title,
    short_description,
    detailed_description,
    locale = 'en',
    status = 'draft',
  } = data;

  const regionIds = parseRegionIds(data.region_ids);

  if (!slug?.trim()) {
    const err = new Error('slug is required');
    err.status = 400;
    throw err;
  }
  if (!title?.trim()) {
    const err = new Error('title is required');
    err.status = 400;
    throw err;
  }

  // Check slug uniqueness
  const existing = await prisma.blog.findUnique({ where: { slug: slug.trim() } });
  if (existing) {
    const err = new Error('A blog with this slug already exists');
    err.status = 409;
    throw err;
  }

  // Upload primary image to S3 blog/{slug}/images/ folder
  let primaryImage = null;
  let primaryImageKey = null;
  const imageFile = files?.primary_image?.[0] ?? files?.primary_image ?? null;
  if (imageFile?.buffer) {
    const s3Key = generateS3Key(imageFile.originalname, `blog/${slug.trim()}/Primary-Image`);
    const uploaded = await uploadFile(imageFile.buffer, s3Key, imageFile.mimetype);
    primaryImage = uploaded.url;
    primaryImageKey = uploaded.key;
  }

  const blog = await prisma.blog.create({
    data: {
      slug: slug.trim(),
      title: title.trim(),
      shortDescription: short_description?.trim() ?? null,
      detailedDescription: detailed_description?.trim() ?? null,
      primaryImage,
      primaryImageKey,
      status,
      translations: {
        create: {
          locale,
          title: title.trim(),
          shortDescription: short_description?.trim() ?? null,
          detailedDescription: detailed_description?.trim() ?? null,
        },
      },
      ...(regionIds?.length
        ? { regionVisibility: { create: regionIds.map(regionId => ({ regionId })) } }
        : {}),
    },
    include: BLOG_INCLUDE,
  });

  return resolveBlog(blog);
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateBlog(id, data, files = {}) {
  const existing = await getBlogById(id);

  const {
    slug,
    title,
    short_description,
    detailed_description,
    locale = 'en',
    status,
  } = data;

  const regionIds = parseRegionIds(data.region_ids);

  // Check slug uniqueness if changing
  if (slug && slug.trim() !== existing.slug) {
    const conflict = await prisma.blog.findUnique({ where: { slug: slug.trim() } });
    if (conflict && conflict.id !== existing.id) {
      const err = new Error('A blog with this slug already exists');
      err.status = 409;
      throw err;
    }
  }

  // Upload new primary image if provided
  let primaryImage = existing.primaryImage;
  let primaryImageKey = existing.primaryImageKey;
  const imageFile = files?.primary_image?.[0] ?? files?.primary_image ?? null;
  const activeSlug = (slug?.trim()) || existing.slug;
  if (imageFile?.buffer) {
    if (existing.primaryImageKey) {
      await deleteFile(existing.primaryImageKey).catch(() => {});
    } else if (existing.primaryImage) {
      const oldKey = extractS3KeyFromUrl(existing.primaryImage);
      if (oldKey) await deleteFile(oldKey).catch(() => {});
    }
    const s3Key = generateS3Key(imageFile.originalname, `blog/${activeSlug}/Primary-Image`);
    const uploaded = await uploadFile(imageFile.buffer, s3Key, imageFile.mimetype);
    primaryImage = uploaded.url;
    primaryImageKey = uploaded.key;
  }

  // Build update payload
  const updateData = {};
  if (slug !== undefined) updateData.slug = slug.trim();
  if (status !== undefined) updateData.status = status;
  if (primaryImage !== existing.primaryImage) {
    updateData.primaryImage = primaryImage;
    updateData.primaryImageKey = primaryImageKey;
  }

  if (locale === 'en') {
    if (title !== undefined) updateData.title = title.trim();
    if (short_description !== undefined) updateData.shortDescription = short_description.trim();
    if (detailed_description !== undefined) updateData.detailedDescription = detailed_description.trim();
  }

  const translationData = {};
  if (title !== undefined) translationData.title = title.trim();
  if (short_description !== undefined) translationData.shortDescription = short_description.trim();
  if (detailed_description !== undefined) translationData.detailedDescription = detailed_description.trim();

  const blog = await prisma.$transaction(async (tx) => {
    await tx.blog.update({ where: { id: existing.id }, data: updateData });

    if (Object.keys(translationData).length > 0) {
      await tx.blogTranslation.upsert({
        where: { blogId_locale: { blogId: existing.id, locale } },
        update: translationData,
        create: { blogId: existing.id, locale, ...translationData },
      });
    }

    // Replace region visibility if region_ids was provided in the payload
    if (regionIds !== null) {
      await tx.blogRegionVisibility.deleteMany({ where: { blogId: existing.id } });
      if (regionIds.length > 0) {
        await tx.blogRegionVisibility.createMany({
          data: regionIds.map(regionId => ({ blogId: existing.id, regionId })),
        });
      }
    }

    return tx.blog.findUnique({ where: { id: existing.id }, include: BLOG_INCLUDE });
  });

  return resolveBlog(blog);
}

// ─── Upload Content Image ─────────────────────────────────────────────────────

export async function uploadContentImage(id, imageFile) {
  const blog = await getBlogById(id, { includeTranslations: false });
  const s3Key = generateS3Key(imageFile.originalname, `blog/${blog.slug}/Content-Image`);
  const uploaded = await uploadFile(imageFile.buffer, s3Key, imageFile.mimetype);
  return uploaded.url;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteBlog(id) {
  const blog = await getBlogById(id);

  if (blog.primaryImageKey) {
    await deleteFile(blog.primaryImageKey).catch(() => {});
  } else if (blog.primaryImage) {
    const key = extractS3KeyFromUrl(blog.primaryImage);
    if (key) await deleteFile(key).catch(() => {});
  }

  await prisma.blog.delete({ where: { id: blog.id } });

  return { id: blog.id, slug: blog.slug };
}

// ─── Update Status ────────────────────────────────────────────────────────────

export async function updateBlogStatus(id, status) {
  const validStatuses = ['draft', 'published'];
  if (!validStatuses.includes(status)) {
    const err = new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const blog = await getBlogById(id);

  const updated = await prisma.blog.update({
    where: { id: blog.id },
    data: { status },
    include: BLOG_INCLUDE,
  });

  return resolveBlog(updated);
}
