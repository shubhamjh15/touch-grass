/** True in development and tests. Guard dev-only code with it so production builds drop it. */
export const IS_DEV = process.env.NODE_ENV !== 'production';

/** True when running in a browser (false during server rendering). */
export const IS_BROWSER = typeof window !== 'undefined';
