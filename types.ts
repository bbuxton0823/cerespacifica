
export enum InspectionStatus {
  PENDING = 'PENDING',
  PASS = 'PASS',
  FAIL = 'FAIL',
  INCONCLUSIVE = 'INCONCLUSIVE',
  NOT_APPLICABLE = 'N/A'
}

export interface InspectionItem {
  id: string;
  label: string;
  status: InspectionStatus;
  comment: string;
  hqsGuidance: string; // The tooltip content
  is24Hour?: boolean; // New flag for 24-hour emergency fails
  responsibility?: 'owner' | 'tenant'; // Attribution for fails
  photos?: string[]; // Base64 strings of attached photos
}

export interface RoomLocation {
  horizontal: 'L' | 'C' | 'R' | '';
  vertical: 'F' | 'C' | 'R' | '';
  floor: string;
}

export interface RoomSection {
  id: string;
  title: string;
  type: 'living_room' | 'kitchen' | 'bathroom' | 'bedroom' | 'secondary' | 'exterior' | 'heating' | 'general';
  items: InspectionItem[];
  location: RoomLocation;
}

export interface UnitDetails {
  phaName: string;
  inspectionType: 'Initial' | 'Annual' | 'Reinspection' | 'Special'; // Added Inspection Type
  tenantName: string;
  tenantId: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  unitType: 'S/F Detached' | 'Duplex/Triplex' | 'Town House' | 'Apartment' | 'Manufactured' | 'SRO' | 'Shared Housing' | 'Other';
  yearBuilt: number;
  bedrooms: number;
  bathrooms: number;
  inspectionDate: string;
  inspectorName: string;
}

export interface InspectionData {
  details: UnitDetails;
  sections: RoomSection[];
  signature?: string; // Base64 string
}

// AI Response structure
export interface AIIntent {
  sectionId?: string;
  itemId?: string;
  status?: InspectionStatus;
  comment?: string;
  is24Hour?: boolean;
  responsibility?: 'owner' | 'tenant';
  action: 'update_item' | 'general_note' | 'unknown';
}
