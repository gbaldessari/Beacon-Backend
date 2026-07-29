/**
 * Devuelve el secreto JWT obligatorio para firmar y validar tokens.
 */
export const getRequiredJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret) {
    throw new Error('JWT_SECRET must be defined');
  }

  return secret;
};
