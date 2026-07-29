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
    const subject = 'Recuperación de contraseña';
    const safeCode = this.escapeHtml(recoveryCode.trim().toUpperCase());
    const contentHtml = [
      '<p style="margin:0 0 12px;color:#24364a;font-size:15px;line-height:1.55;">',
      'Recibimos una solicitud para recuperar la contraseña de tu cuenta en la Plataforma Beacon.',
      '</p>',
      '<p style="margin:0 0 12px;color:#24364a;font-size:15px;line-height:1.55;">',
      'Ingresa el siguiente código en el formulario de restablecimiento:',
      '</p>',
      '<div style="margin:18px 0;padding:16px;border:1px dashed #9eb6cd;border-radius:10px;background:#f2f7fc;text-align:center;">',
      '<span style="display:block;color:#4a5f74;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Código de recuperación</span>',
      `<span style="display:block;color:#25306b;font-size:31px;font-weight:700;letter-spacing:0.22em;margin-top:6px;">${safeCode}</span>`,
      '</div>',
      '<p style="margin:0 0 8px;color:#24364a;font-size:15px;line-height:1.55;">Este código vence en 15 minutos.</p>',
      '<p style="margin:0;color:#4a5f74;font-size:14px;line-height:1.55;">Si no solicitaste este cambio, ignora este correo.</p>',
    ].join('');

    await this.sendTemplatedEmail({
      to,
      subject,
      preheader: 'Código de recuperación de cuenta',
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
    const subject = 'Registro recibido: cuenta pendiente de activación';
    const safeRecipientName = this.escapeHtml(recipientName.trim());
    const safeRoleLabel = this.escapeHtml(roleLabel.trim());

    const contentHtml = [
      `<p style="margin:0 0 12px;color:#24364a;font-size:15px;line-height:1.55;">Hola ${safeRecipientName},</p>`,
      '<p style="margin:0 0 12px;color:#24364a;font-size:15px;line-height:1.55;">',
      'Tu cuenta fue creada correctamente y se encuentra pendiente de activación.',
      '</p>',
      '<div style="margin:18px 0;padding:14px 16px;border:1px solid #e6d9bd;border-radius:10px;background:#fff9ec;">',
      '<p style="margin:0 0 4px;color:#8d6400;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">Estado de cuenta</p>',
      '<p style="margin:0;color:#4b4f56;font-size:15px;line-height:1.55;"><strong>Pendiente de activación</strong></p>',
      '</div>',
      `<p style="margin:0 0 8px;color:#24364a;font-size:15px;line-height:1.55;">Rol asignado: <strong>${safeRoleLabel}</strong></p>`,
      '<p style="margin:0;color:#4a5f74;font-size:14px;line-height:1.55;">',
      'Un administrador debe habilitar tu acceso antes de que puedas iniciar sesión. ',
      'Te notificaremos por correo cuando tu cuenta quede activa.',
      '</p>',
    ].join('');

    await this.sendTemplatedEmail({
      to,
      subject,
      preheader:
        'Tu cuenta está en espera de habilitación por un administrador.',
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
    const subject = 'Cuenta activada: ya puedes ingresar';
    const safeRecipientName = this.escapeHtml(recipientName.trim());
    const safeRoleLabel = this.escapeHtml(roleLabel.trim());

    const contentHtml = [
      `<p style="margin:0 0 12px;color:#24364a;font-size:15px;line-height:1.55;">Hola ${safeRecipientName},</p>`,
      '<p style="margin:0 0 12px;color:#24364a;font-size:15px;line-height:1.55;">',
      'Tu cuenta fue activada por un administrador y ya puedes iniciar sesión en la plataforma.',
      '</p>',
      '<div style="margin:18px 0;padding:14px 16px;border:1px solid #b8deca;border-radius:10px;background:#effaf4;">',
      '<p style="margin:0 0 4px;color:#176744;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">Estado de cuenta</p>',
      '<p style="margin:0;color:#1f5137;font-size:15px;line-height:1.55;"><strong>Activa y habilitada</strong></p>',
      '</div>',
      `<p style="margin:0 0 8px;color:#24364a;font-size:15px;line-height:1.55;">Rol asignado: <strong>${safeRoleLabel}</strong></p>`,
      '<p style="margin:0;color:#4a5f74;font-size:14px;line-height:1.55;">',
      'Si detectas una actividad no reconocida en tu cuenta, contacta al equipo administrador de Beacon.',
      '</p>',
    ].join('');

    await this.sendTemplatedEmail({
      to,
      subject,
      preheader: 'Tu cuenta fue habilitada. Ya puedes acceder al sistema.',
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
    const html = this.buildGovernmentTemplate(
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

  private buildGovernmentTemplate(
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
        headerGradient: string;
        borderColor: string;
        noteAccentColor: string;
        noteBackground: string;
        footerBackground: string;
      }
    > = {
      recovery: {
        headerGradient: 'linear-gradient(135deg,#25306b 0%,#006bb9 100%)',
        borderColor: '#d6dce8',
        noteAccentColor: '#d52b1e',
        noteBackground: '#f8fbff',
        footerBackground: '#f4f7fa',
      },
      'pending-activation': {
        headerGradient: 'linear-gradient(135deg,#6b5a25 0%,#b68a0f 100%)',
        borderColor: '#e5dcc7',
        noteAccentColor: '#8d6400',
        noteBackground: '#fff9ec',
        footerBackground: '#fbf8f0',
      },
      activated: {
        headerGradient: 'linear-gradient(135deg,#1f6b4e 0%,#2f8f67 100%)',
        borderColor: '#cfe4d8',
        noteAccentColor: '#176744',
        noteBackground: '#effaf4',
        footerBackground: '#f3faf6',
      },
      generic: {
        headerGradient: 'linear-gradient(135deg,#25306b 0%,#006bb9 100%)',
        borderColor: '#d6dce8',
        noteAccentColor: '#d52b1e',
        noteBackground: '#f8fbff',
        footerBackground: '#f4f7fa',
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
  <body style="margin:0;padding:0;background:#edf0f5;color:#1a1e3a;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${safePreheader}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#edf0f5;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border-collapse:collapse;border:1px solid ${theme.borderColor};border-radius:12px;overflow:hidden;background:#ffffff;font-family:Segoe UI, Arial, Helvetica, sans-serif;">
            <tr>
              <td style="padding:20px 24px;background:${theme.headerGradient};color:#ffffff;">
                <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.92;">Gobierno de Chile · Ministerio de Transportes y Telecomunicaciones</p>
                <h1 style="margin:0;font-size:24px;line-height:1.2;font-weight:700;">${safeSubject}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">${contentHtml}</td>
            </tr>
            <tr>
              <td style="padding:0 24px 20px;">
                <p style="margin:0;padding:12px 14px;border-left:4px solid ${theme.noteAccentColor};background:${theme.noteBackground};color:#30465a;font-size:13px;line-height:1.5;">
                  Este es un mensaje automático de la Plataforma Beacon. No respondas directamente a este correo.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 24px;border-top:1px solid #dde4ee;background:${theme.footerBackground};color:#4d6174;font-size:12px;line-height:1.45;">
                Subsecretaría de Transportes · Unidad Operativa de Control de Tránsito
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
      return '<p style="margin:0;color:#24364a;font-size:15px;line-height:1.55;">Sin contenido.</p>';
    }

    return lines
      .map(
        (line) =>
          `<p style="margin:0 0 12px;color:#24364a;font-size:15px;line-height:1.55;">${this.escapeHtml(line)}</p>`,
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
