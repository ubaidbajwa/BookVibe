/**
 * @file Property Controller
 * @description Handles property listings, updates, deletions, and search functionality.
 */

import PropertyModel from "../models/PropertyModel.js";
import BookingModel from "../models/BookingModel.js";
import cloudinary from "../middlewares/cloudinary.js";
import redis from "../config/redis.js";

const ACTIVE_STATUSES = ['pending', 'confirmed', 'staying'];

// Section: Helper Functions

const parsePricingFields = (body, basePrice) => {
  const price = Number(basePrice) || 0;
  const weeklyPrice = Number(body.weeklyPrice) || 0;
  const monthlyPrice = Number(body.monthlyPrice) || 0;

  const weeklyDiscount = price && weeklyPrice
    ? Math.round(((price * 7 - weeklyPrice) / (price * 7)) * 100)
    : 0;
  const monthlyDiscount = price && monthlyPrice
    ? Math.round(((price * 30 - monthlyPrice) / (price * 30)) * 100)
    : 0;

  let stayTypes = ['nightly'];
  try {
    stayTypes = typeof body.stayTypes === 'string'
      ? JSON.parse(body.stayTypes)
      : body.stayTypes;
  } catch { stayTypes = ['nightly']; }

  return {
    pricing: {
      nightly: price,
      weekly: weeklyPrice || undefined,
      monthly: monthlyPrice || undefined,
      weeklyDiscount,
      monthlyDiscount,
    },
    stayTypes: Array.isArray(stayTypes) ? stayTypes : ['nightly'],
    minStay: Number(body.minStay) || 1,
    maxStay: Number(body.maxStay) || 365,
  };
};

const parseTimeFields = (body) => ({
  checkInTime: body.checkInTime || '14:00',
  checkOutTime: body.checkOutTime || '11:00',
  flexibleCheckIn: body.flexibleCheckIn === 'true' || body.flexibleCheckIn === true,
});

const parseHouseRules = (body) => {
  let customRules = [];
  try {
    customRules = typeof body.customRules === 'string'
      ? JSON.parse(body.customRules)
      : (body.customRules || []);
  } catch { customRules = []; }

  return {
    houseRules: {
      smokingAllowed: body.smokingAllowed === 'true' || body.smokingAllowed === true,
      petsAllowed: body.petsAllowed === 'true' || body.petsAllowed === true,
      partiesAllowed: body.partiesAllowed === 'true' || body.partiesAllowed === true,
      quietHoursStart: body.quietHoursStart || '22:00',
      quietHoursEnd: body.quietHoursEnd || '07:00',
      maxGuests: Number(body.maxGuests) || 2,
      customRules,
    },
    damagePolicy: {
      depositRequired: body.depositRequired === 'true' || body.depositRequired === true,
      depositAmount: Number(body.depositAmount) || 0,
      damageRules: body.damageRules || '',
    },
    cancellationPolicy: body.cancellationPolicy || 'moderate',
    onlyVerifiedGuests: body.onlyVerifiedGuests === 'true' || body.onlyVerifiedGuests === true,
  };
};

const parseServiceFields = (body) => {
  const parseService = (value, fallbackTitle) => {
    if (!value) return { available: false, title: "", description: "", price: 0 };
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      return {
        available: parsed.available === true || parsed.available === 'true',
        title: parsed.title || fallbackTitle,
        description: parsed.description || "",
        price: Number(parsed.price) || 0,
      };
    } catch {
      return { available: false, title: "", description: "", price: 0 };
    }
  };

  return {
    foodServices: parseService(body.foodServices, 'Homemade Food'),
    medicalServices: parseService(body.medicalServices, 'Medical Service'),
  };
};

const clearPropertyCache = async () => {
  try {
    const keys = await redis.keys('bv:props:*');
    if (keys.length > 0) await redis.del(keys);
  } catch (error) {}
};

// Section: Property Operations

export const addProperty = async (req, res) => {
  try {
    const {
      name, accommodationType, city, country,
      address, latitude, longitude, price,
      amenities, description, listingType
    } = req.body;

    const hostBy = req.user._id;

    if (!name || !accommodationType || !city || !country || !address || !price || !description) {
      return res.status(400).json({ message: "Required fields missing", success: false });
    }

    let imageUrls = [];
    if (req.files?.images) {
      let images = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
      const uploads = images.map(img => cloudinary.uploader.upload(img.tempFilePath, { folder: "BookVibe-Property" }));
      const results = await Promise.all(uploads);
      imageUrls = results.map(img => ({ public_id: img.public_id, url: img.secure_url }));
    }

    // Parse Complex Fields
    let subUnits = [];
    try {
      subUnits = typeof req.body.subUnits === 'string' ? JSON.parse(req.body.subUnits) : (req.body.subUnits || []);
    } catch { subUnits = []; }

    // Process sub-unit images
    if (listingType === 'multi' && subUnits.length > 0) {
      for (let i = 0; i < subUnits.length; i++) {
        const fileKey = `subunit_images_${i}`;
        if (req.files?.[fileKey]) {
          let unitFiles = Array.isArray(req.files[fileKey]) ? req.files[fileKey] : [req.files[fileKey]];
          const unitUploads = unitFiles.map(img => cloudinary.uploader.upload(img.tempFilePath, { folder: "BookVibe-Property-Units" }));
          const unitResults = await Promise.all(unitUploads);
          subUnits[i].images = unitResults.map(img => ({ public_id: img.public_id, url: img.secure_url }));
        }
      }
    }

    // Logic: If Single Space, we create a default sub-unit automatically
    if (listingType === 'single' && subUnits.length === 0) {
      subUnits.push({
        name: "Entire Space",
        unitType: "Entire Home",
        basePrice: Number(price),
        capacity: Number(req.body.maxGuests) || 2,
        amenities: [],
        available: true
      });
    }

    let addOnServices = [];
    try {
      addOnServices = typeof req.body.addOnServices === 'string' ? JSON.parse(req.body.addOnServices) : (req.body.addOnServices || []);
    } catch { addOnServices = []; }

    let parsedAmenities = [];
    try {
      parsedAmenities = typeof amenities === 'string' ? JSON.parse(amenities) : (amenities || []);
    } catch { parsedAmenities = amenities?.split(',').map(a => a.trim()).filter(Boolean) || []; }

    const property = await PropertyModel.create({
      name,
      listingType: listingType || 'single',
      type: accommodationType,
      city, country, address,
      coordinates: { lat: Number(latitude) || 0, lng: Number(longitude) || 0 },
      price: Number(price),
      subUnits,
      addOnServices,
      amenities: parsedAmenities,
      description,
      hostBy,
      images: imageUrls,
      verificationStatus: req.user.isVerified === 'verified' ? 'verified' : 'pending',
      ...parsePricingFields(req.body, price),
      ...parseTimeFields(req.body),
      ...parseHouseRules(req.body),
      ...parseServiceFields(req.body),
    });

    await clearPropertyCache();
    return res.status(201).json({ message: "Property added", success: true, property });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error", success: false });
  }
};

export const updateProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await PropertyModel.findById(id);
    if (!existing || existing.hostBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized", success: false });
    }

    const {
      name, type, accommodationType, city, country, address,
      latitude, longitude, price, amenities, description,
      subUnits, addOnServices,
    } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (type || accommodationType) updateData.type = type || accommodationType;
    if (city) updateData.city = city;
    if (country) updateData.country = country;
    if (address) updateData.address = address;
    if (price) updateData.price = Number(price);
    if (description) updateData.description = description;

    if (subUnits) {
      try { 
        let parsedSubUnits = typeof subUnits === 'string' ? JSON.parse(subUnits) : subUnits; 
        
        // If single space and no subunits provided, ensure default subunit exists
        if (existing.listingType === 'single' && (!parsedSubUnits || parsedSubUnits.length === 0)) {
          parsedSubUnits = [{
            name: "Entire Space",
            unitType: "Entire Home",
            basePrice: Number(price || existing.price),
            capacity: Number(req.body.maxGuests) || existing.houseRules?.maxGuests || 2,
            amenities: [],
            available: true
          }];
        }

        // Process sub-unit images (for update)
        if (parsedSubUnits && parsedSubUnits.length > 0) {
          for (let i = 0; i < parsedSubUnits.length; i++) {
            const fileKey = `subunit_images_${i}`;
            const existingUnit = existing.subUnits[i];
            
            // Start with existing images if they weren't removed on client
            const unitImages = (parsedSubUnits[i].images || []).filter(img => img.url);

            if (req.files?.[fileKey]) {
              let unitFiles = Array.isArray(req.files[fileKey]) ? req.files[fileKey] : [req.files[fileKey]];
              const unitUploads = unitFiles.map(img => cloudinary.uploader.upload(img.tempFilePath, { folder: "BookVibe-Property-Units" }));
              const unitResults = await Promise.all(unitUploads);
              const newUnitImages = unitResults.map(img => ({ public_id: img.public_id, url: img.secure_url }));
              unitImages.push(...newUnitImages);
            }
            
            parsedSubUnits[i].images = unitImages;
          }
        }

        updateData.subUnits = parsedSubUnits;
      } catch {}
    }
    if (addOnServices) {
      try { updateData.addOnServices = typeof addOnServices === 'string' ? JSON.parse(addOnServices) : addOnServices; } catch {}
    }
    if (amenities) {
      try { updateData.amenities = typeof amenities === 'string' ? JSON.parse(amenities) : amenities; } catch {}
    }
    if (latitude && longitude) {
      updateData.coordinates = { lat: Number(latitude), lng: Number(longitude) };
    }

    Object.assign(updateData, 
      parsePricingFields(req.body, price || existing.price),
      parseTimeFields(req.body),
      parseHouseRules(req.body),
      parseServiceFields(req.body)
    );

    // Merge existing images the host chose to keep with any newly uploaded ones
    let keptImages = [];
    try {
      keptImages = typeof req.body.existingImages === 'string'
        ? JSON.parse(req.body.existingImages)
        : (req.body.existingImages || []);
    } catch { keptImages = []; }

    let newImageUrls = [];
    if (req.files?.images) {
      const imgs = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
      const results = await Promise.all(imgs.map(img => cloudinary.uploader.upload(img.tempFilePath, { folder: "BookVibe-Property" })));
      newImageUrls = results.map(img => ({ public_id: img.public_id, url: img.secure_url }));
    }

    if (keptImages.length > 0 || newImageUrls.length > 0) {
      updateData.images = [...keptImages, ...newImageUrls];
    }

    const property = await PropertyModel.findByIdAndUpdate(id, updateData, { new: true });
    await clearPropertyCache();
    return res.status(200).json({ message: "Property updated", success: true, property });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error", success: false });
  }
};

export const getHostProperties = async (req, res) => {
  try {
    const properties = await PropertyModel.find({ hostBy: req.user._id }).sort({ createdAt: -1 });
    return res.json({ success: true, properties });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPropertyById = async (req, res) => {
  try {
    const property = await PropertyModel.findById(req.params.id).populate('hostBy', 'username profileImage phone');
    if (!property) return res.status(404).json({ success: false, message: "Not found" });
    return res.json({ success: true, property });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteProperty = async (req, res) => {
  try {
    const property = await PropertyModel.findById(req.params.id);
    if (!property || property.hostBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const activeCount = await BookingModel.countDocuments({
      propertyId: req.params.id,
      bookingStatus: { $in: ACTIVE_STATUSES },
    });
    if (activeCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete — this property has ${activeCount} active or upcoming booking(s). Cancel them first.`,
      });
    }

    // Delete all Cloudinary assets (property + sub-unit images) before removing the doc
    const allImages = [
      ...(property.images || []),
      ...(property.subUnits || []).flatMap(unit => unit.images || []),
    ];
    if (allImages.length > 0) {
      await Promise.allSettled(allImages.map(img => cloudinary.uploader.destroy(img.public_id)));
    }

    await PropertyModel.findByIdAndDelete(req.params.id);
    await clearPropertyCache();
    return res.json({ success: true, message: "Property deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleAvailability = async (req, res) => {
  try {
    const property = await PropertyModel.findById(req.params.id);
    if (!property || property.hostBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }
    property.available = !property.available;
    await property.save();
    await clearPropertyCache();
    return res.json({ success: true, available: property.available });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleSubUnitAvailability = async (req, res) => {
  try {
    const property = await PropertyModel.findById(req.params.id);
    if (!property || property.hostBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }
    const unit = property.subUnits.id(req.params.unitId);
    if (!unit) {
      return res.status(404).json({ success: false, message: "Unit not found" });
    }
    unit.available = !unit.available;
    await property.save();
    await clearPropertyCache();
    return res.json({ success: true, available: unit.available, property });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteSubUnit = async (req, res) => {
  try {
    const property = await PropertyModel.findById(req.params.id);
    if (!property || property.hostBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const activeCount = await BookingModel.countDocuments({
      propertyId: req.params.id,
      subUnitId: req.params.unitId,
      bookingStatus: { $in: ACTIVE_STATUSES },
    });
    if (activeCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete — this room has ${activeCount} active or upcoming booking(s). Cancel them first.`,
      });
    }

    const unitToRemove = property.subUnits.id(req.params.unitId);
    if (unitToRemove?.images?.length > 0) {
      await Promise.allSettled(unitToRemove.images.map(img => cloudinary.uploader.destroy(img.public_id)));
    }
    property.subUnits.pull(req.params.unitId);
    await property.save();
    await clearPropertyCache();
    return res.json({ success: true, message: "Room deleted successfully", property });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllProperties = async (req, res) => {
  try {
    const { type, city, search, stayType, minPrice, maxPrice } = req.query;
    const filter = { available: true, verificationStatus: 'verified' };
    
    // If querying specifically for "Room", we should also fetch Hotels/Hostels
    // to extract their individual sub-units later in the process.
    if (type) {
      const t = type.trim().toLowerCase();
      if (t === 'room') {
        filter.type = { $in: ['Room', 'Hotel', 'Hostel', 'Guest House'] };
      } else {
        // Normalize the query to the stored enum value: case-insensitive, and
        // "Home"/"Homes" (the friendly UI label) maps to the stored "House" type.
        // Without this, e.g. /property?type=Home returned nothing because the
        // enum has "House", not "Home".
        const VALID_TYPES = ['Room', 'Apartment', 'House', 'Hotel', 'Hostel', 'Guest House', 'Plaza'];
        const aliased = (t === 'home' || t === 'homes') ? 'house' : t;
        filter.type = VALID_TYPES.find((v) => v.toLowerCase() === aliased) || type;
      }
    }

    if (city) filter.city = new RegExp(city, 'i');
    if (stayType && stayType !== 'all') filter.stayTypes = stayType;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    if (search?.trim()) filter.$text = { $search: search.trim() };

    let properties = await PropertyModel.find(filter).populate('hostBy', 'username profileImage isBlocked').sort({ createdAt: -1 });

    // Hide listings whose host has been blocked/blacklisted — they should
    // disappear from public discovery even though the property doc itself
    // stays untouched (existing bookings/history must remain intact).
    properties = properties.filter((p) => !p.hostBy?.isBlocked);

    // Post-processing for "Room" category:
    // If the user wants Rooms, we should explode multi-unit properties into individual room listings.
    if (type && type.toLowerCase() === 'room') {
      const flattened = [];
      properties.forEach(p => {
        if (p.listingType === 'multi' && p.subUnits?.length > 0) {
          p.subUnits.forEach(unit => {
            if (unit.available) {
              flattened.push({
                ...p.toObject(),
                // Override parent details with specific room details
                _id: p._id, // Parent ID for navigation
                subUnitId: unit._id,
                name: `${unit.name} at ${p.name}`,
                price: unit.basePrice,
                description: unit.description || p.description,
                images: unit.images?.length > 0 ? unit.images : p.images,
                type: 'Room',
                // Keep parent info available
                parentName: p.name,
                parentType: p.type
              });
            }
          });
        } else if (p.type.toLowerCase() === 'room') {
          flattened.push(p);
        }
      });
      properties = flattened;
    }

    return res.json({ success: true, properties });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
