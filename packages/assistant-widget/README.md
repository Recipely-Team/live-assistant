# @live-assistant/widget

A drop-in voice assistant interface: an orb that moves with both voices, a
panel, a transcript, controls and a composer. Built only on
`@live-assistant/react`'s public hooks, so anything it does you could have done.

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

A working app that puts this together: [`examples/expo-app`](https://github.com/Recipely-Team/live-assistant/tree/main/examples/expo-app).
