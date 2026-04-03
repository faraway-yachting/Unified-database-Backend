import * as blogService from '../services/blogService.js';
import { logAudit } from '../utils/audit.js';

/**
 * GET /api/blog
 * List all blogs with optional pagination.
 * Query: page, limit, status, includeTranslations
 */
export async function listBlogs(req, res, next) {
  try {
    const { page, limit, status, regionId, includeTranslations } = req.query;
    const result = await blogService.listBlogs({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 12,
      status: status || undefined,
      regionId: regionId || undefined,
      includeTranslations: includeTranslations === 'true',
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/blog/:id
 * Get a single blog by ID or slug.
 * Query: includeTranslations
 */
export async function getBlogById(req, res, next) {
  try {
    const { id } = req.params;
    const { includeTranslations } = req.query;
    const blog = await blogService.getBlogById(id, {
      includeTranslations: includeTranslations !== 'false',
    });
    res.status(200).json(blog);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/blog
 * Create a new blog post.
 * Body (multipart/form-data): slug, title, short_description, detailed_description, locale, primary_image (file)
 */
export async function createBlog(req, res, next) {
  try {
    const files = {
      primary_image: req.files?.primary_image ?? (req.file ? [req.file] : null),
    };
    const blog = await blogService.createBlog(req.body, files);
    logAudit(req, {
      action: 'created',
      module: 'blog',
      entityType: 'Blog',
      entityId: blog.id,
      description: `Created blog "${blog.slug}"`,
    }).catch(() => {});
    res.status(201).json(blog);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/blog/:id
 * Update a blog post.
 * Body (multipart/form-data): slug, title, short_description, detailed_description, locale, primary_image (file)
 */
export async function updateBlog(req, res, next) {
  try {
    const { id } = req.params;
    const files = {
      primary_image: req.files?.primary_image ?? (req.file ? [req.file] : null),
    };
    const blog = await blogService.updateBlog(id, req.body, files);
    logAudit(req, {
      action: 'updated',
      module: 'blog',
      entityType: 'Blog',
      entityId: id,
      description: `Updated blog "${blog.slug}"`,
    }).catch(() => {});
    res.status(200).json(blog);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/blog/:id
 * Delete a blog post and its S3 image.
 */
export async function deleteBlog(req, res, next) {
  try {
    const { id } = req.params;
    const result = await blogService.deleteBlog(id);
    logAudit(req, {
      action: 'deleted',
      module: 'blog',
      entityType: 'Blog',
      entityId: id,
      description: `Deleted blog "${result.slug}"`,
    }).catch(() => {});
    res.status(200).json({ message: 'Blog deleted successfully' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/blog/:id/upload-image
 * Upload a content image for a blog's description, stored under blog/{slug}/content/.
 * Body (multipart/form-data): image (file)
 */
export async function uploadContentImage(req, res, next) {
  try {
    const { id } = req.params;
    const imageFile = req.files?.image?.[0] ?? req.file ?? null;
    if (!imageFile?.buffer) {
      return res.status(400).json({ error: 'image file is required' });
    }
    const url = await blogService.uploadContentImage(id, imageFile);
    res.status(200).json({ url });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/blog/:id/status
 * Update blog publication status.
 * Body: { status: 'draft' | 'published' }
 */
export async function updateBlogStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }
    const blog = await blogService.updateBlogStatus(id, status);
    res.status(200).json(blog);
  } catch (err) {
    next(err);
  }
}
