export interface FeatureFlags {
  imageSprites: boolean
}

export const FEATURE_FLAGS: FeatureFlags = {
  imageSprites: import.meta.env.VITE_USE_SPRITES === 'true'
}
