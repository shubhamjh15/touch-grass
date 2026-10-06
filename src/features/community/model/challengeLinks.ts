import {
  challengeLink,
  encodeChallenge,
  type ChallengePayload,
  type ChallengeRefusal,
  type ChallengeState,
  type Profile,
} from '@/game';
import { COMMUNITY_COPY } from '../copy';

export function siteOrigin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin;
}

/**
 * The invite link of a challenge the visitor started. It is rebuilt from the saved challenge, so it
 * is the same link after a reload. The name only goes in when the visitor says so.
 */
export function inviteLinkFor(
  active: ChallengeState,
  profile: Pick<Profile, 'name' | 'treeName' | 'species'>,
  includeName: boolean,
): string | null {
  const payload: ChallengePayload = { v: 1, k: active.templateId, s: active.startDay, d: 7 };
  if (active.category) payload.c = active.category;
  const name = profile.name.trim();
  if (includeName && name) payload.n = name;
  if (profile.treeName.trim()) payload.t = profile.treeName.trim();
  payload.sp = profile.species;
  if (active.message) payload.m = active.message;
  const encoded = encodeChallenge(payload);
  return encoded ? challengeLink(siteOrigin(), encoded) : null;
}

/** Why a challenge could not be made or accepted, in the page's own words. */
export function refusalCopy(reason: ChallengeRefusal): string {
  switch (reason) {
    case 'busy':
      return COMMUNITY_COPY.challenge.busy;
    case 'needs-category':
      return COMMUNITY_COPY.challenge.needsCategory;
    case 'not-onboarded':
      return COMMUNITY_COPY.challenge.notOnboarded;
    case 'too-long':
      return COMMUNITY_COPY.challenge.tooLong;
    case 'expired':
      return COMMUNITY_COPY.invite.expired;
    case 'damaged':
    case 'unknown-template':
      return COMMUNITY_COPY.invite.damaged;
  }
}
