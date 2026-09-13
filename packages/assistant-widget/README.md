# @live-assistant/widget

A drop-in voice assistant interface: an orb that moves with both voices, a
panel, a transcript, controls and a composer. Built only on
`@live-assistant/react`'s public hooks, so anything it does you could have done.

**Just want it working?** [`@live-assistant/react-native`](https://www.npmjs.com/package/@live-assistant/react-native)
installs all of this and gives you `<LiveAssistant tokenEndpoint="…" />` — one
component that builds the session, the audio, the controller and the widget.
Reach for the packages below it when you want to hold the pieces apart.

```sh
npm install @live-assistant/widget @live-assistant/react @live-assistant/core
```

Peers: `react >= 18`, `react-native >= 0.76` (React Native Web counts).

```tsx
import { AssistantWidget } from '@live-assistant/widget';

<AssistantWidget
  placement="bottom-right"
  theme={{ colors: { primary: '#E4572E', assistantGlow: '#FFB400' }, radius: 8 }}
  strings={{ status: { listening: 'Dinliyorum' }, stop: 'Bitir' }}
/>
```

Render it once, near the root, inside an `AssistantProvider`.

- **`theme`** — colours, orb size, radius, spacing, font size, panel height.
  Anything you leave out keeps the default.
- **`strings`** — every word it shows, including statuses, errors, end reasons
  and tool chips. The defaults are English; there is no other language built in,
  and no user-facing sentence is produced anywhere else in the library.
- **`renderMessage(entry, fallback)` / `renderTool(entry, fallback)`** — replace,
  wrap or hide any transcript row. **The default tool chip renders nothing for a
  run that succeeded**, because the assistant has just said what it did and a
  chip repeating it is noise; override `renderTool` if you want every run shown.
- `AssistantOrb` (starts and stops the session on its own unless you pass
  `onPress`), `AssistantPanel`, `AssistantTranscript`, `StatusLine`,
  `AssistantControls`, `AssistantComposer`, `MessageBubble` and `ToolChip` are
  exported too, so you can compose your own layout. Inside your own parts,
  `useWidgetTheme()` and `useWidgetStrings()` read the merged values.

Pass safe-area insets through `style` (for example
`style={{ bottom: insets.bottom + 16 }}`) so the orb clears the iOS home
indicator. The panel's shadow uses `boxShadow`, which renders on the New
Architecture and on the web; on the old architecture there is simply no shadow.

See the [overview](https://github.com/Recipely-Team/live-assistant#customising-the-widget).

## Colours, sizes and your logo

`theme` takes any part of the whole; what you leave out keeps its default.

| Colour | Default | Where it shows |
| --- | --- | --- |
| `primary` | `#5B5BD6` | The orb at rest, and the controls' accent |
| `userGlow` | `#3E9BFF` | The ring that follows the user's voice |
| `assistantGlow` | `#B45BFF` | The glow that follows the assistant's voice |
| `surface` | `#FFFFFF` | The panel |
| `text` | `#1C1C28` | Panel text |
| `mutedText` | `#6B6B80` | The status line and secondary text |
| `userBubble` / `userText` | `#5B5BD6` / `#FFFFFF` | The user's bubble |
| `assistantBubble` / `assistantText` | `#F0F0F7` / `#1C1C28` | The assistant's bubble |
| `toolChip` / `toolText` | `#E8F5EC` / `#1F6B3A` | A tool-run chip |
| `danger` | `#D93F3F` | Errors and the end-session control |
| `onPrimary` | `#FFFFFF` | Anything drawn on `primary` |

| Value | Default | What it does |
| --- | --- | --- |
| `logo` | — | **Your mark, inside the orb.** Any `<Image source>`: a `require(...)`, a `{ uri }`, an imported asset. The glow and the ring still read the two voices around it |
| `logoSize` | `0.55` | The logo's share of the orb's diameter |
| `orbSize` | `64` | The orb's diameter |
| `radius` | `16` | Corner radius of the panel and controls |
| `spacing` | `12` | Padding and the gaps between rows |
| `fontSize` | `15` | Transcript text size |
| `panelMaxHeight` | `420` | How tall the panel grows before the transcript scrolls |

```tsx
<AssistantWidget
  theme={{ logo: require('./assets/mark.png'), colors: { primary: '#E4572E' }, radius: 8 }}
/>
```


A working app that puts this together: [`examples/expo-app`](https://github.com/Recipely-Team/live-assistant/tree/main/examples/expo-app).
