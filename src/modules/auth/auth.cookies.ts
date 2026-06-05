import { CookieOptions, Response } from 'express';

export const REFRESH_COOKIE_NAME = 'leana_refresh_token';

export function buildRefreshCookieOptions(
  isProduction: boolean,
  domain: string,
  expires?: Date,
): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    domain: domain || undefined,
    path: '/',
    ...(expires ? { expires } : {}),
  };
}

export function setRefreshCookie(
  res: Response,
  token: string,
  expires: Date,
  isProduction: boolean,
  domain: string,
): void {
  res.cookie(REFRESH_COOKIE_NAME, token, buildRefreshCookieOptions(isProduction, domain, expires));
}

export function clearRefreshCookie(res: Response, isProduction: boolean, domain: string): void {
  res.clearCookie(REFRESH_COOKIE_NAME, buildRefreshCookieOptions(isProduction, domain));
}
