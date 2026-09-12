/**
 * A working integration, in one file.
 *
 * @remarks
 * - **This is the real wiring**, not a mock: the Gemini session, the platform
 *   microphone and player, a tool the model can call, and the widget. The only
 *   thing to change is `TOKEN_ENDPOINT`.
 * - **The controller is built once**, outside React, because it owns a socket
 *   and devices. Rebuilding it on every render would start a new session each
 *   time.
 * - **The widget lives at the root**, next to your navigation, so a session
 *   survives moving between screens.
 * - Nothing here holds an API key. The endpoint mints a short-lived token; see
 *   `@live-assistant/token-server` for the other half.
 */
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  AssistantController,
  AssistantProvider,
  AssistantWidget,
  GeminiLiveSession,
  Microphone,
  PcmPlayer,
  ToolRegistry,
} from '@live-assistant/react-native';

/** Your own endpoint, behind your own authentication. */
const TOKEN_ENDPOINT = 'https://api.example.com/assistant/token';

/**
 * The tools the model may call. Register the same definitions when you mint the
 * token: Gemini fixes them there, and a tool the token did not declare does not
 * exist — with no error.
 */
const tools = new ToolRegistry([
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
    run: async ({ minutes }) => {
      // Do the real thing here; whatever you return is what the model is told.
      return { started: true, minutes: Number(minutes) };
    },
  },
]);

const assistant = new AssistantController<{ token: string; model: string; wsUrl?: string }>({
  session: new GeminiLiveSession(),
  microphone: new Microphone(),
  player: new PcmPlayer(),
  tools,
  getConnection: async ({ resumptionHandle }) => {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ resumptionHandle, languageCode: 'en-US' }),
    });
    // Throwing here reaches you as `failure.cause` on a `connection_refused`.
    if (!response.ok) throw new Error(`token endpoint answered ${response.status}`);
    return response.json();
  },
});

export default function App() {
  return (
    <AssistantProvider controller={assistant}>
      <View style={styles.screen}>
        <Text style={styles.title}>Live Assistant</Text>
        <Text style={styles.body}>
          Tap the orb and talk. It asks for the microphone before it spends a token, so the
          first run shows the permission prompt.
        </Text>
        <Text style={styles.note}>Point TOKEN_ENDPOINT in App.tsx at your own server.</Text>
      </View>
      <AssistantWidget placement="bottom-right" />
      <StatusBar style="auto" />
    </AssistantProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', gap: 12, padding: 24 },
  title: { fontSize: 24, fontWeight: '600', textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, textAlign: 'center', opacity: 0.75 },
  note: { fontSize: 13, textAlign: 'center', opacity: 0.5 },
});
