import { Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { EmailService } from '../email.service';

const sendMock = jest.fn();
const resendCtorMock = jest.fn().mockImplementation(() => ({
  emails: { send: sendMock },
}));

jest.mock('resend', () => ({
  Resend: jest
    .fn()
    .mockImplementation((...args: any[]) => resendCtorMock(...args)),
}));

describe('EmailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RESEND_API_KEY = 'resend-key';
    process.env.EMAIL_FROM = '  noreply@ventasfama.com  ';
  });

  it('constructor() usa Resend con api key cuando no se inyecta cliente', async () => {
    const service = new EmailService();

    await service.sendRecoveryEmail('destino@correo.com', '123456');

    expect(Resend).toHaveBeenCalledWith('resend-key');
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'noreply@ventasfama.com',
        to: ['destino@correo.com'],
        subject: 'Recuperación de contraseña',
      }),
    );
  });

  it('constructor() usa fallback vacío cuando EMAIL_FROM es undefined', async () => {
    delete process.env.EMAIL_FROM;
    const injectedSend = jest.fn().mockResolvedValue(undefined);

    const service = new EmailService({
      emails: { send: injectedSend },
    } as unknown as Resend);
    await service.sendEmail('a@correo.com', 'S', 'texto');

    expect(injectedSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '',
        to: ['a@correo.com'],
        subject: 'S',
        html: expect.any(String),
        text: expect.stringContaining('texto'),
      }),
    );
  });

  it('sendRecoveryEmail() usa cliente inyectado y registra log en éxito', async () => {
    const injectedSend = jest.fn().mockResolvedValue(undefined);
    const resendClient = {
      emails: { send: injectedSend },
    } as unknown as Resend;
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    const service = new EmailService(resendClient);
    await service.sendRecoveryEmail('ok@correo.com', '999999');

    expect(injectedSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'noreply@ventasfama.com',
        to: ['ok@correo.com'],
        subject: 'Recuperación de contraseña',
        html: expect.stringContaining('999999'),
        text: expect.stringContaining('999999'),
      }),
    );
    expect(logSpy).toHaveBeenCalledWith('Correo enviado a: ok@correo.com');
  });

  it('sendAccountCreatedEmail() envía plantilla de cuenta pendiente de activación', async () => {
    const injectedSend = jest.fn().mockResolvedValue(undefined);
    const resendClient = {
      emails: { send: injectedSend },
    } as unknown as Resend;
    const service = new EmailService(resendClient);

    await service.sendAccountCreatedEmail(
      'nuevo@correo.com',
      'María González',
      'Carabinero',
    );

    expect(injectedSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'noreply@ventasfama.com',
        to: ['nuevo@correo.com'],
        subject: 'Registro recibido: cuenta pendiente de activación',
        html: expect.stringContaining('Pendiente de activación'),
        text: expect.stringContaining('María González'),
      }),
    );
  });

  it('sendAccountActivatedEmail() envía plantilla de cuenta activada', async () => {
    const injectedSend = jest.fn().mockResolvedValue(undefined);
    const resendClient = {
      emails: { send: injectedSend },
    } as unknown as Resend;
    const service = new EmailService(resendClient);

    await service.sendAccountActivatedEmail(
      'activo@correo.com',
      'José Muñoz',
      'Servicio de Salud',
    );

    expect(injectedSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'noreply@ventasfama.com',
        to: ['activo@correo.com'],
        subject: 'Cuenta activada: ya puedes ingresar',
        html: expect.stringContaining('Activa y habilitada'),
        text: expect.stringContaining('José Muñoz'),
      }),
    );
  });

  it('sendRecoveryEmail() registra error y relanza cuando falla resend', async () => {
    const err = new Error('boom');
    const injectedSend = jest.fn().mockRejectedValue(err);
    const resendClient = {
      emails: { send: injectedSend },
    } as unknown as Resend;
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const service = new EmailService(resendClient);

    await expect(
      service.sendRecoveryEmail('err@correo.com', '123'),
    ).rejects.toBe(err);
    expect(errorSpy).toHaveBeenCalledWith(
      'Error enviando correo (Resend) a err@correo.com: boom',
      err.stack,
    );
  });

  it('sendRecoveryEmail() cubre fallback de mensaje cuando el error no es objeto', async () => {
    const injectedSend = jest.fn().mockRejectedValue('string-error');
    const resendClient = {
      emails: { send: injectedSend },
    } as unknown as Resend;
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const service = new EmailService(resendClient);

    await expect(
      service.sendRecoveryEmail('err2@correo.com', '321'),
    ).rejects.toBe('string-error');
    expect(errorSpy).toHaveBeenCalledWith(
      'Error enviando correo (Resend) a err2@correo.com: string-error',
      undefined,
    );
  });

  it('sendEmail() envía texto plano cuando body no parece HTML', async () => {
    const injectedSend = jest.fn().mockResolvedValue(undefined);
    const resendClient = {
      emails: { send: injectedSend },
    } as unknown as Resend;
    const service = new EmailService(resendClient);

    await service.sendEmail('plain@correo.com', 'Asunto', 'Mensaje simple');

    expect(injectedSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'noreply@ventasfama.com',
        to: ['plain@correo.com'],
        subject: 'Asunto',
        html: expect.any(String),
        text: expect.stringContaining('Mensaje simple'),
      }),
    );
  });

  it('sendEmail() detecta HTML y genera text limpiando etiquetas/entidades', async () => {
    const injectedSend = jest.fn().mockResolvedValue(undefined);
    const resendClient = {
      emails: { send: injectedSend },
    } as unknown as Resend;
    const service = new EmailService(resendClient);
    const html =
      '<html><body><style>.x{}</style><script>alert(1)</script><p>Hola&nbsp;&amp;&quot;&#39;&lt;&gt;</p></body></html>';

    await service.sendEmail('html@correo.com', 'Html', html);

    expect(injectedSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'noreply@ventasfama.com',
        to: ['html@correo.com'],
        subject: 'Html',
        html: expect.stringContaining(
          '<p>Hola&nbsp;&amp;&quot;&#39;&lt;&gt;</p>',
        ),
        text: expect.stringContaining('Hola &"\'<>'),
      }),
    );
  });

  it('sendEmail() registra error y relanza cuando falla resend', async () => {
    const err = new Error('send-failed');
    const injectedSend = jest.fn().mockRejectedValue(err);
    const resendClient = {
      emails: { send: injectedSend },
    } as unknown as Resend;
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const service = new EmailService(resendClient);

    await expect(service.sendEmail('x@correo.com', 'S', 'Body')).rejects.toBe(
      err,
    );
    expect(errorSpy).toHaveBeenCalledWith(
      'Error enviando correo (Resend) a x@correo.com: send-failed',
      err.stack,
    );
  });

  it('sendEmail() cubre fallback de mensaje cuando el error no es objeto', async () => {
    const injectedSend = jest.fn().mockRejectedValue('plain-error');
    const resendClient = {
      emails: { send: injectedSend },
    } as unknown as Resend;
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const service = new EmailService(resendClient);

    await expect(service.sendEmail('z@correo.com', 'S', 'Body')).rejects.toBe(
      'plain-error',
    );
    expect(errorSpy).toHaveBeenCalledWith(
      'Error enviando correo (Resend) a z@correo.com: plain-error',
      undefined,
    );
  });

  it('onModuleInit() registra errores cuando faltan variables requeridas', () => {
    delete process.env.RESEND_API_KEY;
    process.env.EMAIL_FROM = '   ';
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const service = new EmailService({
      emails: { send: jest.fn() },
    } as unknown as Resend);
    service.onModuleInit();

    expect(errorSpy).toHaveBeenNthCalledWith(
      1,
      'Falta RESEND_API_KEY. El envío de correos fallará.',
    );
    expect(errorSpy).toHaveBeenNthCalledWith(
      2,
      'Falta EMAIL_FROM (remitente). Debe ser un "from" verificado en Resend.',
    );
  });

  it('onModuleInit() no registra errores con configuración válida', () => {
    process.env.RESEND_API_KEY = 'ok';
    process.env.EMAIL_FROM = 'from@ventasfama.com';
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const service = new EmailService({
      emails: { send: jest.fn() },
    } as unknown as Resend);
    service.onModuleInit();

    expect(errorSpy).not.toHaveBeenCalled();
  });
});
