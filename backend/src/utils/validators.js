import Joi from 'joi';
import { EMERGENCY_FAIL_ITEMS } from '../constants/hud52580.js';

// HUD 52580 Inspection Data Validator
const inspectionItemSchema = Joi.object({
  id: Joi.string().required(),
  label: Joi.string().required(),
  status: Joi.string().valid('PENDING', 'PASS', 'FAIL', 'INCONCLUSIVE', 'N/A').required(),
  comment: Joi.string().allow(''),
  hqsGuidance: Joi.string().required(),
  is24Hour: Joi.boolean(),
  responsibility: Joi.string().valid('owner', 'tenant'),
  photos: Joi.array().items(Joi.string())
});

const roomSectionSchema = Joi.object({
  id: Joi.string().required(),
  title: Joi.string().required(),
  type: Joi.string().valid(
    'living_room', 'kitchen', 'bathroom', 'bedroom',
    'secondary', 'exterior', 'heating', 'general'
  ).required(),
  location: Joi.object({
    horizontal: Joi.string().valid('L', 'C', 'R', ''),
    vertical: Joi.string().valid('F', 'C', 'R', ''),
    floor: Joi.string().allow('')
  }),
  items: Joi.array().items(inspectionItemSchema).min(1).required()
});

const unitDetailsSchema = Joi.object({
  phaName: Joi.string().required(),
  inspectionType: Joi.string().valid('Initial', 'Annual', 'Reinspection', 'Special').required(),
  tenantName: Joi.string().required(),
  tenantId: Joi.string().allow(''),
  address: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().length(2).required(),
  zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).required(),
  unitType: Joi.string().valid(
    'S/F Detached', 'Duplex/Triplex', 'Town House',
    'Apartment', 'Manufactured', 'SRO', 'Shared Housing', 'Other'
  ).required(),
  yearBuilt: Joi.number().min(1800).max(new Date().getFullYear()),
  bedrooms: Joi.number().min(0).max(10).required(),
  bathrooms: Joi.number().min(0).max(5).required(),
  inspectionDate: Joi.string().isoDate().required(),
  inspectorName: Joi.string().required()
});

const inspectionDataSchema = Joi.object({
  details: unitDetailsSchema.required(),
  sections: Joi.array().items(roomSectionSchema).min(1).required(),
  signature: Joi.string().allow('', null)
});

// Main validation function
export async function validateInspectionData(data) {
  try {
    const { error, value } = inspectionDataSchema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return {
        valid: false,
        errors: error.details.map(d => d.message)
      };
    }

    // Additional HUD compliance checks
    const complianceErrors = [];

    // Check mandatory sections are present
    const mandatorySections = ['living_room', 'kitchen', 'bathroom_1', 'health_safety'];
    const sectionIds = value.sections.map(s => s.id);

    for (const mandatory of mandatorySections) {
      if (!sectionIds.includes(mandatory)) {
        complianceErrors.push(`Missing mandatory section: ${mandatory}`);
      }
    }

    // Check all items have been evaluated
    for (const section of value.sections) {
      for (const item of section.items) {
        if (item.status === 'PENDING') {
          complianceErrors.push(`Unevaluated item: ${section.title} - ${item.label}`);
        }

        // Check 24-hour items have responsibility assigned
        if (item.is24Hour && item.status === 'FAIL' && !item.responsibility) {
          complianceErrors.push(`24-hour fail item missing responsibility: ${item.label}`);
        }

        // Check failed items have comments
        if (item.status === 'FAIL' && (!item.comment || item.comment.trim() === '')) {
          complianceErrors.push(`Failed item missing comment: ${item.label}`);
        }
      }
    }

    // Check lead paint compliance for pre-1978 units
    if (value.details.yearBuilt < 1978) {
      const leadPaintChecked = value.sections.some(section =>
        section.items.some(item =>
          item.label.toLowerCase().includes('lead') &&
          item.status !== 'PENDING'
        )
      );

      if (!leadPaintChecked) {
        complianceErrors.push('Lead-based paint assessment required for pre-1978 unit');
      }
    }

    if (complianceErrors.length > 0) {
      return {
        valid: false,
        errors: complianceErrors
      };
    }

    return {
      valid: true,
      data: value
    };
  } catch (error) {
    return {
      valid: false,
      errors: [error.message]
    };
  }
}

// User data validators
export const userSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  first_name: Joi.string().required(),
  last_name: Joi.string().required(),
  role: Joi.string().valid('inspector', 'admin', 'manager').required(),
  agency_id: Joi.string().uuid().required(),
  privileges: Joi.array().items(Joi.string())
});

// Schedule validators
export const scheduleSchema = Joi.object({
  inspection_id: Joi.string().uuid(),
  inspector_id: Joi.string().uuid().required(),
  scheduled_date: Joi.date().required(),
  scheduled_time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  notes: Joi.string().allow(''),
  route: Joi.object()
});

// Report filter validators
export const reportFilterSchema = Joi.object({
  agency_id: Joi.string().uuid(),
  from_date: Joi.date(),
  to_date: Joi.date(),
  inspection_type: Joi.string().valid('Initial', 'Annual', 'Reinspection', 'Special'),
  status: Joi.string().valid('draft', 'pending', 'complete', 'cancelled'),
  include_deficiencies: Joi.boolean(),
  group_by: Joi.string().valid('inspector', 'unit', 'date', 'status')
});

// Sync data validators
export const syncDataSchema = Joi.object({
  deviceId: Joi.string().required(),
  changes: Joi.array().items(Joi.object({
    id: Joi.string(),
    type: Joi.string().valid('inspection', 'schedule', 'deficiency').required(),
    action: Joi.string().valid('create', 'update', 'delete', 'resolve').required(),
    data: Joi.object().required(),
    timestamp: Joi.date().iso().required()
  })).min(1).required(),
  clientTimestamp: Joi.date().iso().required()
});

// Deficiency validators
export const deficiencySchema = Joi.object({
  inspection_id: Joi.string().uuid().required(),
  item_id: Joi.string().required(),
  section_id: Joi.string().required(),
  description: Joi.string().required(),
  responsibility: Joi.string().valid('owner', 'tenant').required(),
  is_24hour: Joi.boolean(),
  status: Joi.string().valid('open', 'resolved', 'verified'),
  photos: Joi.array().items(Joi.string()),
  due_date: Joi.date(),
  resolved_date: Joi.date()
});