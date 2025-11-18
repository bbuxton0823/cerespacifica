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
  photos?: string[]; // Base64 strings of attached photos
}

export interface RoomSection {
  id: string;
  title: string;
  type: 'living_room' | 'kitchen' | 'bathroom' | 'bedroom' | 'secondary' | 'exterior' | 'heating' | 'general';
  items: InspectionItem[];
}

export interface UnitDetails {
  tenantName: string;
  address: string;
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
  action: 'update_item' | 'general_note' | 'unknown';
}