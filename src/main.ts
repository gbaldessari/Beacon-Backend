import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

/**
 * Punto de entrada principal de la aplicación.
 *
 * @remarks
 * Inicializa la aplicación NestJS, configura validaciones globales y habilita CORS.
 */
async function bootstrap() {
  /**
   * Crea una instancia de la aplicación NestJS utilizando el módulo raíz `AppModule`.
   */
  const app = await NestFactory.create(AppModule);

  /**
   * Amplía el límite del parser para aceptar imágenes base64 enviadas por el chat.
   */
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );
    next();
  });

  /**
   * Aplica un pipe global de validación para transformar y validar los datos entrantes.
   */
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  /**
   * Habilita CORS para permitir solicitudes desde el frontend.
   * Configura los orígenes permitidos, métodos HTTP y credenciales.
   */
  app.enableCors({
    origin: [process.env.FRONTEND_URL], // Permitir solicitudes desde el frontend especificado en las variables de entorno.
    methods: 'GET,POST,PUT,DELETE,PATCH', // Métodos HTTP permitidos.
    credentials: true, // Permitir el envío de cookies o encabezados de autenticación.
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  /**
   * Inicia el servidor en el puerto especificado en las variables de entorno o en el puerto 3000 por defecto.
   */
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
