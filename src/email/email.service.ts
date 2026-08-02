import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { Resend } from 'resend';

type AlertTemplateVariant =
  | 'recovery'
  | 'pending-activation'
  | 'activated'
  | 'generic';

/**
 * Servicio para el envío de correos electrónicos.
 *
 * @remarks
 * Utilizado principalmente para enviar códigos de recuperación de contraseña y otras notificaciones por email.
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly resend: Resend;
  private readonly logger = new Logger(EmailService.name);
  private readonly from: string;

  /**
   * Inicializa el cliente de Resend.
   *
   * @remarks
   * Requiere RESEND_API_KEY y EMAIL_FROM (remitente verificado en Resend).
   * Se permite inyectar un cliente para facilitar el testing.
   */
  constructor(@Optional() resendClient?: Resend) {
    const apiKey = process.env.RESEND_API_KEY ?? '';
    this.resend = resendClient ?? new Resend(apiKey);
    this.from = (process.env.EMAIL_FROM ?? '').trim();
  }

  onModuleInit() {
    // Resend no tiene "verify()" como SMTP; validamos configuración mínima.
    if (!process.env.RESEND_API_KEY) {
      this.logger.error('Falta RESEND_API_KEY. El envío de correos fallará.');
    }
    if (!this.from) {
      this.logger.error(
        'Falta EMAIL_FROM (remitente). Debe ser un "from" verificado en Resend.',
      );
    }
  }

  async sendRecoveryEmail(to: string, recoveryCode: string): Promise<void> {
    const subject = 'Recupera tu acceso a Beacon';
    const safeCode = this.escapeHtml(recoveryCode.trim().toUpperCase());
    const contentHtml = [
      '<p style="margin:0 0 12px;color:#1E293B;font-size:15px;line-height:1.55;">',
      'Recibimos una solicitud para restablecer la contraseña de tu cuenta en Beacon.',
      '</p>',
      '<p style="margin:0 0 12px;color:#1E293B;font-size:15px;line-height:1.55;">',
      'Usa este código en el formulario de recuperación:',
      '</p>',
      '<div style="margin:18px 0;padding:16px;border:1px solid #E2E8F0;border-radius:12px;background:#F8FAFC;text-align:center;">',
      '<span style="display:block;color:#64748B;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">Código de recuperación</span>',
      `<span style="display:block;color:#183A72;font-size:28px;font-weight:700;letter-spacing:0.2em;margin-top:8px;">${safeCode}</span>`,
      '</div>',
      '<p style="margin:0 0 8px;color:#1E293B;font-size:15px;line-height:1.55;">Este código vence en 15 minutos.</p>',
      '<p style="margin:0;color:#64748B;font-size:14px;line-height:1.55;">Si no solicitaste este cambio, puedes ignorar este correo con tranquilidad.</p>',
    ].join('');

    await this.sendTemplatedEmail({
      to,
      subject,
      preheader: 'Tu código para volver a Beacon',
      contentHtml,
      variant: 'recovery',
      withSuccessLog: true,
    });
  }

  async sendAccountCreatedEmail(
    to: string,
    recipientName: string,
    roleLabel: string,
  ): Promise<void> {
    const subject = 'Bienvenido a Beacon: cuenta pendiente de activación';
    const safeRecipientName = this.escapeHtml(recipientName.trim());
    const safeRoleLabel = this.escapeHtml(roleLabel.trim());

    const contentHtml = [
      `<p style="margin:0 0 12px;color:#1E293B;font-size:15px;line-height:1.55;">Hola ${safeRecipientName},</p>`,
      '<p style="margin:0 0 12px;color:#1E293B;font-size:15px;line-height:1.55;">',
      'Tu cuenta en Beacon se creó correctamente. Antes de entrar, un administrador debe activar tu acceso.',
      '</p>',
      '<div style="margin:18px 0;padding:14px 16px;border:1px solid #E2E8F0;border-radius:12px;background:#FFFBEB;">',
      '<p style="margin:0 0 4px;color:#B45309;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Estado</p>',
      '<p style="margin:0;color:#1E293B;font-size:15px;line-height:1.55;"><strong>Pendiente de activación</strong></p>',
      '</div>',
      `<p style="margin:0 0 8px;color:#1E293B;font-size:15px;line-height:1.55;">Rol asignado: <strong>${safeRoleLabel}</strong></p>`,
      '<p style="margin:0;color:#64748B;font-size:14px;line-height:1.55;">',
      'Te avisaremos por correo cuando tu cuenta quede activa y puedas empezar a usar Beacon.',
      '</p>',
    ].join('');

    await this.sendTemplatedEmail({
      to,
      subject,
      preheader: 'Tu cuenta está lista; falta la activación de un administrador.',
      contentHtml,
      variant: 'pending-activation',
      withSuccessLog: false,
    });
  }

  async sendAccountActivatedEmail(
    to: string,
    recipientName: string,
    roleLabel: string,
  ): Promise<void> {
    const subject = 'Tu cuenta Beacon ya está activa';
    const safeRecipientName = this.escapeHtml(recipientName.trim());
    const safeRoleLabel = this.escapeHtml(roleLabel.trim());

    const contentHtml = [
      `<p style="margin:0 0 12px;color:#1E293B;font-size:15px;line-height:1.55;">Hola ${safeRecipientName},</p>`,
      '<p style="margin:0 0 12px;color:#1E293B;font-size:15px;line-height:1.55;">',
      'Tu cuenta fue activada. Ya puedes iniciar sesión y mantener el rumbo de tus finanzas, hábitos y rutina diaria.',
      '</p>',
      '<div style="margin:18px 0;padding:14px 16px;border:1px solid #BBF7D0;border-radius:12px;background:#F0FDF4;">',
      '<p style="margin:0 0 4px;color:#15803D;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Estado</p>',
      '<p style="margin:0;color:#14532D;font-size:15px;line-height:1.55;"><strong>Activa</strong></p>',
      '</div>',
      `<p style="margin:0 0 8px;color:#1E293B;font-size:15px;line-height:1.55;">Rol asignado: <strong>${safeRoleLabel}</strong></p>`,
      '<p style="margin:0;color:#64748B;font-size:14px;line-height:1.55;">',
      'Si no reconoces esta activación, contacta al administrador de tu espacio Beacon.',
      '</p>',
    ].join('');

    await this.sendTemplatedEmail({
      to,
      subject,
      preheader: 'Ya puedes entrar a Beacon.',
      contentHtml,
      variant: 'activated',
      withSuccessLog: false,
    });
  }

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    const isHtml = this.looksLikeHtml(body);
    const contentHtml = isHtml ? body : this.toParagraphHtml(body);

    await this.sendTemplatedEmail({
      to,
      subject,
      preheader: subject,
      contentHtml,
      variant: 'generic',
      withSuccessLog: false,
    });
  }

  async sendReminderNotificationEmail(
    to: string,
    params: { title: string; whenLabel: string; link?: string },
  ): Promise<void> {
    const subject = `Aviso: ${params.title.trim()}`;
    const safeTitle = this.escapeHtml(params.title.trim());
    const safeWhen = this.escapeHtml(params.whenLabel.trim());
    const link = params.link?.trim();

    const contentHtml = [
      '<p style="margin:0 0 12px;color:#1E293B;font-size:15px;line-height:1.55;">',
      'Tienes un recordatorio próximo en Beacon.',
      '</p>',
      '<div style="margin:18px 0;padding:14px 16px;border:1px solid #E2E8F0;border-radius:12px;background:#F8FAFC;">',
      `<p style="margin:0 0 6px;color:#183A72;font-size:17px;font-weight:700;">${safeTitle}</p>`,
      `<p style="margin:0;color:#64748B;font-size:14px;line-height:1.55;">${safeWhen}</p>`,
      '</div>',
      link
        ? [
            '<p style="margin:0 0 16px;">',
            `<a href="${this.escapeHtml(link)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#183A72;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;">Ver en Beacon</a>`,
            '</p>',
          ].join('')
        : '',
      '<p style="margin:0;color:#64748B;font-size:14px;line-height:1.55;">Si ya lo resolviste, puedes ignorar este correo.</p>',
    ].join('');

    await this.sendTemplatedEmail({
      to,
      subject,
      preheader: `Recordatorio: ${params.title.trim()}`,
      contentHtml,
      variant: 'generic',
      withSuccessLog: false,
    });
  }

  async sendInviteEmail(
    to: string,
    params: {
      resourceKind: 'calendar' | 'finance';
      resourceName: string;
      inviterName: string;
      roleLabel: string;
      acceptUrl: string;
    },
  ): Promise<void> {
    const kindLabel =
      params.resourceKind === 'calendar' ? 'calendario' : 'espacio de finanzas';
    const subject = `Invitación a ${kindLabel} en Beacon`;
    const safeName = this.escapeHtml(params.resourceName.trim());
    const safeInviter = this.escapeHtml(params.inviterName.trim());
    const safeRole = this.escapeHtml(params.roleLabel.trim());
    const safeUrl = this.escapeHtml(params.acceptUrl.trim());

    const contentHtml = [
      `<p style="margin:0 0 12px;color:#1E293B;font-size:15px;line-height:1.55;">Hola,</p>`,
      `<p style="margin:0 0 12px;color:#1E293B;font-size:15px;line-height:1.55;">`,
      `<strong>${safeInviter}</strong> te invitó a compartir el ${kindLabel} <strong>${safeName}</strong> en Beacon.`,
      '</p>',
      `<p style="margin:0 0 12px;color:#1E293B;font-size:15px;line-height:1.55;">Rol propuesto: <strong>${safeRole}</strong></p>`,
      '<p style="margin:0 0 16px;">',
      `<a href="${safeUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#183A72;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;">Aceptar invitación</a>`,
      '</p>',
      '<p style="margin:0;color:#64748B;font-size:14px;line-height:1.55;">',
      'Debes iniciar sesión con este mismo correo. El enlace vence en 7 días.',
      '</p>',
    ].join('');

    await this.sendTemplatedEmail({
      to,
      subject,
      preheader: `Te invitaron a ${params.resourceName.trim()}`,
      contentHtml,
      variant: 'generic',
      withSuccessLog: true,
    });
  }

  private async sendTemplatedEmail({
    to,
    subject,
    preheader,
    contentHtml,
    variant,
    withSuccessLog,
  }: {
    to: string;
    subject: string;
    preheader: string;
    contentHtml: string;
    variant: AlertTemplateVariant;
    withSuccessLog: boolean;
  }): Promise<void> {
    const html = this.buildBeaconTemplate(
      subject,
      contentHtml,
      preheader,
      variant,
    );
    const text = this.stripHtml(html);

    await this.dispatchEmail(to, subject, html, text, withSuccessLog);
  }

  private async dispatchEmail(
    to: string,
    subject: string,
    html: string,
    text: string,
    withSuccessLog: boolean,
  ): Promise<void> {
    try {
      await this.resend.emails.send({
        from: this.from,
        to: [to],
        subject,
        html,
        text,
      });

      if (withSuccessLog) {
        this.logger.log('Correo enviado a: ' + to);
      }
    } catch (error: any) {
      this.logger.error(
        `Error enviando correo (Resend) a ${to}: ${error?.message ?? error}`,
        error?.stack,
      );
      throw error;
    }
  }

  private buildBeaconTemplate(
    subject: string,
    contentHtml: string,
    preheader: string,
    variant: AlertTemplateVariant,
  ): string {
    const safeSubject = this.escapeHtml(subject);
    const safePreheader = this.escapeHtml(preheader);

    const themeByVariant: Record<
      AlertTemplateVariant,
      {
        headerBackground: string;
        eyebrow: string;
        borderColor: string;
        noteAccentColor: string;
        noteBackground: string;
        footerBackground: string;
      }
    > = {
      recovery: {
        headerBackground: '#183A72',
        eyebrow: 'Seguridad de cuenta',
        borderColor: '#E2E8F0',
        noteAccentColor: '#4A90E2',
        noteBackground: '#F8FAFC',
        footerBackground: '#F8FAFC',
      },
      'pending-activation': {
        headerBackground: '#183A72',
        eyebrow: 'Activación pendiente',
        borderColor: '#E2E8F0',
        noteAccentColor: '#F59E0B',
        noteBackground: '#FFFBEB',
        footerBackground: '#F8FAFC',
      },
      activated: {
        headerBackground: '#183A72',
        eyebrow: 'Cuenta lista',
        borderColor: '#E2E8F0',
        noteAccentColor: '#22C55E',
        noteBackground: '#F0FDF4',
        footerBackground: '#F8FAFC',
      },
      generic: {
        headerBackground: '#183A72',
        eyebrow: 'Beacon',
        borderColor: '#E2E8F0',
        noteAccentColor: '#FFC857',
        noteBackground: '#F8FAFC',
        footerBackground: '#F8FAFC',
      },
    };

    const theme = themeByVariant[variant];

    return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeSubject}</title>
  </head>
  <body style="margin:0;padding:0;background:#F8FAFC;color:#1E293B;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${safePreheader}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#F8FAFC;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;border-collapse:collapse;border:1px solid ${theme.borderColor};border-radius:14px;overflow:hidden;background:#FFFFFF;font-family:Manrope, Segoe UI, Arial, Helvetica, sans-serif;">
            <tr>
              <td style="padding:22px 24px;background:${theme.headerBackground};color:#FFFFFF;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#FFC857;">${theme.eyebrow}</p>
                <p style="margin:0 0 4px;font-size:13px;opacity:0.88;">Beacon</p>
                <h1 style="margin:0;font-size:22px;line-height:1.25;font-weight:700;color:#FFFFFF;">${safeSubject}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">${contentHtml}</td>
            </tr>
            <tr>
              <td style="padding:0 24px 20px;">
                <p style="margin:0;padding:12px 14px;border-left:4px solid ${theme.noteAccentColor};background:${theme.noteBackground};color:#64748B;font-size:13px;line-height:1.5;">
                  Este es un mensaje automático de Beacon. No respondas a este correo.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 24px;border-top:1px solid #E2E8F0;background:${theme.footerBackground};color:#64748B;font-size:12px;line-height:1.45;">
                Beacon · Tu faro personal para finanzas, hábitos y rutina diaria
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  private toParagraphHtml(text: string): string {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return '<p style="margin:0;color:#1E293B;font-size:15px;line-height:1.55;">Sin contenido.</p>';
    }

    return lines
      .map(
        (line) =>
          `<p style="margin:0 0 12px;color:#1E293B;font-size:15px;line-height:1.55;">${this.escapeHtml(line)}</p>`,
      )
      .join('');
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private looksLikeHtml(body: string): boolean {
    return /<!doctype html>|<html[\s>]|<body[\s>]|<\/(div|p|table|tr|td|span|h1|h2|h3)>/i.test(
      body,
    );
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<\/p>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?[^>]+(>|$)/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
