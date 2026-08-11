export const supportedDexs = ["aerodrome"] as const;
export type SupportedDex = (typeof supportedDexs)[number];
