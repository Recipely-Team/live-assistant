import { buildLiveSetup } from '../build-live-setup';
import { toGeminiTools } from '../to-gemini-tools';

const tool = {
  name: 'setTimer',
  description: 'Starts a kitchen timer',
  parameters: {
    type: 'object',
    properties: {
      minutes: { type: 'number', description: 'How many minutes' },
      unit: { type: 'string', enum: ['minutes', 'hours'] },
    },
    required: ['minutes'],
  },
};

describe('toGeminiTools', () => {
  it('wraps the declarations in the single group the API expects', () => {
    expect(toGeminiTools([tool])).toEqual([
      {
        functionDeclarations: [
          {
            name: 'setTimer',
            description: 'Starts a kitchen timer',
            parameters: {
              type: 'OBJECT',
              properties: {
                minutes: { type: 'NUMBER', description: 'How many minutes' },
                unit: { type: 'STRING', enum: ['minutes', 'hours'] },
              },
              required: ['minutes'],
            },
          },
        ],
      },
    ]);
  });

  it('carries a tool that declares no parameters at all', () => {
    const [group] = toGeminiTools([{ name: 'readScreen', description: 'Reads the screen' }]);

    expect((group as { functionDeclarations: unknown[] }).functionDeclarations[0]).toEqual({
      name: 'readScreen',
      description: 'Reads the screen',
    });
  });

  /**
   * An app with a voice mode and a typed one sends this array to
   * `generateContent` and mints the other through `buildLiveSetup`. They were
   * one rendering in this package and a second, hand-written one in the first
   * app that integrated it — free to drift, with nothing to notice.
   */
  it('is the same array a minted token bakes in', () => {
    const setup = buildLiveSetup({ apiKey: 'k', model: 'models/live', tools: [tool] });

    expect(setup.tools).toEqual(toGeminiTools([tool]));
  });
});
