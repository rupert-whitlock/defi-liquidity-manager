export const supportedChains = ["base"] as const;
export type SupportedChain = (typeof supportedChains)[number];
