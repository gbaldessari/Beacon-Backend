import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { EmailModule } from './email/email.module';
import { RemindersModule } from './reminders/reminders.module';

/**
 * Módulo raíz de la aplicación backend.
 *
 * Configura variables globales, conexión TypeORM con migraciones automáticas y
 * registra los módulos operacionales expuestos por la API.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: Number(configService.get<string>('DB_PORT')),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        autoLoadEntities: true,
        migrationsRun: true,
        migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
        synchronize: configService.get<string>('DB_SYNC') === 'true',
      }),
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    EmailModule,
    RemindersModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
