import { InspectionItem, InspectionStatus, RoomSection } from '../types';

// Helper to create standard items with HQS guidance
const createItem = (
  id: string, 
  label: string, 
  guidance: string, 
  is24Hour: boolean = false
): InspectionItem => ({
  id,
  label,
  status: InspectionStatus.PENDING,
  comment: '',
  hqsGuidance: guidance,
  is24Hour,
  responsibility: 'owner',
  photos: []
});

// Standard guidance strings per HUD Handbook 7420.10G
const GUIDANCE = {
  ELECTRICITY: "Must be free of hazards. All outlets/switches must have cover plates. No exposed wires. 3-prong outlets must be grounded. GFCI required within 6 feet of water sources.",
  WINDOWS: "Must be weather-tight, lockable on first floor. No severe deterioration. Must stay up when opened if designed to. No broken/missing panes.",
  WALLS: "Free of large cracks, holes, or loose plaster. Lead-based paint hazard if built pre-1978 and peeling/chipping/chalking.",
  FLOORS: "No tripping hazards. No severe buckling or movement. Carpet must be secured. Walking surfaces must be safe.",
  SECURITY: "Doors/Windows accessible from outside must be lockable. Deadbolt or key lock required on entry doors. Unit must be secure.",
  CEILING: "No bulging, severe holes, or water damage indicating active leaks. Must be structurally sound.",
  LEAD_PAINT: "For units built before 1978 with children under 6: Check for deteriorated paint. Fail if deterioration exceeds de minimis levels (2 sq ft interior, 20 sq ft exterior).",
  SMOKE_DETECTOR: "Must be present and operational on each level. Press test button to verify. Battery backup required.",
  CO_DETECTOR: "Required in units with fuel-burning appliances, attached garages, or per local code. Must be operational.",
  HEATING: "Must be capable of maintaining 68°F in living areas under normal winter conditions. No unvented fuel-burning space heaters.",
  WATER_HEATER: "Must have pressure relief valve with discharge pipe extending to within 6 inches of floor. Adequate capacity for unit size.",
  PLUMBING: "All fixtures must be free of major leaks. Hot and cold running water required. Proper drainage.",
  INFESTATION: "Unit must be free of rodent and insect infestation. Evidence includes droppings, gnaw marks, roach egg cases.",
  MOLD: "No evidence of mold that poses health risk. Small amounts in bathroom acceptable if ventilation present."
};

// Complete HUD Form 52580 Inspection Checklist
export const HUD_52580_CHECKLIST: RoomSection[] = [
  // 1. LIVING ROOM
  {
    id: 'living_room',
    title: '1. Living Room',
    type: 'living_room',
    location: { horizontal: '', vertical: '', floor: '' },
    items: [
      createItem('1.1', 'Present and Living Room Used', "Living room must be present and used as living area."),
      createItem('1.2', 'Electricity', GUIDANCE.ELECTRICITY),
      createItem('1.3', 'Electrical Hazards', "No overloaded circuits, extension cords under rugs, or missing cover plates.", true),
      createItem('1.4', 'Security', GUIDANCE.SECURITY),
      createItem('1.5', 'Window Condition', GUIDANCE.WINDOWS),
      createItem('1.6', 'Ceiling Condition', GUIDANCE.CEILING),
      createItem('1.7', 'Wall Condition', GUIDANCE.WALLS),
      createItem('1.8', 'Floor Condition', GUIDANCE.FLOORS),
      createItem('1.9', 'Lead-Based Paint', GUIDANCE.LEAD_PAINT),
      createItem('1.10', 'Smoke Detector', GUIDANCE.SMOKE_DETECTOR, true),
      createItem('1.11', 'Carbon Monoxide Detector', GUIDANCE.CO_DETECTOR, true),
    ]
  },
  
  // 2. KITCHEN
  {
    id: 'kitchen',
    title: '2. Kitchen',
    type: 'kitchen',
    location: { horizontal: '', vertical: '', floor: '' },
    items: [
      createItem('2.1', 'Kitchen Present', "Kitchen area with stove, refrigerator, and sink required."),
      createItem('2.2', 'Electricity', GUIDANCE.ELECTRICITY),
      createItem('2.3', 'Electrical Hazards', "GFCI protection required near sink. No hazards near water.", true),
      createItem('2.4', 'Security', GUIDANCE.SECURITY),
      createItem('2.5', 'Window Condition', GUIDANCE.WINDOWS),
      createItem('2.6', 'Ceiling Condition', GUIDANCE.CEILING),
      createItem('2.7', 'Wall Condition', GUIDANCE.WALLS),
      createItem('2.8', 'Floor Condition', GUIDANCE.FLOORS),
      createItem('2.9', 'Lead-Based Paint', GUIDANCE.LEAD_PAINT),
      createItem('2.10', 'Stove/Range', "All burners must work. Oven must maintain temperature. No gas leaks. Anti-tip device for free-standing ranges.", true),
      createItem('2.11', 'Refrigerator', "Must maintain safe temperature (below 40°F). Freezer functioning. Door seals intact."),
      createItem('2.12', 'Sink/Plumbing', "Hot and cold running water. Faucets work. P-trap present. No severe leaks.", true),
      createItem('2.13', 'Counter/Cabinet Space', "Adequate food preparation area (minimum 2 feet). Storage for food and utensils."),
      createItem('2.14', 'Smoke Detector', GUIDANCE.SMOKE_DETECTOR, true),
      createItem('2.15', 'Carbon Monoxide Detector', GUIDANCE.CO_DETECTOR, true),
    ]
  },

  // 3. BATHROOM
  {
    id: 'bathroom_1',
    title: '3. Bathroom',
    type: 'bathroom',
    location: { horizontal: '', vertical: '', floor: '' },
    items: [
      createItem('3.1', 'Bathroom Present', "At least one complete bathroom required with toilet, sink, and tub/shower."),
      createItem('3.2', 'Electricity', GUIDANCE.ELECTRICITY),
      createItem('3.3', 'Electrical Hazards', "GFCI required. No exposed wiring near water.", true),
      createItem('3.4', 'Security', GUIDANCE.SECURITY),
      createItem('3.5', 'Window Condition', "If present, must operate for ventilation."),
      createItem('3.6', 'Ceiling Condition', GUIDANCE.CEILING),
      createItem('3.7', 'Wall Condition', "Water-resistant surface around tub/shower. No severe deterioration."),
      createItem('3.8', 'Floor Condition', "Water-resistant. No soft spots or rot. Non-slip surface recommended."),
      createItem('3.9', 'Lead-Based Paint', GUIDANCE.LEAD_PAINT),
      createItem('3.10', 'Flush Toilet', "Must flush properly. Secure to floor. Tank fills and stops. No constant running.", true),
      createItem('3.11', 'Sink/Plumbing', "Hot and cold water. Drainage works. No severe leaks.", true),
      createItem('3.12', 'Tub/Shower', "Hot and cold water. Proper drainage. No severe leaks. Anti-scald devices if required.", true),
      createItem('3.13', 'Ventilation', "Operable window or exhaust fan required. Must adequately ventilate."),
      createItem('3.14', 'Bathroom Door', "Privacy lock required. Door must close properly."),
    ]
  },

  // 4. OTHER ROOMS (Bedrooms, Halls, etc.)
  {
    id: 'other_rooms',
    title: '4. Other Rooms Used for Living',
    type: 'secondary',
    location: { horizontal: '', vertical: '', floor: '' },
    items: [
      createItem('4.1', 'Room Present and Used', "Check all bedrooms, halls, and other living spaces."),
      createItem('4.2', 'Electricity', GUIDANCE.ELECTRICITY),
      createItem('4.3', 'Electrical Hazards', "No overloaded outlets or exposed wiring.", true),
      createItem('4.4', 'Security', "Bedroom doors must have privacy locks. Windows lockable if accessible."),
      createItem('4.5', 'Window Condition', GUIDANCE.WINDOWS),
      createItem('4.6', 'Ceiling Condition', GUIDANCE.CEILING),
      createItem('4.7', 'Wall Condition', GUIDANCE.WALLS),
      createItem('4.8', 'Floor Condition', GUIDANCE.FLOORS),
      createItem('4.9', 'Lead-Based Paint', GUIDANCE.LEAD_PAINT),
      createItem('4.10', 'Smoke Detector (Bedrooms)', "Required in each bedroom and hallway outside bedrooms.", true),
      createItem('4.11', 'Carbon Monoxide Detector', GUIDANCE.CO_DETECTOR, true),
      createItem('4.12', 'Closet/Storage', "Adequate clothes storage in bedrooms."),
    ]
  },

  // 5. ALL SECONDARY ROOMS
  {
    id: 'secondary_rooms',
    title: '5. All Secondary Rooms',
    type: 'secondary',
    location: { horizontal: '', vertical: '', floor: '' },
    items: [
      createItem('5.1', 'None Go to 6', "Skip if no secondary rooms present."),
      createItem('5.2', 'Security', GUIDANCE.SECURITY),
      createItem('5.3', 'Electrical Hazards', "Check all outlets and switches.", true),
      createItem('5.4', 'Other Hazards', "Sharp edges, protruding objects, tripping hazards."),
      createItem('5.5', 'Lead-Based Paint', GUIDANCE.LEAD_PAINT),
    ]
  },

  // 6. BUILDING EXTERIOR
  {
    id: 'building_exterior',
    title: '6. Building Exterior',
    type: 'exterior',
    location: { horizontal: '', vertical: '', floor: '' },
    items: [
      createItem('6.1', 'Condition of Foundation', "Structurally sound. No major cracks or settlement. No water infiltration."),
      createItem('6.2', 'Condition of Stairs, Rails, Porches', "Handrails for 4+ steps. Maximum 6\" spacing in railings. No loose or missing components.", true),
      createItem('6.3', 'Condition of Roof and Gutters', "Weather-tight. No missing shingles or sagging. Gutters attached and draining."),
      createItem('6.4', 'Condition of Exterior Surfaces', "Siding/paint intact. No holes or major deterioration. Weather-resistant."),
      createItem('6.5', 'Condition of Chimney', "If present, structurally sound. No loose bricks or obstruction."),
      createItem('6.6', 'Lead-Based Paint (Exterior)', "Check all painted surfaces if pre-1978. 20 sq ft threshold for exterior."),
      createItem('6.7', 'Manufactured Home Tie Downs', "If applicable, properly installed and secure per manufacturer specs."),
    ]
  },

  // 7. HEATING AND PLUMBING
  {
    id: 'heating_plumbing',
    title: '7. Heating and Plumbing',
    type: 'heating',
    location: { horizontal: '', vertical: '', floor: '' },
    items: [
      createItem('7.1', 'Adequacy of Heating Equipment', GUIDANCE.HEATING, true),
      createItem('7.2', 'Safety of Heating Equipment', "Properly vented. No carbon monoxide risk. Clear area around unit.", true),
      createItem('7.3', 'Ventilation and Cooling', "Adequate air circulation. Windows operate or mechanical ventilation present."),
      createItem('7.4', 'Water Heater', GUIDANCE.WATER_HEATER, true),
      createItem('7.5', 'Approvable Water Supply', "Public water or approved well. Safe for drinking. Adequate pressure."),
      createItem('7.6', 'Plumbing', GUIDANCE.PLUMBING),
      createItem('7.7', 'Sewer Connection', "Connected to public sewer or approved septic system. No backups or odors."),
    ]
  },

  // 8. GENERAL HEALTH AND SAFETY
  {
    id: 'health_safety',
    title: '8. General Health and Safety',
    type: 'general',
    location: { horizontal: '', vertical: '', floor: '' },
    items: [
      createItem('8.1', 'Access to Unit', "Free from obstacles. Two exits from building required.", true),
      createItem('8.2', 'Fire Exits', "Not blocked. Doors and windows open freely. No bars without quick release.", true),
      createItem('8.3', 'Evidence of Infestation', GUIDANCE.INFESTATION),
      createItem('8.4', 'Garbage and Debris', "No accumulation inside or immediately outside. Proper storage containers."),
      createItem('8.5', 'Refuse Disposal', "Adequate garbage facilities. Regular collection. Covered containers."),
      createItem('8.6', 'Interior Stairs and Common Halls', "Secure railings. Adequate lighting. No loose/broken steps.", true),
      createItem('8.7', 'Other Interior Hazards', "Sharp edges, electrical hazards, tripping hazards, protruding objects.", true),
      createItem('8.8', 'Elevators', "If present, current inspection certificate. Working properly."),
      createItem('8.9', 'Interior Air Quality', GUIDANCE.MOLD),
      createItem('8.10', 'Site and Neighborhood Conditions', "No hazards on site. Adequate drainage. No abandoned vehicles/dangerous conditions."),
      createItem('8.11', 'Lead-Based Paint Owner Certification', "Required if pre-1978. EPA RRP certification if work performed."),
      createItem('8.12', 'Smoke Detectors (All)', "Verify all detectors present and operational. One per level minimum.", true),
      createItem('8.13', 'Carbon Monoxide Detectors (All)', "Verify all required locations have working detectors.", true),
    ]
  },

  // 9. SPECIAL ACCOMMODATIONS (If Applicable)
  {
    id: 'special_accommodations',
    title: '9. Special Accommodations',
    type: 'general',
    location: { horizontal: '', vertical: '', floor: '' },
    items: [
      createItem('9.1', 'Ramps', "Slope not exceeding 1:12. Handrails if rise > 6 inches. Non-slip surface."),
      createItem('9.2', 'Grab Bars', "Properly anchored. Appropriate locations in bathroom."),
      createItem('9.3', 'Accessible Route', "36 inch minimum width. Level landings at doors."),
      createItem('9.4', 'Accessible Bathroom', "Adequate space for wheelchair. Appropriate fixture heights."),
      createItem('9.5', 'Accessible Kitchen', "Reachable controls and work surfaces. Knee space under sink if required."),
      createItem('9.6', 'Door Width', "32 inch minimum clear opening for accessible units."),
      createItem('9.7', 'Visual/Audible Alarms', "If required, functioning properly."),
    ]
  }
];

// Template for dynamic room creation
export const ROOM_TEMPLATES = {
  bedroom: (num: number): RoomSection => ({
    id: `bedroom_${num}`,
    title: `Bedroom ${num}`,
    type: 'bedroom',
    location: { horizontal: '', vertical: '', floor: '' },
    items: [
      createItem(`BR${num}.1`, 'Room Present and Used', "Must be used as bedroom with adequate space."),
      createItem(`BR${num}.2`, 'Electricity', GUIDANCE.ELECTRICITY),
      createItem(`BR${num}.3`, 'Electrical Hazards', "Check all outlets and switches.", true),
      createItem(`BR${num}.4`, 'Security', "Windows lockable. Door has privacy lock."),
      createItem(`BR${num}.5`, 'Window Condition', GUIDANCE.WINDOWS),
      createItem(`BR${num}.6`, 'Ceiling Condition', GUIDANCE.CEILING),
      createItem(`BR${num}.7`, 'Wall Condition', GUIDANCE.WALLS),
      createItem(`BR${num}.8`, 'Floor Condition', GUIDANCE.FLOORS),
      createItem(`BR${num}.9`, 'Lead-Based Paint', GUIDANCE.LEAD_PAINT),
      createItem(`BR${num}.10`, 'Smoke Detector', "Required in each bedroom.", true),
      createItem(`BR${num}.11`, 'Closet/Storage', "Adequate clothes storage space."),
    ]
  }),
  
  bathroom: (num: number): RoomSection => ({
    id: `bathroom_${num}`,
    title: `Bathroom ${num}`,
    type: 'bathroom',
    location: { horizontal: '', vertical: '', floor: '' },
    items: [
      createItem(`BA${num}.1`, 'Bathroom Present', "Complete bathroom with required fixtures."),
      createItem(`BA${num}.2`, 'Electricity', GUIDANCE.ELECTRICITY),
      createItem(`BA${num}.3`, 'Electrical Hazards', "GFCI protection required.", true),
      createItem(`BA${num}.4`, 'Security', "Privacy lock required."),
      createItem(`BA${num}.5`, 'Ceiling Condition', GUIDANCE.CEILING),
      createItem(`BA${num}.6`, 'Wall Condition', "Water-resistant surfaces."),
      createItem(`BA${num}.7`, 'Floor Condition', "Water-resistant flooring."),
      createItem(`BA${num}.8`, 'Toilet', "Flushes properly. Secure to floor.", true),
      createItem(`BA${num}.9`, 'Sink', "Hot and cold water. Proper drainage.", true),
      createItem(`BA${num}.10`, 'Tub/Shower', "Hot and cold water. Proper drainage.", true),
      createItem(`BA${num}.11`, 'Ventilation', "Window or exhaust fan required."),
    ]
  })
};

// 24-hour emergency fail items
export const EMERGENCY_FAIL_ITEMS = [
  '1.3', '1.10', '1.11', // Living room electrical hazards, smoke/CO detectors
  '2.3', '2.10', '2.12', '2.14', '2.15', // Kitchen hazards
  '3.3', '3.10', '3.11', '3.12', // Bathroom hazards
  '4.3', '4.10', '4.11', // Other rooms hazards
  '6.2', // Exterior stairs/rails
  '7.1', '7.2', '7.4', // Heating and water heater
  '8.1', '8.2', '8.6', '8.7', '8.12', '8.13' // General health and safety
];

// Mapping of deficiency types to HUD codes
export const HUD_DEFICIENCY_CODES = {
  'LIFE_THREATENING': 'LT', // 24-hour
  'SEVERE': 'S', // Fail
  'MODERATE': 'M', // Fail
  'MINOR': 'MI', // Pass with comments
  'NONE': 'N' // Pass
};