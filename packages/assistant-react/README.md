# @live-assistant/react

Headless React bindings for `AssistantController`. No UI, no styles — the hooks
a custom assistant interface is built from.

```sh
npm install @live-assistant/react @live-assistant/core
```

Peer: `react >= 18`. For the drop-in interface instead, see
[`@live-assistant/widget`](https://www.npmjs.com/package/@live-assistant/widget).

```tsx
import { AssistantProvider, useAssistant, useLevelFrames, useTranscript } from '@live-assistant/react';

function Root() {
  return (
    <AssistantProvider controller={assistant}>
      <MyAssistantBar />
    </AssistantProvider>
  );
}

function MyAssistantBar() {
  const { status, isMuted, error, start, stop, toggleMute, sendText } = useAssistant();
  const transcript = useTranscript();

  // Called every animation frame; nothing re-renders.
  useLevelFrames(({ input, output }) => {
    userRing.setValue(input);
    assistantGlow.setValue(output);
  });
}
```

- **`useAssistant()`** — state and controls.
- **`useAssistantState(selector)`** — re-renders only when your slice changes.
- **`useTranscript()`** — message and tool entries, fragments already joined.
- **`useLevelFrames(onFrame)`** — both levels every frame, for animation.
  **Levels are never React state**: an orb that followed a voice through state
  would re-render the tree sixty times a second.
- **`useAssistantLevels()`** — the raw sources, if your animation library keeps
  its own clock.
- **`useAssistantTool(tool)`** — registers a tool while the component is mounted,
  for screen-specific actions. The model must already know the tool, so declare
  it when you mint the token.

The controller is yours to build and own; this package never creates one. See
the [overview](https://github.com/Recipely-Team/live-assistant#headless-your-own-ui).
