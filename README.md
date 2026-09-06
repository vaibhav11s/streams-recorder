# streams-recorder

Browser audio recorder that mixes **multiple live `MediaStream`s** into one `MediaRecorder` timeline. Built for reliability: mute, unplug, and `AudioContext` interruptions should pause instead of writing empty chunks or getting stuck.

This is an early `0.1.0` for feedback. Please open [issues](https://github.com/vaibhav11s/streams-recorder/issues) with browser + OS details when something fails.

**Browser only.** There is no Node runtime.

## Install

```sh
pnpm add streams-recorder
```

```sh
npm install streams-recorder
```

## Usage

Acquire streams yourself (`getUserMedia`, `getDisplayMedia`, WebRTC, etc.), then attach them by key:

```ts
import { streamsRecorder } from 'streams-recorder'

const chunks: Blob[] = []

const recorder = streamsRecorder({
  onDataAvailable: event => chunks.push(event.data),
  onStateChange: state => console.log(state),
  onActiveSourcesChange: keys => console.log('live sources', keys),
  onError: (error, context) => console.error(error, context),
})

const mic = await navigator.mediaDevices.getUserMedia({ audio: true })
await recorder.changeSourceStream('mic', mic)

await recorder.startRecording() // timeslice defaults to 5000ms
// recorder.pauseRecording() / resumeRecording()
await recorder.stopRecording()

const blob = new Blob(chunks, { type: chunks[0]?.type ?? 'audio/webm' })
```

Add or replace sources at any time. Pass `null` to detach a key:

```ts
const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
await recorder.changeSourceStream('display', display)
await recorder.changeSourceStream('mic', null)
```

State machine:

`idle` → attach a live stream → `ready` → `startRecording()` → `recording` ⇄ `paused` → `stopRecording()` → `stopped`

Each instance is **single-use**. After `stopRecording()` or `cleanup()`, create a new one.

## Public API

| Member | Role |
| --- | --- |
| `streamsRecorder(options)` | Create a mixer + `MediaRecorder` on an `AudioContext` destination. |
| `changeSourceStream(key, stream \| null)` | Connect, replace, or detach a named input stream. |
| `startRecording(timeslice?)` | Start capturing; requires `ready` and at least one live track. |
| `pauseRecording()` / `resumeRecording()` | Pause/resume the recorder timeline. |
| `stopRecording()` | Stop and close the audio graph (stops input tracks unless `skipTrackStop`). |
| `cleanup()` | Tear down without requiring an active recording. |
| `getDurationMs()` | Elapsed recording time excluding pauses. |
| `recordingState` / `stream` / `audioContext` | Current state, mixed output stream, and context. |
| `getSupportedMimeType()` / `getRecorderMimeType()` | Pick a `MediaRecorder` mime the browser actually supports. |

### Reliability behavior

- **All tracks ended:** auto-pauses so the timeline does not keep emitting empty data; attaching a live stream can auto-resume. If nothing is recording, state drops from `ready` back to `idle`.
- **`AudioContext` suspended / interrupted:** auto-pause, then auto-resume when the context is `running` again (phone calls, tab freeze, iOS).
- **Mime fallback:** prefers `audio/webm;codecs=opus`, then Safari `audio/mp4`.

## Feedback

Useful reports include: browser + version, OS, whether sources were mic / tab / system audio, and whether the failure was start, pause, device unplug, or backgrounding the tab.
