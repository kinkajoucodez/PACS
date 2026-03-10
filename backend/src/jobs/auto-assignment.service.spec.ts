import { Test, TestingModule } from '@nestjs/testing';
import { AutoAssignmentService } from './auto-assignment.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType, StudyPriority, StudyStatus } from '@prisma/client';

const mockPrisma = {
  study: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  studyAssignment: {
    create: jest.fn(),
  },
  notification: {
    create: jest.fn(),
    findFirst: jest.fn(),
    createMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

/** Returns a minimal active-radiologist record. */
function makeRad(id: string, activeCount: number, specializations: string[] = []) {
  return {
    id,
    firstName: id,
    lastName: 'Test',
    radiologistProfile: { specializations },
    assignments: Array.from({ length: activeCount }, (_, i) => ({ id: `a-${id}-${i}` })),
  };
}

describe('AutoAssignmentService', () => {
  let service: AutoAssignmentService;

  beforeEach(async () => {
    jest.resetAllMocks();

    // Default: $transaction resolves all passed operations.
    mockPrisma.$transaction.mockImplementation((ops: Promise<unknown>[]) =>
      Promise.all(ops),
    );
    // Default: create/update resolve to {}
    mockPrisma.studyAssignment.create.mockResolvedValue({});
    mockPrisma.study.update.mockResolvedValue({});
    mockPrisma.notification.create.mockResolvedValue({});
    mockPrisma.notification.createMany.mockResolvedValue({ count: 0 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutoAssignmentService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AutoAssignmentService>(AutoAssignmentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('assignPendingStudies', () => {
    it('should do nothing when there are no unassigned studies', async () => {
      mockPrisma.study.findMany.mockResolvedValue([]);

      await service.assignPendingStudies();

      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should assign a study to the radiologist with the fewest active assignments', async () => {
      const study = {
        id: 'study-1',
        priority: StudyPriority.routine,
        status: StudyStatus.received,
        modality: 'CT',
        receivedAt: new Date(),
      };

      mockPrisma.study.findMany.mockResolvedValue([study]);
      // rad-1 has 2 active assignments, rad-2 has 1 → rad-2 should be chosen
      mockPrisma.user.findMany.mockResolvedValue([makeRad('rad-1', 2), makeRad('rad-2', 1)]);
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'admin-1' });

      await service.assignPendingStudies();

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'rad-2',
            type: NotificationType.study_assigned,
          }),
        }),
      );
    });

    it('should prefer a radiologist whose specializations match the study modality', async () => {
      const study = {
        id: 'study-2',
        priority: StudyPriority.routine,
        status: StudyStatus.received,
        modality: 'MRI',
        receivedAt: new Date(),
      };

      mockPrisma.study.findMany.mockResolvedValue([study]);
      // rad-1 has 0 active (fewest) but no MRI spec; rad-2 has 1 active but specializes in MRI
      mockPrisma.user.findMany.mockResolvedValue([
        makeRad('rad-1', 0, ['CT']),
        makeRad('rad-2', 1, ['MRI']),
      ]);
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'admin-1' });

      await service.assignPendingStudies();

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'rad-2' }),
        }),
      );
    });

    it('should log a warning and skip assignment when no radiologists are available', async () => {
      const study = {
        id: 'study-3',
        priority: StudyPriority.stat,
        status: StudyStatus.received,
        modality: null,
        receivedAt: new Date(Date.now() - 60 * 60_000),
      };

      mockPrisma.study.findMany.mockResolvedValue([study]);
      mockPrisma.user.findMany
        .mockResolvedValueOnce([]) // radiologists → none
        .mockResolvedValueOnce([{ id: 'admin-1' }]); // admins for escalation
      mockPrisma.notification.findFirst.mockResolvedValue(null);

      await service.assignPendingStudies();

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should escalate long-unassigned STAT studies when no radiologist is available', async () => {
      const now = new Date();
      const study = {
        id: 'study-escalate',
        priority: StudyPriority.stat,
        status: StudyStatus.received,
        modality: null,
        // Received 2 hours ago — STAT escalation threshold is 30 minutes
        receivedAt: new Date(now.getTime() - 2 * 60 * 60_000),
      };

      mockPrisma.study.findMany.mockResolvedValue([study]);
      mockPrisma.user.findMany
        .mockResolvedValueOnce([]) // radiologists → none
        .mockResolvedValueOnce([{ id: 'admin-1' }]); // admins
      mockPrisma.notification.findFirst.mockResolvedValue(null);

      await service.assignPendingStudies();

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              type: NotificationType.system_alert,
              referenceId: 'study-escalate',
            }),
          ]),
        }),
      );
    });

    it('should not re-escalate a study that was already escalated', async () => {
      const now = new Date();
      const study = {
        id: 'study-already-escalated',
        priority: StudyPriority.stat,
        status: StudyStatus.received,
        modality: null,
        receivedAt: new Date(now.getTime() - 2 * 60 * 60_000),
      };

      mockPrisma.study.findMany.mockResolvedValue([study]);
      mockPrisma.user.findMany
        .mockResolvedValueOnce([]) // radiologists → none
        .mockResolvedValueOnce([{ id: 'admin-1' }]); // admins
      mockPrisma.notification.findFirst.mockResolvedValue({ id: 'existing-notif' });

      await service.assignPendingStudies();

      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('should use the radiologist ID as assignedById when no admin exists', async () => {
      const study = {
        id: 'study-no-admin',
        priority: StudyPriority.routine,
        status: StudyStatus.received,
        modality: null,
        receivedAt: new Date(),
      };

      mockPrisma.study.findMany.mockResolvedValue([study]);
      mockPrisma.user.findMany.mockResolvedValue([makeRad('rad-1', 0)]);
      mockPrisma.user.findFirst.mockResolvedValue(null); // no admin

      await service.assignPendingStudies();

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      // studyAssignment.create should have been called with radiologist's own ID
      expect(mockPrisma.studyAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ assignedById: 'rad-1' }),
        }),
      );
    });

    it('should process multiple studies across a run', async () => {
      const now = new Date();
      const studies = [
        {
          id: 'study-stat',
          priority: StudyPriority.stat,
          status: StudyStatus.received,
          modality: null,
          receivedAt: new Date(now.getTime() - 10_000),
        },
        {
          id: 'study-routine',
          priority: StudyPriority.routine,
          status: StudyStatus.received,
          modality: null,
          receivedAt: new Date(now.getTime() - 20_000),
        },
      ];

      mockPrisma.study.findMany.mockResolvedValue(studies);
      mockPrisma.user.findMany.mockResolvedValue([makeRad('rad-1', 0)]);
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'admin-1' });

      await service.assignPendingStudies();

      // Both studies should have been assigned
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
      expect(mockPrisma.notification.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('triggerImmediateAssignment', () => {
    it('should run the assignment logic when called directly', async () => {
      mockPrisma.study.findMany.mockResolvedValue([]);

      await service.triggerImmediateAssignment();

      expect(mockPrisma.study.findMany).toHaveBeenCalledTimes(1);
    });
  });
});
