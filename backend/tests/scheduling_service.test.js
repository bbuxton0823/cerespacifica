import { jest } from '@jest/globals';

// Create mocks
const mockTrx = {
    commit: jest.fn(),
    rollback: jest.fn(),
};

// Mock builder function that returns itself for chaining
const mockBuilder = jest.fn(() => mockBuilder);
mockBuilder.insert = jest.fn().mockReturnThis();
mockBuilder.update = jest.fn().mockReturnThis();
mockBuilder.where = jest.fn().mockReturnThis();
mockBuilder.andWhere = jest.fn().mockReturnThis();
mockBuilder.whereNull = jest.fn().mockReturnThis();
mockBuilder.orWhereRaw = jest.fn().mockReturnThis();
mockBuilder.returning = jest.fn().mockReturnThis();
mockBuilder.first = jest.fn().mockReturnThis();
mockBuilder.select = jest.fn().mockReturnThis();
mockBuilder.join = jest.fn().mockReturnThis();

// Make builder thenable so it can be awaited
mockBuilder.then = jest.fn((resolve) => resolve([]));

// The trx function behaves like the builder but also has transaction methods
const trxFunc = jest.fn(() => mockBuilder);
Object.assign(trxFunc, mockTrx);

const mockDb = jest.fn(() => mockBuilder);
mockDb.transaction = jest.fn().mockResolvedValue(trxFunc);
mockDb.raw = jest.fn();

// Mock the module
jest.unstable_mockModule('../src/config/database.js', () => ({
    default: mockDb,
}));

// Import service dynamically after mocking
const { schedulingService } = await import('../src/services/schedulingService.js');

describe('SchedulingService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset default then implementation
        mockBuilder.then.mockImplementation((resolve) => resolve([]));
    });

    test('scheduleInspection creates inspection and schedule records', async () => {
        const unitId = 'unit-123';
        const inspectorId = 'user-123';
        const agencyId = 'agency-123';
        const date = new Date();

        // Mock return value for the insert().returning() chain
        // We need to mock the implementation of 'then' for the specific call
        // But since it's a shared mock, it's tricky. 
        // Alternative: make returning() return a Promise directly, breaking the chain but satisfying await
        mockBuilder.returning.mockResolvedValueOnce([{ id: 'inspection-123' }]);

        await schedulingService.scheduleInspection(unitId, 'Annual', date, inspectorId, agencyId);

        expect(mockDb.transaction).toHaveBeenCalled();
        expect(mockBuilder.insert).toHaveBeenCalledTimes(2);
        expect(mockTrx.commit).toHaveBeenCalled();
    });

    test('processInspectionResult updates compliance on pass', async () => {
        const inspectionId = 'inspection-123';

        // Mock first() to return the inspection
        mockBuilder.first.mockResolvedValueOnce({
            id: inspectionId,
            unit_id: 'unit-123',
            agency_id: 'agency-123'
        });

        await schedulingService.processInspectionResult(inspectionId, true, []);

        expect(mockBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
            compliance_status: 'Compliant'
        }));
        expect(mockTrx.commit).toHaveBeenCalled();
    });

    test('processInspectionResult schedules re-inspection on fail', async () => {
        const inspectionId = 'inspection-123';

        // Mock first() for getting inspection
        mockBuilder.first.mockResolvedValueOnce({
            id: inspectionId,
            unit_id: 'unit-123',
            agency_id: 'agency-123'
        });

        // Mock returning() for the re-inspection insert
        mockBuilder.returning.mockResolvedValueOnce([{ id: 'reinspection-123' }]);

        await schedulingService.processInspectionResult(inspectionId, false, []);

        expect(mockBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
            compliance_status: 'Non-Compliant'
        }));
        expect(mockBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
            inspection_type: 'Reinspection'
        }));
        expect(mockTrx.commit).toHaveBeenCalled();
    });
});
