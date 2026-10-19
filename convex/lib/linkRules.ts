/** Limits for featured videos and social links. Server-enforced; also used by forms. */
export const VIDEO_RULES = { title: { min: 1, max: 100 }, coverMaxBytes: 5 * 1024 * 1024, publicLimit: 24 } as const;

export const SOCIAL_RULES = { label: { max: 40 }, maxLinks: 30 } as const;
