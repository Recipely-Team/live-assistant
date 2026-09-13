/**
 * A working integration, in one component.
 *
 * @remarks
 * - **`<LiveAssistant>` is the whole wiring.** The Gemini session, the
 *   microphone, the player, the controller and the widget are built inside it.
 *   The one value it cannot invent is `TOKEN_ENDPOINT`: your own server's route
 *   that mints a short-lived token, so no API key is ever in the app.
 * - **Put it at the root**, beside your navigation, so a session survives moving
 *   between screens.
 * - **`tools` is where your app joins in.** The page pack — reading the screen,
 *   following links, pressing, typing, scrolling — is already there on the web
 *   with nothing registered. Anything the browser cannot see for itself, like
 *   the timer below, is a tool.
 */
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LiveAssistant } from '@live-assistant/react-native';

/** Your own endpoint, behind your own authentication. */
const TOKEN_ENDPOINT = 'https://api.example.com/assistant/token';

/**
 * Register the same definitions when you mint the token: Gemini fixes them
 * there, and a tool the token did not declare does not exist — with no error.
 */
const tools = [
  {
    definition: {
      name: 'setTimer',
      description: 'Starts a kitchen timer for the given number of minutes',
      parameters: {
        type: 'object',
        properties: { minutes: { type: 'number', description: 'How many minutes' } },
        required: ['minutes'],
      },
    },
    // Do the real thing here; whatever you return is what the model is told.
    run: ({ minutes }: Readonly<Record<string, unknown>>) => ({ started: true, minutes: Number(minutes) }),
  },
];

export default function App() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Live Assistant</Text>
      <Text style={styles.body}>
        Tap the orb and talk. It asks for the microphone before it spends a token, so the
        first run shows the permission prompt.
      </Text>
      <Text style={styles.note}>Point TOKEN_ENDPOINT in App.tsx at your own server.</Text>

      <LiveAssistant tokenEndpoint={TOKEN_ENDPOINT} tools={tools} theme={{ colors: { primary: '#5B5BD6' } }} />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', gap: 12, padding: 24 },
  title: { fontSize: 24, fontWeight: '600', textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, textAlign: 'center', opacity: 0.75 },
  note: { fontSize: 13, textAlign: 'center', opacity: 0.5 },
});
