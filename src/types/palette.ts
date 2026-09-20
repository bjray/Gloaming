/**
 * The project's colour vocabulary. See BRIEF.md §4 and §5.7.
 *
 * This file declares *which* colours exist; `src/engine/palette.ts` maps each token to a hex
 * value and is the only place in the codebase permitted a hex literal (see CLAUDE.md). Splitting
 * it this way keeps content referring to tokens, keeps the literals in one module, and lets
 * TypeScript prove every token has a value.
 *
 * Adding a token is a deliberate act: the palette is a *limited* fall/Halloween set, and a new
 * scene is expected to select from what exists rather than bring its own colours (§5.7, "one
 * colour family per scene").
 */
export type ColorToken =
  // Night sky — the graveyard's continuous gradient endpoints.
  | 'skyNightHigh'
  | 'skyNightLow'
  // Light emitters. The only tokens allowed high-contrast detail (§5.7).
  | 'moonAmber'
  | 'moonHalo'
  | 'windowAmber'
  | 'pumpkinGlow'
  // Structural silhouettes, far to near. Nearer is darker: atmospheric perspective is what
  // makes the parallax read as depth rather than as sliding cardboard.
  | 'silhouetteFar'
  | 'silhouetteMid'
  | 'silhouetteNear'
  // Graveyard colour family — deep purples, mid lavenders, dark indigos (§5.7).
  | 'indigoDeep'
  | 'purpleDeep'
  | 'purpleMid'
  | 'lavenderMid'
