import type { ImageSourcePropType } from 'react-native';

/**
 * Every colour and measurement the widget draws with. Pass a partial
 * `theme` to `AssistantWidget`; anything left out keeps the default.
 *
 * @remarks
 * - **`logo` is how the orb becomes yours.** Any React Native image source —
 *   a `require`, a `{ uri }`, an imported asset — drawn inside the orb where
 *   the plain fill is otherwise. Left out, the orb keeps its colour and nothing
 *   changes.
 */
export interface AssistantTheme {
  readonly colors: {
    /** The orb at rest and the controls' accent. */
    readonly primary: string;
    /** The glow that follows the user's voice. */
    readonly userGlow: string;
    /** The glow that follows the assistant's voice. */
    readonly assistantGlow: string;
    readonly surface: string;
    readonly text: string;
    readonly mutedText: string;
    readonly userBubble: string;
    readonly userText: string;
    readonly assistantBubble: string;
    readonly assistantText: string;
    readonly toolChip: string;
    readonly toolText: string;
    readonly danger: string;
    readonly onPrimary: string;
  };
  /** Drawn inside the orb: a `require(...)`, a `{ uri }`, anything `<Image source>` takes. */
  readonly logo?: ImageSourcePropType;
  /** The logo's share of the orb's diameter. Default 0.55; 1 would touch the edges. */
  readonly logoSize: number;
  readonly orbSize: number;
  readonly radius: number;
  readonly spacing: number;
  readonly fontSize: number;
  readonly panelMaxHeight: number;
}
