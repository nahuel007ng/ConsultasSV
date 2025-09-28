import * as nodemailer from 'nodemailer';
import * as fs from 'fs';

export type MailAttachment = { filename: string; path: string };

export class MailerService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: +(process.env.SMTP_PORT || 587),
      secure: (process.env.SMTP_SECURE || 'false') === 'true',
    });
  }

  async sendMail(to: string, subject: string, text: string, attachments?: MailAttachment[]) {
    const att = (attachments || []).filter(a => fs.existsSync(a.path));
    return this.transporter.sendMail({
      from: process.env.MAIL_FROM || 'no-reply@seguridadvial.local',
      to, subject, text, attachments: att,
    });
  }
}
