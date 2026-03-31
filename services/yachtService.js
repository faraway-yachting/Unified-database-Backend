import { prisma } from '../config/database.js';
import { s3Config } from './s3Service.js';

function extractS3KeyFromUrl(url) {
  if (!url) return null;
  if (url.startsWith('s3://')) {
    const parts = url.replace('s3://', '').split('/');
    return parts.length > 1 ? parts.slice(1).join('/') : null;
  }
  try {
    const u = new URL(url);
    const pathParts = u.pathname.split('/').filter(Boolean);
    if (pathParts.length === 0) return null;
    if (s3Config.bucket && pathParts[0] === s3Config.bucket) {
      return pathParts.slice(1).join('/');
    }
    return pathParts.join('/');
  } catch (_) {
    return null;
  }
}

function resolveImageUrl(url) {
  if (!url) return url;
  if (url.startsWith('https://') || url.startsWith('http://')) return url;
  if (url.startsWith('s3://')) {
    const key = extractS3KeyFromUrl(url);
    if (!key) return url;
    if (s3Config.publicUrl) return `${s3Config.publicUrl.replace(/\/$/, '')}/${key}`;
    if (s3Config.bucket) return `https://${s3Config.bucket}.s3.${s3Config.region || 'us-east-1'}.amazonaws.com/${key}`;
  }
  return url;
}

function flattenTags(yachts) {
  yachts.forEach(y => {
    if (Array.isArray(y.tags)) {
      y.tags = y.tags.map(t => t.tag);
    }
  });
}

function flattenYachtTags(yachts) {
  yachts.forEach((y) => {
    if (Array.isArray(y.tags)) {
      y.tags = y.tags.map((t) => t.tag);
    }
  });
}

async function attachPresignedUrlsToYachts(yachts) {
  if (!s3Config.bucket) return yachts;
  yachts.forEach((yacht) => {
    if (yacht?.primaryImage) {
      yacht.primaryImage = resolveImageUrl(yacht.primaryImage);
    }
    if (yacht?.images?.length) {
      yacht.images.forEach((img) => {
        img.imageUrl = resolveImageUrl(img.imageUrl);
      });
    }
  });
  return yachts;
}

/**
 * List all yachts with optional filtering and pagination.
 * @param {object} options - { regionId, type, status, minCapacity, maxCapacity, isActive, page, limit, includeRelations }
 * @returns {Promise<{ yachts: Array, total: number, page: number, limit: number }>}
 */
export async function listYachts(options = {}) {
  const {
    regionId,
    type,
    charterType,
    tags,
    status,
    minCapacity,
    maxCapacity,
    isActive,
    page = 1,
    limit = 50,
    includeCompany = true,
    includeRegion = true,
    includeImages = false,
    includeTags = true,
    includeTranslations = true,
  } = options;

  const skip = (page - 1) * limit;
  const where = {};

  if (regionId) where.regionId = regionId;
  if (type) where.type = type;
  if (charterType) where.charterType = charterType;
  if (tags) {
    const tagList = Array.isArray(tags) ? tags : [tags];
    where.tags = { some: { tag: { in: tagList } } };
  }
  if (status) where.status = status;
  if (isActive !== undefined) where.isActive = isActive === 'true' || isActive === true;

  // Capacity filtering
  if (minCapacity !== undefined) {
    where.capacityGuests = { gte: parseInt(minCapacity, 10) };
  }
  if (maxCapacity !== undefined) {
    if (where.capacityGuests) {
      where.capacityGuests.lte = parseInt(maxCapacity, 10);
    } else {
      where.capacityGuests = { lte: parseInt(maxCapacity, 10) };
    }
  }

  const include = {};
  if (includeCompany) {
    include.company = {
      select: {
        id: true,
        name: true,
        logoUrl: true,
      },
    };
  }
  if (includeRegion) {
    include.region = {
      select: {
        id: true,
        name: true,
        slug: true,
      },
    };
  }
  if (includeImages) {
    include.images = {
      orderBy: { sortOrder: 'asc' },
    };
  }
  if (includeTags) {
    include.tags = {
      orderBy: [{ locale: 'asc' }, { tag: 'asc' }],
    };
  }
  if (includeTranslations) {
    include.translations = {
      orderBy: { locale: 'asc' },
    };
  }

  const [yachts, total] = await Promise.all([
    prisma.yacht.findMany({
      where,
      include: Object.keys(include).length > 0 ? include : undefined,
      orderBy: [
        { displayOrder: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      skip,
      take: limit,
    }),
    prisma.yacht.count({ where }),
  ]);

  await attachPresignedUrlsToYachts(yachts);

  return {
    yachts,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get a single yacht by ID.
 * @param {string} id - Yacht UUID
 * @param {object} options - { includeCompany, includeRegion, includeImages, includeAmenities }
 * @returns {Promise<object>}
 */
export async function getYachtById(id, options = {}) {
  const {
    includeCompany = true,
    includeRegion = true,
    includeImages = true,
    includeAmenities = false,
    includeTags = true,
    includeTranslations = true,
  } = options;

  const include = {};
  if (includeCompany) {
    include.company = {
      select: {
        id: true,
        name: true,
        logoUrl: true,
        contactEmail: true,
        contactPhone: true,
      },
    };
  }
  if (includeRegion) {
    include.region = true;
  }
  if (includeImages) {
    include.images = {
      orderBy: { sortOrder: 'asc' },
    };
  }
  if (includeAmenities) {
    include.amenities = true;
  }
  if (includeTags) {
    include.tags = {
      orderBy: [{ locale: 'asc' }, { tag: 'asc' }],
    };
  }
  if (includeTranslations) {
    include.translations = {
      orderBy: { locale: 'asc' },
    };
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const inc = Object.keys(include).length > 0 ? include : undefined;
  let yacht = await prisma.yacht.findUnique({
    where: isUuid ? { id } : { slug: id },
    include: inc,
  });
  if (!yacht && !isUuid) {
    const tr = await prisma.yachtTranslation.findFirst({ where: { slug: id } });
    if (tr) yacht = await prisma.yacht.findUnique({ where: { id: tr.yachtId }, include: inc });
  }
  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  await attachPresignedUrlsToYachts([yacht]);

  return yacht;
}

/**
 * Get full yacht details by ID, including related data.
 * @param {string} id - Yacht UUID
 * @returns {Promise<object>}
 */
export async function getYachtDetail(id) {
  const yacht = await prisma.yacht.findUnique({
    where: { id },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          contactEmail: true,
          contactPhone: true,
        },
      },
      region: true,
      images: {
        orderBy: { sortOrder: 'asc' },
      },
      tags: {
        orderBy: [{ locale: 'asc' }, { tag: 'asc' }],
      },
      translations: {
        orderBy: { locale: 'asc' },
      },
      amenities: {
        orderBy: [
          { category: 'asc' },
          { name: 'asc' },
        ],
      },
      documents: {
        orderBy: [
          { documentType: 'asc' },
          { issuedDate: 'desc' },
        ],
      },
      maintenance: {
        orderBy: { scheduledDate: 'desc' },
      },
      availabilityBlocks: {
        orderBy: { startDate: 'asc' },
      },
      packages: {
        orderBy: { createdAt: 'desc' },
      },
      bookings: {
        orderBy: { startDate: 'desc' },
      },
      leads: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  await attachPresignedUrlsToYachts([yacht]);

  return yacht;
}

/**
 * Create a new yacht.
 * @param {object} data - Yacht data
 * @returns {Promise<object>}
 */
export async function createYacht(data) {
  const {
    companyId,
    name,
    type,
    lengthM,
    beamM,
    capacityGuests,
    capacityCrew,
    yearBuilt,
    engineType,
    engineHp,
    cruiseSpeedKnots,
    fuelCapacityL,
    homePort,
    regionId,
    status = 'available',
    isActive = true,
  } = data;

  // Validate required fields
  if (!companyId || !name || !type || !capacityGuests || !regionId) {
    const err = new Error('companyId, name, type, capacityGuests, and regionId are required');
    err.status = 400;
    throw err;
  }

  // Validate type
  const validTypes = ['bareboat', 'crewed'];
  if (!validTypes.includes(type)) {
    const err = new Error(`Type must be one of: ${validTypes.join(', ')}`);
    err.status = 400;
    throw err;
  }

  // Validate status
  const validStatuses = ['available', 'booked', 'maintenance', 'retired'];
  if (status && !validStatuses.includes(status)) {
    const err = new Error(`Status must be one of: ${validStatuses.join(', ')}`);
    err.status = 400;
    throw err;
  }

  // Verify company exists
  const company = await prisma.charterCompany.findUnique({
    where: { id: companyId },
  });

  if (!company) {
    const err = new Error(`Charter company with id "${companyId}" not found`);
    err.status = 400;
    throw err;
  }

  // Verify region exists
  const region = await prisma.region.findUnique({
    where: { id: regionId },
  });

  if (!region) {
    const err = new Error(`Region with id "${regionId}" not found`);
    err.status = 400;
    throw err;
  }

  const yacht = await prisma.yacht.create({
    data: {
      companyId,
      name,
      type,
      lengthM: lengthM ? parseFloat(lengthM) : null,
      beamM: beamM ? parseFloat(beamM) : null,
      capacityGuests: parseInt(capacityGuests, 10),
      capacityCrew: capacityCrew ? parseInt(capacityCrew, 10) : null,
      yearBuilt: yearBuilt ? parseInt(yearBuilt, 10) : null,
      engineType,
      engineHp: engineHp ? parseInt(engineHp, 10) : null,
      cruiseSpeedKnots: cruiseSpeedKnots ? parseFloat(cruiseSpeedKnots) : null,
      fuelCapacityL: fuelCapacityL ? parseInt(fuelCapacityL, 10) : null,
      homePort,
      regionId,
      status,
      isActive,
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
        },
      },
      region: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  return yacht;
}

/**
 * Update a yacht.
 * @param {string} id - Yacht UUID
 * @param {object} data - Partial yacht data
 * @returns {Promise<object>}
 */
export async function updateYacht(id, data, files = {}) {
  const existingYacht = await prisma.yacht.findUnique({ where: { id } });
  if (!existingYacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  const {
    companyId, name, type,
    lengthM, beamM, capacityGuests, capacityCrew, yearBuilt,
    engineType, engineHp, cruiseSpeedKnots, fuelCapacityL, homePort, regionId, isActive,
    title, slug, charterType,
    boat_type, price_category, capacity, length, length_range,
    cabins, bathrooms, passenger_day_trip, passenger_overnight,
    guests, guests_range, day_trip_price, overnight_price, daytrip_price_euro,
    video_link, badge, design, built, cruising_speed, length_overall,
    fuel_capacity, water_capacity, code, primary_image, display_order,
    day_charter, overnight_charter, about_this_boat, specifications, boat_layout,
  } = data;

  const str = (v) => (v !== undefined && v !== null && v !== '') ? String(v) : undefined;

  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (title !== undefined) updateData.title = str(title) ?? null;
  if (slug !== undefined) updateData.slug = str(slug) ?? null;
  if (charterType !== undefined) updateData.charterType = str(charterType) ?? null;
  if (boat_type !== undefined) updateData.boatType = str(boat_type) ?? null;
  if (price_category !== undefined) updateData.price = str(price_category) ?? null;
  if (capacity !== undefined) updateData.capacity = str(capacity) ?? null;
  if (length !== undefined) updateData.length = str(length) ?? null;
  if (length_range !== undefined) updateData.lengthRange = str(length_range) ?? null;
  if (cabins !== undefined) updateData.cabins = str(cabins) ?? null;
  if (bathrooms !== undefined) updateData.bathrooms = str(bathrooms) ?? null;
  if (passenger_day_trip !== undefined) updateData.passengerDayTrip = str(passenger_day_trip) ?? null;
  if (passenger_overnight !== undefined) updateData.passengerOvernight = str(passenger_overnight) ?? null;
  if (guests !== undefined) updateData.guests = str(guests) ?? null;
  if (guests_range !== undefined) updateData.guestsRange = str(guests_range) ?? null;
  if (day_trip_price !== undefined) updateData.dayTripPrice = str(day_trip_price) ?? null;
  if (overnight_price !== undefined) updateData.overnightPrice = str(overnight_price) ?? null;
  if (daytrip_price_euro !== undefined) updateData.daytripPriceEuro = str(daytrip_price_euro) ?? null;
  if (video_link !== undefined) updateData.videoLink = str(video_link) ?? null;
  if (badge !== undefined) updateData.badge = str(badge) ?? null;
  if (design !== undefined) updateData.design = str(design) ?? null;
  if (built !== undefined) updateData.built = str(built) ?? null;
  if (cruising_speed !== undefined) updateData.cruisingSpeed = str(cruising_speed) ?? null;
  if (length_overall !== undefined) updateData.lengthOverall = str(length_overall) ?? null;
  if (fuel_capacity !== undefined) updateData.fuelCapacity = str(fuel_capacity) ?? null;
  if (water_capacity !== undefined) updateData.waterCapacity = str(water_capacity) ?? null;
  if (code !== undefined) updateData.code = str(code) ?? null;
  if (display_order !== undefined) updateData.displayOrder = (display_order !== '' && display_order !== null) ? parseInt(display_order, 10) : null;
  if (primary_image !== undefined && typeof primary_image === 'string' && primary_image.startsWith('s3://')) {
    updateData.primaryImage = primary_image;
  }
  if (lengthM !== undefined) updateData.lengthM = lengthM ? parseFloat(lengthM) : null;
  if (beamM !== undefined) updateData.beamM = beamM ? parseFloat(beamM) : null;
  if (capacityGuests !== undefined) updateData.capacityGuests = parseInt(capacityGuests, 10);
  if (capacityCrew !== undefined) updateData.capacityCrew = capacityCrew ? parseInt(capacityCrew, 10) : null;
  if (yearBuilt !== undefined) updateData.yearBuilt = yearBuilt ? parseInt(yearBuilt, 10) : null;
  if (engineType !== undefined) updateData.engineType = engineType;
  if (engineHp !== undefined) updateData.engineHp = engineHp ? parseInt(engineHp, 10) : null;
  if (cruiseSpeedKnots !== undefined) updateData.cruiseSpeedKnots = cruiseSpeedKnots ? parseFloat(cruiseSpeedKnots) : null;
  if (fuelCapacityL !== undefined) updateData.fuelCapacityL = fuelCapacityL ? parseInt(fuelCapacityL, 10) : null;
  if (homePort !== undefined) updateData.homePort = homePort;
  if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true;

  if (type !== undefined) {
    const validTypes = ['bareboat', 'crewed'];
    if (!validTypes.includes(type)) {
      const err = new Error(`Type must be one of: ${validTypes.join(', ')}`);
      err.status = 400;
      throw err;
    }
    updateData.type = type;
  }

  if (companyId !== undefined && companyId !== existingYacht.companyId) {
    const company = await prisma.charterCompany.findUnique({ where: { id: companyId } });
    if (!company) {
      const err = new Error(`Charter company with id "${companyId}" not found`);
      err.status = 400;
      throw err;
    }
    updateData.companyId = companyId;
  }

  if (regionId !== undefined && regionId !== existingYacht.regionId) {
    const region = await prisma.region.findUnique({ where: { id: regionId } });
    if (!region) {
      const err = new Error(`Region with id "${regionId}" not found`);
      err.status = 400;
      throw err;
    }
    updateData.regionId = regionId;
  }

  const hasTranslationData = [day_charter, overnight_charter, about_this_boat, specifications, boat_layout, title, slug].some(v => v !== undefined);

  // Only update the main yacht record for the base locale (en), not for translations
  const translationLocale = data.locale && data.locale !== '' ? data.locale : 'en';
  const isBaseLocale = translationLocale === 'en';

  let yacht;
  if (isBaseLocale) {
    yacht = await prisma.yacht.update({
      where: { id },
      data: updateData,
      include: {
        company: { select: { id: true, name: true, logoUrl: true } },
        region: { select: { id: true, name: true, slug: true } },
        translations: true,
        tags: true,
      },
    });
  } else {
    yacht = await prisma.yacht.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true, logoUrl: true } },
        region: { select: { id: true, name: true, slug: true } },
        translations: true,
        tags: true,
      },
    });
  }

  if (hasTranslationData) {
    const translationData = {};
    if (title !== undefined) translationData.title = str(title) ?? null;
    const slugVal = str(slug) ?? null;
    if (slug !== undefined) translationData.slug = slugVal;
    if (day_charter !== undefined && day_charter !== '') translationData.dayCharter = day_charter;
    if (overnight_charter !== undefined && overnight_charter !== '') translationData.overnightCharter = overnight_charter;
    if (about_this_boat !== undefined && about_this_boat !== '') translationData.aboutThisBoat = about_this_boat;
    if (specifications !== undefined && specifications !== '') translationData.specifications = specifications;
    if (boat_layout !== undefined && boat_layout !== '') translationData.boatLayout = boat_layout;
    const existing = await prisma.yachtTranslation.findUnique({
      where: { yachtId_locale: { yachtId: id, locale: translationLocale } },
    });
    if (existing) {
      await prisma.yachtTranslation.update({
        where: { yachtId_locale: { yachtId: id, locale: translationLocale } },
        data: translationData,
      });
    } else {
      await prisma.yachtTranslation.create({
        data: { yachtId: id, locale: translationLocale, ...translationData },
      });
    }
  }

  const rawTags = data['tags[]'];
  if (rawTags !== undefined) {
    const tagList = Array.isArray(rawTags) ? rawTags : rawTags ? [rawTags] : [];
    await prisma.yachtTag.deleteMany({ where: { yachtId: id, locale: 'en' } });
    if (tagList.length > 0) {
      await prisma.yachtTag.createMany({
        data: tagList.map(tag => ({ yachtId: id, locale: 'en', tag: String(tag).trim() })),
        skipDuplicates: true,
      });
    }
  }

  if (files.primary_image) {
    const { uploadFile: uploadToS3, generateS3Key, deleteFile: deleteS3File } = await import('./s3Service.js');
    const oldKey = existingYacht.primaryImage ? extractS3KeyFromUrl(existingYacht.primaryImage) : null;
    const file = files.primary_image;
    const s3Key = generateS3Key(file.originalname, `yachts/Primary-Images/${id}`);
    const result = await uploadToS3(file.buffer, s3Key, file.mimetype, {});
    await prisma.yacht.update({ where: { id }, data: { primaryImage: result.url } });
    if (oldKey) { try { await deleteS3File(oldKey); } catch (_) {} }
  }

  if (data['gallery_images_managed'] === 'true') {
    const rawUrls = data['gallery_image_urls'];
    const survivingUrls = rawUrls ? (Array.isArray(rawUrls) ? rawUrls : [rawUrls]) : [];
    const survivingKeys = new Set(survivingUrls.map(u => extractS3KeyFromUrl(u.split('?')[0]) ?? u.split('?')[0]));
    const currentImages = await prisma.yachtImage.findMany({ where: { yachtId: id } });
    const toDelete = currentImages.filter(img => {
      const key = extractS3KeyFromUrl(img.imageUrl.split('?')[0]) ?? img.imageUrl.split('?')[0];
      return !survivingKeys.has(key);
    });
    if (toDelete.length > 0) {
      const { deleteFile: deleteS3File } = await import('./s3Service.js');
      for (const img of toDelete) {
        const s3Key = extractS3KeyFromUrl(img.imageUrl);
        if (s3Key) { try { await deleteS3File(s3Key); } catch (_) {} }
        await prisma.yachtImage.delete({ where: { id: img.id } });
      }
    }
  }

  if (files.gallery_images && files.gallery_images.length > 0) {
    const { uploadYachtImages } = await import('./yachtImageService.js');
    await uploadYachtImages(id, files.gallery_images, { isCover: false });
  }

  return prisma.yacht.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true, logoUrl: true } },
      region: { select: { id: true, name: true, slug: true } },
      translations: true,
      tags: true,
    },
  });
}

/**
 * Soft delete a yacht (set isActive to false and status to retired).
 * @param {string} id - Yacht UUID
 * @returns {Promise<object>}
 */
export async function softDeleteYacht(id) {
  const yacht = await prisma.yacht.findUnique({
    where: { id },
  });

  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  const updatedYacht = await prisma.yacht.update({
    where: { id },
    data: {
      isActive: false,
      status: 'retired',
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
        },
      },
      region: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return updatedYacht;
}

/**
 * Update yacht status.
 * @param {string} id - Yacht UUID
 * @param {string} status - New status
 * @returns {Promise<object>}
 */
export async function updateYachtStatus(id, status) {
  const validStatuses = ['available', 'booked', 'maintenance', 'retired'];
  if (!validStatuses.includes(status)) {
    const err = new Error(`Status must be one of: ${validStatuses.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const yacht = await prisma.yacht.findUnique({
    where: { id },
  });

  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  const updatedYacht = await prisma.yacht.update({
    where: { id },
    data: { status },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
        },
      },
      region: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  return updatedYacht;
}
