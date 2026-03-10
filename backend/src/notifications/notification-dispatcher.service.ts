import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly gateway: NotificationsGateway,
  ) {
    this.initializeEmailTransport();
  }

  private initializeEmailTransport() {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    if (!smtpHost) {
      this.logger.warn(
        'SMTP_HOST not configured — email delivery disabled',
      );
      return;
    }

    const port = this.configService.get<number>('SMTP_PORT') ?? 587;
    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port,
      secure: port === 465,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
    this.logger.log(`Email transport initialised (${smtpHost}:${port})`);
  }

  /**
   * Every minute: push unread notifications from the last 5 minutes
   * to connected WebSocket clients, and send email for STAT/breach events.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async dispatchPendingNotifications(): Promise<void> {
    const since = new Date(Date.now() - 5 * 60 * 1000);

    const notifications = await this.prisma.notification.findMany({
      where: {
        isRead: false,
        createdAt: { gte: since },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (notifications.length === 0) return;

    this.logger.log(
      `Dispatching ${notifications.length} pending notification(s)`,
    );

    for (const notification of notifications) {
      // WebSocket — real-time in-app delivery
      this.gateway.sendNotificationToUser(notification.userId, {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        referenceType: notification.referenceType,
        referenceId: notification.referenceId,
        createdAt: notification.createdAt,
        isRead: notification.isRead,
      });

      // Email — send for high-priority notification types
      const emailTypes = ['stat_alert', 'sla_breach', 'dispute_filed'];
      if (emailTypes.includes(notification.type)) {
        await this.sendEmailNotification(notification);
      }
    }
  }

  async sendEmailNotification(notification: {
    title: string;
    message: string | null;
    user: {
      email: string;
      firstName: string | null;
      lastName: string | null;
    } | null;
  }): Promise<void> {
    if (!this.transporter || !notification.user?.email) {
      return;
    }

    const from =
      this.configService.get<string>('SMTP_FROM') ||
      'noreply@pacs-platform.local';

    try {
      await this.transporter.sendMail({
        from,
        to: notification.user.email,
        subject: notification.title,
        text: notification.message ?? notification.title,
        html: this.buildEmailHtml(notification),
      });
      this.logger.log(
        `Email delivered to ${notification.user.email}: ${notification.title}`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to deliver email to ${notification.user.email}: ${message}`,
      );
    }
  }

  private buildEmailHtml(notification: {
    title: string;
    message: string | null;
    user: { firstName: string | null; lastName: string | null } | null;
  }): string {
    const name =
      [notification.user?.firstName, notification.user?.lastName]
        .filter(Boolean)
        .join(' ') || 'User';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d5aa7;">PACS Platform Notification</h2>
        <p>Hello ${name},</p>
        <h3>${notification.title}</h3>
        ${notification.message ? `<p>${notification.message}</p>` : ''}
        <hr style="border: 1px solid #eee;" />
        <p style="color: #888; font-size: 12px;">
          This is an automated notification from the PACS Platform.
          Please do not reply to this email.
        </p>
      </div>
    `;
  }
}
