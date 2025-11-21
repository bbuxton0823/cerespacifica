import { addHours } from 'date-fns';

const inspectionDate = new Date('2025-10-23T09:00:00-07:00');

export const MOCK_SCHEDULE_EVENTS = [
  {
    id: '00000000-0000-4000-8000-000000000401',
    title: '355 E O\'Keefe St #26 - Adam Kruse (Initial)',
    date: inspectionDate,
    type: 'Initial',
    color: '#3b82f6'
  }
];

export const MOCK_ROUTE_SUMMARY = {
  date: inspectionDate.toISOString(),
  inspectorId: '00000000-0000-4000-8000-000000000101',
  totalStops: 1,
  estimatedDuration: 60,
  schedules: [
    {
      id: '00000000-0000-4000-8000-000000000401',
      address: '355 E O\'Keefe St #26, East Palo Alto, CA 94303',
      window: '09:00 - 15:00',
      eta: {
        start: inspectionDate,
        end: addHours(inspectionDate, 6)
      }
    }
  ]
};
