/**
 * Roles funcionales reconocidos por la plataforma.
 *
 * Estos códigos se guardan en usuarios, viajan en JWT y se usan en guards para
 * controlar acceso a funciones administrativas u operacionales.
 */
export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
}
