import { describe, expect, it } from 'vitest';
import {
  decideGuard,
  PENDING_DESTINATION_KEY,
  readPendingDestination,
  safeDestination,
  takeAfterOnboardingDestination,
  writePendingDestination,
} from './guardDecision';
import { logLink, normalizePath, ROUTES, routeInfo, TOUCH_GRASS_LINK } from './routes';

const base = { hydrated: true, onboarded: false };

describe('routeInfo', () => {
  it('knows which chrome every route gets', () => {
    expect(routeInfo('/').shell).toBe('marketing');
    expect(routeInfo('/methodology').shell).toBe('marketing');
    expect(routeInfo('/privacy').shell).toBe('marketing');
    expect(routeInfo('/start').shell).toBe('onboarding');
    for (const path of [
      '/today',
      '/log',
      '/quests',
      '/learn',
      '/impact',
      '/community',
      '/coach',
      '/me',
    ]) {
      expect(routeInfo(path).shell, path).toBe('app');
    }
    expect(routeInfo('/nowhere').shell).toBe('bare');
    expect(routeInfo('/dev/ui').shell).toBe('bare');
  });

  it('marks the destination a path belongs to', () => {
    expect(routeInfo('/today').section).toBe('today');
    expect(routeInfo('/learn/the-blanket')).toMatchObject({ id: 'lesson', section: 'learn' });
    // Impact, Community and the Coach are reached from Me.
    for (const path of ['/impact', '/community', '/coach', '/me']) {
      expect(routeInfo(path).section, path).toBe('me');
    }
    expect(routeInfo('/learn/a/b').shell).toBe('bare');
  });

  it('ignores a trailing slash, a query and a hash', () => {
    expect(normalizePath('/learn/')).toBe('/learn');
    expect(normalizePath('/log?a=x#top')).toBe('/log');
    expect(normalizePath('')).toBe('/');
    expect(routeInfo('/today/').id).toBe('today');
  });
});

describe('links', () => {
  it('builds the prefilled log link the Log page reads', () => {
    expect(logLink('bike-instead-of-car')).toBe('/log?a=bike-instead-of-car');
    expect(logLink('bike-instead-of-car', 5)).toBe('/log?a=bike-instead-of-car&q=5');
    expect(logLink('plant-based-meal', 2, 'coach')).toBe('/log?a=plant-based-meal&q=2&src=coach');
    expect(logLink('plant-based-meal', Number.NaN)).toBe('/log?a=plant-based-meal');
    expect(TOUCH_GRASS_LINK).toBe('/today?break=1');
  });
});

describe('decideGuard', () => {
  it('waits on app routes and onboarding until the saved state is read', () => {
    expect(decideGuard({ pathname: '/today', hydrated: false, onboarded: false })).toEqual({
      kind: 'wait',
    });
    expect(decideGuard({ pathname: '/start', hydrated: false, onboarded: false })).toEqual({
      kind: 'wait',
    });
  });

  it('never makes public pages wait', () => {
    for (const pathname of ['/', '/methodology', '/privacy', '/no-such-page']) {
      expect(decideGuard({ pathname, hydrated: false, onboarded: false }), pathname).toEqual({
        kind: 'allow',
      });
    }
  });

  it('sends a user with a tree from the landing page to Today', () => {
    expect(decideGuard({ ...base, pathname: '/', onboarded: true })).toEqual({
      kind: 'redirect',
      to: ROUTES.today,
    });
    expect(decideGuard({ ...base, pathname: '/' })).toEqual({ kind: 'allow' });
  });

  it('sends a user without a tree from every app route to onboarding', () => {
    for (const pathname of [
      '/today',
      '/log',
      '/quests',
      '/learn',
      '/learn/x',
      '/impact',
      '/community',
      '/coach',
      '/me',
    ]) {
      expect(decideGuard({ ...base, pathname }), pathname).toMatchObject({
        kind: 'redirect',
        to: ROUTES.start,
      });
    }
  });

  it('lets a user with a tree into every app route', () => {
    for (const pathname of ['/today', '/log', '/learn/x', '/me']) {
      expect(decideGuard({ ...base, pathname, onboarded: true }), pathname).toEqual({
        kind: 'allow',
      });
    }
  });

  it('keeps methodology, privacy and the 404 open to everyone', () => {
    for (const onboarded of [true, false]) {
      for (const pathname of ['/methodology', '/privacy', '/whatever']) {
        expect(decideGuard({ ...base, pathname, onboarded })).toEqual({ kind: 'allow' });
      }
    }
  });

  it('remembers a challenge link across onboarding', () => {
    const decision = decideGuard({ ...base, pathname: '/community', hash: '#c=abc_DEF-123' });
    expect(decision).toEqual({
      kind: 'redirect',
      to: ROUTES.start,
      remember: '/community#c=abc_DEF-123',
    });
  });

  it('remembers a prefilled log link, query included', () => {
    expect(decideGuard({ ...base, pathname: '/log', search: 'a=plant-based-meal&q=2' })).toEqual({
      kind: 'redirect',
      to: ROUTES.start,
      remember: '/log?a=plant-based-meal&q=2',
    });
  });

  it('does not bother remembering a plain visit to Today', () => {
    expect(decideGuard({ ...base, pathname: '/today' })).toEqual({
      kind: 'redirect',
      to: ROUTES.start,
      remember: undefined,
    });
  });

  it('lets a user without a tree stay on onboarding', () => {
    expect(decideGuard({ ...base, pathname: '/start' })).toEqual({ kind: 'allow' });
  });

  it('sends a user who arrives on onboarding with a tree to where they were going', () => {
    expect(decideGuard({ ...base, pathname: '/start', onboarded: true })).toEqual({
      kind: 'redirect',
      to: ROUTES.today,
    });
    expect(
      decideGuard({
        ...base,
        pathname: '/start',
        onboarded: true,
        pending: '/community#c=abc',
      }),
    ).toEqual({ kind: 'redirect', to: '/community#c=abc' });
  });

  it('ignores a remembered destination that is not an app route', () => {
    for (const pending of ['https://evil.example/', '//evil.example', '/start', '/', '/privacy']) {
      expect(
        decideGuard({ ...base, pathname: '/start', onboarded: true, pending }),
        pending,
      ).toEqual({ kind: 'redirect', to: ROUTES.today });
    }
  });

  it('returns to the landing page after a reset instead of starting onboarding', () => {
    expect(decideGuard({ ...base, pathname: '/me', justReset: true })).toEqual({
      kind: 'redirect',
      to: ROUTES.landing,
    });
  });
});

describe('safeDestination', () => {
  it('accepts only same-origin app paths', () => {
    expect(safeDestination('/quests')).toBe('/quests');
    expect(safeDestination('/log?a=x&q=2')).toBe('/log?a=x&q=2');
    expect(safeDestination('/community#c=abc')).toBe('/community#c=abc');
    expect(safeDestination(null)).toBeNull();
    expect(safeDestination('')).toBeNull();
    expect(safeDestination('quests')).toBeNull();
    expect(safeDestination('//example.com/today')).toBeNull();
    expect(safeDestination('/\\example.com')).toBeNull();
    expect(safeDestination('javascript:alert(1)')).toBeNull();
    expect(safeDestination(`/today?x=${'a'.repeat(3000)}`)).toBeNull();
  });
});

describe('the remembered destination', () => {
  it('survives in session storage and is forgotten once used', () => {
    writePendingDestination('/community#c=abc');
    expect(window.sessionStorage.getItem(PENDING_DESTINATION_KEY)).toBe('/community#c=abc');
    expect(readPendingDestination()).toBe('/community#c=abc');
    expect(takeAfterOnboardingDestination()).toBe('/community#c=abc');
    expect(readPendingDestination()).toBeNull();
    expect(takeAfterOnboardingDestination()).toBe(ROUTES.today);
  });

  it('never returns something tampered with', () => {
    window.sessionStorage.setItem(PENDING_DESTINATION_KEY, 'https://evil.example/');
    expect(readPendingDestination()).toBeNull();
  });
});
