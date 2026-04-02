import express from 'express';
import { listYachts, getYachtById } from '../services/yachtService.js';
import { getPresignedUrl, s3Config } from '../services/s3Service.js';

const router = express.Router();

const PRESIGNED_EXPIRY = 60 * 60 * 24; // 24 hours

/**
 * Extract the S3 key from any image URL format:
 *   s3://bucket/key  →  key
 *   https://bucket.s3.region.amazonaws.com/key  →  key
 *   https://publicUrl/key  →  key
 * Returns null if not an S3 URL.
 */
function extractS3Key(url) {
  if (!url) return null;

  // s3:// protocol
  if (url.startsWith('s3://')) {
    const parts = url.replace('s3://', '').split('/');
    return parts.length > 1 ? parts.slice(1).join('/') : null;
  }

  // https:// — check if it's an S3 or configured public URL
  if (url.startsWith('https://') || url.startsWith('http://')) {
    try {
      const u = new URL(url);
      const isS3Host = u.hostname.includes('.amazonaws.com');
      const isPublicUrl =
        s3Config.publicUrl && url.startsWith(s3Config.publicUrl.replace(/\/$/, ''));

      if (isS3Host || isPublicUrl) {
        const pathParts = u.pathname.split('/').filter(Boolean);
        // If the first segment is the bucket name, strip it
        if (s3Config.bucket && pathParts[0] === s3Config.bucket) {
          return pathParts.slice(1).join('/');
        }
        return pathParts.join('/');
      }
    } catch (_) {}
  }

  return null;
}

/**
 * Resolve an image URL to a presigned URL if it's an S3 object,
 * otherwise return as-is.
 */
async function resolveUrl(url) {
  if (!url || !s3Config.bucket) return url;
  const key = extractS3Key(url);
  if (!key) return url;
  try {
    return await getPresignedUrl(key, PRESIGNED_EXPIRY);
  } catch {
    return url;
  }
}

// Map frontend locale codes to database locale codes
const LOCALE_MAP = { cn: 'zh' };
function dbLocale(locale) {
  return LOCALE_MAP[locale] || locale;
}

/**
 * Map a Prisma Yacht object to the phuket-sailing frontend Yacht shape,
 * with all S3 image URLs replaced by 24-hour presigned URLs.
 */
async function mapYacht(yacht, locale = 'en') {
  const resolvedLocale = dbLocale(locale);
  const translation =
    yacht.translations?.find((t) => t.locale === resolvedLocale) ||
    yacht.translations?.find((t) => t.locale === 'en') ||
    yacht.translations?.[0] ||
    {};

  const primaryImage = await resolveUrl(yacht.primaryImage);
  const galleryImages = await Promise.all(
    (yacht.images || []).map((img) => resolveUrl(img.imageUrl))
  );

  return {
    _id: yacht.id,
    title: translation.title || yacht.title || yacht.name,
    slug: translation.slug || yacht.slug,
    primaryImage: primaryImage || null,
    galleryImages: galleryImages.filter(Boolean),
    length: yacht.length,
    guests: yacht.guests,
    cabins: yacht.cabins,
    bathrooms: yacht.bathrooms,
    dayTripPrice: yacht.dayTripPrice,
    overnightPrice: yacht.overnightPrice,
    passengerDayTrip: yacht.passengerDayTrip,
    passengerOvernight: yacht.passengerOvernight,
    boatType: yacht.boatType,
    charterType: yacht.charterType,
    status: yacht.status,
    type: yacht.type,
    price: yacht.price,
    capacity: yacht.capacity,
    lengthRange: yacht.lengthRange,
    guestsRange: yacht.guestsRange,
    daytripPriceEuro: yacht.daytripPriceEuro,
    dayCharter: translation.dayCharter || null,
    overnightCharter: translation.overnightCharter || null,
    aboutThisBoat: translation.aboutThisBoat || null,
    specifications: translation.specifications || null,
    boatLayout: translation.boatLayout || null,
    videoLink: yacht.videoLink,
    badge: yacht.badge,
    design: yacht.design,
    built: yacht.built,
    cruisingSpeed: yacht.cruisingSpeed,
    lengthOverall: yacht.lengthOverall,
    fuelCapacity: yacht.fuelCapacity,
    waterCapacity: yacht.waterCapacity,
    code: yacht.code,
    tags: (() => {
      const allTags = yacht.tags || [];
      const localeTags = allTags.filter((t) => t.locale === resolvedLocale);
      const result = localeTags.length > 0 ? localeTags : allTags.filter((t) => t.locale === 'en');
      return result.map((t) => t.tag);
    })(),
  };
}

/**
 * GET /api/public/yachts
 * Public listing — no auth required.
 * Query params: page, limit, locale, charterType
 */
router.get('/yachts', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const locale = req.query.locale || 'en';
    const { charterType, regionSlug } = req.query;

    const result = await listYachts({
      isActive: true,
      excludeStatuses: ['retired'],
      charterType,
      regionSlug,
      page,
      limit,
      includeImages: true,
      includeCompany: false,
      includeRegion: false,
      includeTags: true,
      includeTranslations: true,
    });

    const yachts = await Promise.all(result.yachts.map((y) => mapYacht(y, locale)));

    res.json({
      success: true,
      data: {
        yachts,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/public/yachts/:slug
 * Public single yacht by slug or UUID — no auth required.
 * Query params: locale
 */
router.get('/yachts/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const locale = req.query.locale || 'en';

    const yacht = await getYachtById(slug, {
      includeImages: true,
      includeCompany: false,
      includeRegion: false,
      includeTags: true,
      includeTranslations: true,
    });

    if (!yacht.isActive || yacht.status === 'retired') {
      const err = new Error('Yacht not found');
      err.status = 404;
      throw err;
    }

    res.json(await mapYacht(yacht, locale));
  } catch (err) {
    next(err);
  }
});

export default router;
