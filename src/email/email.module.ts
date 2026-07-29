import { Module } from '@nestjs/common';
import { EmailService } from './email.service';

/**
 * Módulo de Email.
 *
 * @remarks
 * Gestiona la configuración y exportación del servicio de envío de correos electrónicos para su uso en otros módulos.
 */
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
