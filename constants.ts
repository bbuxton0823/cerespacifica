
import { InspectionItem, InspectionStatus, RoomSection } from './types';

// Helper to create standard items with HQS guidance
const createItem = (id: string, label: string, guidance: string): InspectionItem => ({
  id,
  label,
  status: InspectionStatus.PENDING,
  comment: '',
  hqsGuidance: guidance,
  is24Hour: false,
  responsibility: 'Owner', // Default to Owner responsibility
  photos: []
});

const STD_ELEC = "Must be free of hazards. All outlets/switches must have cover plates. No exposed wires. 3-prong outlets must be grounded.";
const STD_WINDOW = "Must be weather-tight. No severe deterioration. First floor windows must lock. Must stay up when opened if designed to.";
const STD_WALL = "Free of large cracks, holes, or loose plaster. Lead-based paint hazard if built pre-1978 and peeling.";
const STD_FLOOR = "No tripping hazards. No severe buckling. Carpet must be secured.";
const STD_SEC = "Doors/Windows accessible from outside must be lockable. Unit must be secure.";
const STD_CEILING = "No bulging, severe holes, or water damage indicating active leaks.";
const STD_LEAD = "For units built before 1978 with children < 6: Check for peeling, chipping, chalking paint. Fail if deterioration exceeds de minimis levels.";
const STD_SMOKE = "Must be operational. Press test button.";
const STD_CO = "Required in units with fuel-burning appliances or attached garages. Install below smoke detector if applicable or per local code.";

export const INITIAL_SECTIONS: RoomSection[] = [
  {
    id: 'living_room',
    title: '1. Living Room',
    type: 'living_room',
    location: { horizontal: '', vertical: '', floor: '' },
    items: [
      createItem('1.1', 'Electricity', STD_ELEC),
      createItem('1.2', 'Electrical Hazards', "Check for overloaded circuits, frayed cords, or missing cover plates."),
      createItem('1.3', 'Security', STD_SEC),
      createItem('1.4', 'Windows', STD_WINDOW),
      createItem('1.5', 'Ceiling Condition', STD_CEILING),
      createItem('1.6', 'Wall Condition', STD_WALL),
      createItem('1.7', 'Floor Condition', STD_FLOOR),
      createItem('1.8', 'Lead-Based Paint', STD_LEAD),
      createItem('1.9', 'Smoke Detector', STD_SMOKE),
      createItem('1.10', 'Carbon Monoxide Detector', STD_CO),
    ]
  },
  {
    id: 'kitchen',
    title: '2. Kitchen',
    type: 'kitchen',
    location: { horizontal: '', vertical: '', floor: '' },
    items: [
      createItem('2.1', 'Electricity', STD_ELEC),
      createItem('2.2', 'Electrical Hazards', "Check near water sources for GFCI."),
      createItem('2.3', 'Security', STD_SEC),
      createItem('2.4', 'Windows', STD_WINDOW),
      createItem('2.5', 'Ceiling Condition', STD_CEILING),
      createItem('2.6', 'Wall Condition', STD_WALL),
      createItem('2.7', 'Floor Condition', STD_FLOOR),
      createItem('2.8', 'Stove/Range', "Burners must light. Oven must heat. No gas leaks. Control knobs present."),
      createItem('2.9', 'Refrigerator', "Must maintain temperature. Door gaskets must seal."),
      createItem('2.10', 'Sink/Faucet/P-Trap', "Hot/cold running water. Drain must function. No severe leaks."),
      createItem('2.11', 'Counter/Storage', "Adequate food preparation area and storage space."),
      createItem('2.12', 'Lead-Based Paint', STD_LEAD),
      createItem('2.13', 'Smoke Detector', STD_SMOKE),
      createItem('2.14', 'Carbon Monoxide Detector', STD_CO),
    ]
  },
  {
    id: 'bathroom_1',
    title: '3. Bathroom 1',
    type: 'bathroom',
    location: { horizontal: '', vertical: '', floor: '' },
    items: [
      createItem('3.1', 'Electricity', STD_ELEC),
      createItem('3.2', 'Electrical Hazards', "No exposed wires. Outlets near water."),
      createItem('3.3', 'Security', STD_SEC),
      createItem('3.4', 'Windows', "Must operate if meant for ventilation."),
      createItem('3.5', 'Ceiling Condition', STD_CEILING),
      createItem('3.6', 'Wall Condition', "Water resistant materials in tub surround."),
      createItem('3.7', 'Floor Condition', "Impervious to water interaction recommended."),
      createItem('3.8', 'Toilet', "Must flush properly. Secure to floor. No leaks."),
      createItem('3.9', 'Sink/Faucet/P-Trap', "Hot/cold water. Drain works. Trap intact."),
      createItem('3.10', 'Tub/Shower', "Hot/cold water. Drain works."),
      createItem('3.11', 'Ventilation', "Operable window or working exhaust fan required."),
      createItem('3.12', 'Lead-Based Paint', STD_LEAD),
    ]
  },
  {
    id: 'secondary_room',
    title: '5. Secondary Room (Optional)',
    type: 'secondary',
    location: { horizontal: '', vertical: '', floor: '' },
    items: [
      createItem('5.1', 'Security', STD_SEC),
      createItem('5.2', 'Electrical Hazards', STD_ELEC),
      createItem('5.3', 'Other Hazards', "Any other potential health/safety issues."),
    ]
  },
  {
    id: 'building_ext',
    title: '6. Building Exterior',
    type: 'exterior',
    location: { horizontal: '', vertical: '', floor: '' },
    items: [
      createItem('6.1', 'Foundation', "Sound and free of hazards."),
      createItem('6.2', 'Stairs/Rails/Porches', "Secure handrails for 4+ steps. No tripping hazards."),
      createItem('6.3', 'Roof/Gutters', "No obvious buckling or sagging."),
      createItem('6.4', 'Exterior Surfaces', "Siding intact."),
      createItem('6.5', 'Chimney', "Structurally sound."),
      createItem('6.6', 'Lead-Based Paint', STD_LEAD),
      createItem('6.7', 'Mobile Home Tie Down', "If applicable, check for secure tie-downs."),
    ]
  },
  {
    id: 'heating',
    title: '7. Heating & Plumbing',
    type: 'heating',
    location: { horizontal: '', vertical: '', floor: '' },
    items: [
      createItem('7.1', 'Adequate Heating', "Capable of maintaining healthy temp (usually 68F)."),
      createItem('7.2', 'Safe Heating Equipment', "Properly vented. No unvented fuel-burning heaters."),
      createItem('7.3', 'Adequate Vent & Cooling', "Proper air circulation."),
      createItem('7.4', 'Water Heater', "Pressure relief valve present with discharge pipe."),
      createItem('7.5', 'Water Supply', "Free of contamination."),
      createItem('7.6', 'Plumbing', "Pipes free of severe leaks/corrosion."),
      createItem('7.7', 'Sewer Connection', "connected to public sewer or approved septic."),
    ]
  },
  {
    id: 'health_safety',
    title: '8. Health & Safety',
    type: 'general',
    location: { horizontal: '', vertical: '', floor: '' },
    items: [
      createItem('8.1', 'Access to Unit', "Two independent exits from building."),
      createItem('8.2', 'Fire Exits', "Not blocked."),
      createItem('8.3', 'Infestation', "Free of roaches, rats, mice, bedbugs."),
      createItem('8.4', 'Garbage & Debris', "Adequate facilities for disposal. No heavy accumulation."),
      createItem('8.5', 'Refuse Disposal', "Proper trash storage areas."),
      createItem('8.6', 'Interior Stairs/Common Halls', "Handrails present, lighting adequate, no hazards."),
      createItem('8.7', 'Other Interior Hazards', "Any other safety concerns not covered."),
      createItem('8.8', 'Elevators', "If present, is certificate valid and current?"),
      createItem('8.9', 'Interior Air Quality', "Free of pollutants, mold, sewer gas."),
      createItem('8.10', 'Site/Neighborhood', "No severe hazards in immediate vicinity (e.g. heavy trash, falling hazards)."),
      createItem('8.11', 'Lead Paint - Owner Cert', "Certification provided by owner if required."),
    ]
  }
];

export const ROOM_TEMPLATES = {
  bedroom: (num: number): RoomSection => ({
    id: `bedroom_${num}`,
    title: `4.${num} Bedroom ${num}`,
    type: 'bedroom',
    location: { horizontal: '', vertical: '', floor: '' },
    items: [
      createItem(`4.${num}.1`, 'Electricity', STD_ELEC),
      createItem(`4.${num}.2`, 'Electrical Hazards', STD_ELEC),
      createItem(`4.${num}.3`, 'Security', STD_SEC),
      createItem(`4.${num}.4`, 'Window Condition', STD_WINDOW),
      createItem(`4.${num}.5`, 'Ceiling Condition', STD_CEILING),
      createItem(`4.${num}.6`, 'Wall Condition', STD_WALL),
      createItem(`4.${num}.7`, 'Floor Condition', STD_FLOOR),
      createItem(`4.${num}.8`, 'Lead-Based Paint', STD_LEAD),
      createItem(`4.${num}.9`, 'Smoke Detector', STD_SMOKE),
      createItem(`4.${num}.10`, 'Carbon Monoxide Detector', STD_CO),
    ]
  }), 
  bathroom: (num: number): RoomSection => ({
    id: `bathroom_${num}`,
    title: `3.${num} Bathroom ${num}`,
    type: 'bathroom',
    location: { horizontal: '', vertical: '', floor: '' },
    items: [
      createItem(`3.${num}.1`, 'Electricity', STD_ELEC),
      createItem(`3.${num}.2`, 'Electrical Hazards', "No exposed wires."),
      createItem(`3.${num}.3`, 'Security', STD_SEC),
      createItem(`3.${num}.4`, 'Windows', "Operable if no fan."),
      createItem(`3.${num}.5`, 'Ceiling Condition', STD_CEILING),
      createItem(`3.${num}.6`, 'Wall Condition', STD_WALL),
      createItem(`3.${num}.7`, 'Floor Condition', STD_FLOOR),
      createItem(`3.${num}.8`, 'Toilet', "Flush mechanism."),
      createItem(`3.${num}.9`, 'Sink/Faucet/P-Trap', "Hot/Cold water, drain."),
      createItem(`3.${num}.10`, 'Tub/Shower', "Functioning."),
      createItem(`3.${num}.11`, 'Ventilation', "Fan or Window."),
      createItem(`3.${num}.12`, 'Lead-Based Paint', STD_LEAD),
    ]
  })
};
