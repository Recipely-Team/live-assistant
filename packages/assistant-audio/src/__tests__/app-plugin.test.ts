/**
 * The Expo config plugin, which exists so no integrator has to discover the two
 * defaults that would otherwise bite them late.
 *
 * @remarks
 * - **The interop line is the reason this file exists.** `app.plugin` re-exports
 *   a transpiled ES module, so the function sits under `default`. Taking the
 *   module itself handed Expo an object and `expo prebuild` died with
 *   "withAudioAPI is not a function" — after the package was installed, which is
 *   the worst place to find out.
 * - The options are asserted exactly, because each one prevents something
 *   specific: a background mode App Review rejects, a missing usage description
 *   that terminates the app, and a foreground service a voice session never uses.
 */
const applied: { config: unknown; options: Record<string, unknown> }[] = [];

jest.mock(
  'react-native-audio-api/app.plugin',
  () => ({
    // Shaped like the real module: the function is under `default`.
    __esModule: true,
    default: (config: unknown, options: Record<string, unknown>) => {
      applied.push({ config, options });
      return { ...(config as object), configured: true };
    },
  }),
  { virtual: true },
);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withLiveAssistant = require('../../app.plugin') as (
  config: unknown,
  props?: { microphonePermission?: string },
) => unknown;

describe('the config plugin', () => {
  beforeEach(() => {
    applied.length = 0;
  });

  it('is a function, not the module that holds one', () => {
    // Expo calls what the plugin file exports; an object here fails prebuild.
    expect(typeof withLiveAssistant).toBe('function');
  });

  it('writes the integrator sentence as the iOS microphone description', () => {
    withLiveAssistant({ name: 'Acme' }, { microphonePermission: 'Acme listens so you can talk to it.' });

    expect(applied[0]!.options.iosMicrophonePermission).toBe('Acme listens so you can talk to it.');
  });

  it('still writes a description when the app passes no props at all', () => {
    // Without one iOS terminates the app at the first microphone request, so an
    // empty configuration must not produce an empty description.
    withLiveAssistant({ name: 'Acme' });

    expect(applied[0]!.options.iosMicrophonePermission).toEqual(expect.any(String));
    expect(applied[0]!.options.iosMicrophonePermission).not.toBe('');
  });

  it('declares no background audio, no foreground service and no extra permissions', () => {
    withLiveAssistant({ name: 'Acme' }, { microphonePermission: 'x' });

    expect(applied[0]!.options).toMatchObject({
      iosBackgroundMode: false,
      androidForegroundService: false,
      androidPermissions: [],
    });
  });

  it('passes the app config through to the wrapped plugin', () => {
    const result = withLiveAssistant({ name: 'Acme' }, { microphonePermission: 'x' });

    expect(applied[0]!.config).toEqual({ name: 'Acme' });
    expect(result).toEqual({ name: 'Acme', configured: true });
  });
});
