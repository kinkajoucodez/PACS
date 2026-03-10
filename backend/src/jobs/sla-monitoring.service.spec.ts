import { Test, TestingModule } from '@nestjs/testing';
import { SlaMonitoringService } from './sla-monitoring.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType, StudyPriority, StudyStatus } from '@prisma/client';

const mockPrisma = {
  slaTracking: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  study: {
    findMany: jest.fn(),
  },
  notification: {
    findFirst: jest.fn(),
    createMany: jest.fn(),
    create: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
};

describe('SlaMonitoringService', () => {
  let service: SlaMonitoringService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlaMonitoringService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SlaMonitoringService>(SlaMonitoringService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkSlaDeadlines', () => {
    it('should detect a breach and update SlaTracking when deadline has passed', async () => {
      const now = new Date();
      const pastDeadline = new Date(now.getTime() - 60_000); // 1 min ago

      mockPrisma.slaTracking.findMany.mockResolvedValue([
        {
          id: 'tracking-1',
          deadlineAt: pastDeadline,
          breachedAt: null,
          warningSentAt: null,
          study: {
            id: 'study-1',
            priority: StudyPriority.stat,
            status: StudyStatus.assigned,
            receivedAt: new Date(now.getTime() - 2 * 60 * 60_000),
            assignments: [{ radiologistId: 'rad-1' }],
          },
          slaConfig: { warningThresholdPercent: 75 },
        },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
      mockPrisma.slaTracking.update.mockResolvedValue({});
      mockPrisma.notification.createMany.mockResolvedValue({ count: 2 });
      // No untracked studies
      mockPrisma.study.findMany.mockResolvedValue([]);

      await service.checkSlaDeadlines();

      // SlaTracking should be updated to breached
      expect(mockPrisma.slaTracking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tracking-1' },
          data: expect.objectContaining({ status: 'breached' }),
        }),
      );

      // Breach notification should be created
      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ type: NotificationType.sla_breach }),
          ]),
        }),
      );
    });

    it('should escalate STAT breaches with a stat_alert notification', async () => {
      const now = new Date();
      const pastDeadline = new Date(now.getTime() - 60_000);

      mockPrisma.slaTracking.findMany.mockResolvedValue([
        {
          id: 'tracking-stat',
          deadlineAt: pastDeadline,
          breachedAt: null,
          warningSentAt: null,
          study: {
            id: 'study-stat',
            priority: StudyPriority.stat,
            status: StudyStatus.assigned,
            receivedAt: new Date(now.getTime() - 2 * 60 * 60_000),
            assignments: [],
          },
          slaConfig: { warningThresholdPercent: 75 },
        },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
      mockPrisma.slaTracking.update.mockResolvedValue({});
      mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.study.findMany.mockResolvedValue([]);

      await service.checkSlaDeadlines();

      // Two createMany calls: breach + stat escalation
      const calls = mockPrisma.notification.createMany.mock.calls;
      const allTypes = calls.flatMap((c: any[]) =>
        (c[0].data as any[]).map((n: any) => n.type),
      );
      expect(allTypes).toContain(NotificationType.sla_breach);
      expect(allTypes).toContain(NotificationType.stat_alert);
    });

    it('should send a warning when elapsed fraction meets the threshold', async () => {
      const now = new Date();
      const receivedAt = new Date(now.getTime() - 80 * 60_000); // 80 min ago
      const deadlineAt = new Date(now.getTime() + 20 * 60_000); // 20 min from now

      mockPrisma.slaTracking.findMany.mockResolvedValue([
        {
          id: 'tracking-warn',
          deadlineAt,
          breachedAt: null,
          warningSentAt: null,
          study: {
            id: 'study-warn',
            priority: StudyPriority.routine,
            status: StudyStatus.assigned,
            receivedAt,
            assignments: [{ radiologistId: 'rad-1' }],
          },
          slaConfig: { warningThresholdPercent: 75 },
        },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
      mockPrisma.slaTracking.update.mockResolvedValue({});
      mockPrisma.notification.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.study.findMany.mockResolvedValue([]);

      await service.checkSlaDeadlines();

      expect(mockPrisma.slaTracking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tracking-warn' },
          data: expect.objectContaining({ status: 'warning' }),
        }),
      );

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ type: NotificationType.sla_warning }),
          ]),
        }),
      );
    });

    it('should not re-send a warning when warningSentAt is already set', async () => {
      const now = new Date();
      const receivedAt = new Date(now.getTime() - 80 * 60_000);
      const deadlineAt = new Date(now.getTime() + 20 * 60_000);

      mockPrisma.slaTracking.findMany.mockResolvedValue([
        {
          id: 'tracking-already-warned',
          deadlineAt,
          breachedAt: null,
          warningSentAt: new Date(now.getTime() - 5 * 60_000), // already sent
          study: {
            id: 'study-warned',
            priority: StudyPriority.routine,
            status: StudyStatus.assigned,
            receivedAt,
            assignments: [],
          },
          slaConfig: { warningThresholdPercent: 75 },
        },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
      mockPrisma.study.findMany.mockResolvedValue([]);

      await service.checkSlaDeadlines();

      expect(mockPrisma.slaTracking.update).not.toHaveBeenCalled();
      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('should not re-send a breach notification when breachedAt is already set', async () => {
      const now = new Date();
      const pastDeadline = new Date(now.getTime() - 60_000);

      mockPrisma.slaTracking.findMany.mockResolvedValue([
        {
          id: 'tracking-already-breached',
          deadlineAt: pastDeadline,
          breachedAt: new Date(now.getTime() - 30_000), // already breached
          warningSentAt: new Date(now.getTime() - 60_000),
          study: {
            id: 'study-breached',
            priority: StudyPriority.stat,
            status: StudyStatus.assigned,
            receivedAt: new Date(now.getTime() - 2 * 60 * 60_000),
            assignments: [],
          },
          slaConfig: { warningThresholdPercent: 75 },
        },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
      mockPrisma.study.findMany.mockResolvedValue([]);

      await service.checkSlaDeadlines();

      expect(mockPrisma.slaTracking.update).not.toHaveBeenCalled();
      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('should detect breach for untracked studies using default thresholds', async () => {
      const now = new Date();

      // No tracked studies
      mockPrisma.slaTracking.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);

      // Untracked STAT study received 2 hours ago (threshold: 1 hour)
      mockPrisma.study.findMany.mockResolvedValue([
        {
          id: 'study-untracked',
          priority: StudyPriority.stat,
          status: StudyStatus.received,
          receivedAt: new Date(now.getTime() - 2 * 60 * 60_000),
          assignments: [],
        },
      ]);
      mockPrisma.notification.findFirst.mockResolvedValue(null); // not yet notified
      mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });

      await service.checkSlaDeadlines();

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ type: NotificationType.sla_breach }),
          ]),
        }),
      );
    });

    it('should not send breach for untracked studies within the SLA window', async () => {
      const now = new Date();

      mockPrisma.slaTracking.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);

      // STAT study received 30 minutes ago (threshold: 1 hour) — not yet breached
      mockPrisma.study.findMany.mockResolvedValue([
        {
          id: 'study-ok',
          priority: StudyPriority.stat,
          status: StudyStatus.received,
          receivedAt: new Date(now.getTime() - 30 * 60_000),
          assignments: [],
        },
      ]);

      await service.checkSlaDeadlines();

      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('should not re-send breach for untracked study already notified', async () => {
      const now = new Date();

      mockPrisma.slaTracking.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
      mockPrisma.study.findMany.mockResolvedValue([
        {
          id: 'study-already',
          priority: StudyPriority.stat,
          status: StudyStatus.received,
          receivedAt: new Date(now.getTime() - 2 * 60 * 60_000),
          assignments: [],
        },
      ]);
      mockPrisma.notification.findFirst.mockResolvedValue({ id: 'notif-1' }); // already sent

      await service.checkSlaDeadlines();

      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });
  });
});
