# Audio Architecture Documentation

## Overview

Script-Speech uses OpenAI's Realtime API for voice-powered screenplay development. This document explains how audio transmission works and why it's architected this way.

## Critical Architecture Decision

**Audio is transmitted via WebRTC Data Channel, NOT WebRTC Audio Tracks.**

This is a fundamental requirement of OpenAI's Realtime API. The WebRTC connection is used for signaling and the data channel, but audio itself must be sent as base64-encoded PCM16 data through the data channel.

## Audio Pipeline

### Outgoing Audio (User → OpenAI)

```
User Microphone
  ↓
navigator.mediaDevices.getUserMedia() → MediaStream
  ↓
AudioContext.createMediaStreamSource() → MediaStreamAudioSourceNode
  ↓
AudioWorkletNode (realtime-audio-processor)
  ├── Convert stereo → mono
  ├── Resample browser rate (48kHz) → OpenAI rate (24kHz)
  └── Convert Float32 → PCM16 (Int16)
  ↓
Main Thread: Base64 Encoding
  ↓
WebRTC Data Channel: {type: "input_audio_buffer.append", audio: base64String}
  ↓
OpenAI Realtime API
```

### Incoming Audio (OpenAI → User)

```
OpenAI Realtime API
  ↓
WebRTC Data Channel: {type: "response.audio.delta", delta: base64String}
  ↓
Base64 Decoding → PCM16 (Int16Array)
  ↓
Convert PCM16 → Float32
  ↓
AudioContext.createBuffer() → AudioBuffer (24kHz mono)
  ↓
AudioBufferSourceNode → AudioContext.destination
  ↓
User Hears AI Voice
```

## Key Components

### 1. AudioWorklet Processor (`public/audio-processor.js`)

**Purpose:** Real-time audio processing on a separate thread to avoid blocking the main thread.

**Responsibilities:**
- Receive browser audio (typically 48kHz stereo/mono)
- Convert stereo to mono (average channels)
- Resample to 24kHz using linear interpolation
- Convert Float32 (-1.0 to 1.0) to PCM16 (-32768 to 32767)
- Chunk audio into 4800-sample blocks (~200ms at 24kHz)
- Send chunks to main thread via `postMessage()`

**Why AudioWorklet?**
- Runs on separate thread (no main thread blocking)
- Modern API (replaces deprecated ScriptProcessorNode)
- High-performance real-time audio processing
- Browser support: Chrome/Edge 66+, Firefox 76+, Safari 14.1+

**Fallback:** For older browsers, consider implementing ScriptProcessorNode fallback (not currently implemented).

### 2. RealtimeClient (`src/lib/realtime/index.ts`)

**Purpose:** Manages WebRTC connection, data channel communication, and audio pipeline.

**Key Properties:**
```typescript
private audioContext: AudioContext | null = null;
private audioWorkletNode: AudioWorkletNode | null = null;
private audioSourceNode: MediaStreamAudioSourceNode | null = null;
private audioPlaybackQueue: AudioBuffer[] = [];
private isPlayingAudio = false;
```

**Key Methods:**

#### `startMicrophone()`
1. Get microphone permission via `getUserMedia()`
2. Initialize `AudioContext`
3. Load AudioWorklet module (`/audio-processor.js`)
4. Create `AudioWorkletNode` ("realtime-audio-processor")
5. Connect microphone → AudioWorklet
6. Handle audio chunks from worklet:
   - Convert PCM16 → Base64
   - Send via data channel

#### `stopMicrophone()`
1. Disconnect AudioWorklet nodes
2. Stop microphone tracks
3. Cleanup resources

#### `sendAudioToOpenAI(base64Audio: string)`
Sends audio chunk to OpenAI:
```json
{
  "type": "input_audio_buffer.append",
  "audio": "base64EncodedPCM16Data"
}
```

#### `handleIncomingAudio(base64Audio: string)`
Processes incoming audio from OpenAI:
1. Decode base64 → PCM16
2. Convert PCM16 → Float32
3. Create AudioBuffer (24kHz mono)
4. Add to playback queue
5. Start playback if not already playing

#### `playAudioQueue()`
Plays queued audio buffers sequentially without gaps.

### 3. Data Channel Message Handler

The data channel receives multiple message types:

```typescript
// Tool invocations from OpenAI
{
  "type": "tool.invocation",
  "call_id": "...",
  "name": "update_project_state",
  "arguments": {...}
}

// Incoming audio from OpenAI
{
  "type": "response.audio.delta",
  "delta": "base64PCM16Audio"
}

// Transcript updates
{
  "type": "response.audio_transcript.delta",
  "delta": "partial transcript text"
}

// Session events
{
  "type": "session.created",
  ...
}
```

## Audio Format Requirements

### OpenAI Realtime API Requirements

| Parameter | Value |
|-----------|-------|
| Sample Rate | 24,000 Hz (24kHz) |
| Bit Depth | 16-bit signed PCM |
| Channels | Mono (1 channel) |
| Encoding | Base64 (for data channel transmission) |
| Endianness | Little-endian |

### Browser Audio (Typical)

| Parameter | Value |
|-----------|-------|
| Sample Rate | 48,000 Hz (48kHz) |
| Format | Float32 (-1.0 to 1.0) |
| Channels | Stereo or Mono |

**Conversion Required:**
- Resample: 48kHz → 24kHz (2:1 ratio)
- Convert: Float32 → PCM16
- Convert: Stereo → Mono (if needed)

## Why Not WebRTC Audio Tracks?

**The Previous (Broken) Implementation:**
```typescript
// ❌ WRONG - OpenAI doesn't receive audio this way
for (const track of stream.getTracks()) {
  const sender = this.connection.addTrack(track, stream);
  this.microphoneSenders.add(sender);
}
```

**Why This Doesn't Work:**
1. OpenAI's Realtime API expects audio via data channel events, not WebRTC audio tracks
2. WebRTC tracks send audio via RTP protocol, which OpenAI's API doesn't process
3. The data channel is the only communication path for audio in OpenAI's architecture
4. Evidence: Console showed no `input_audio_buffer` events when using tracks

**The Correct Implementation:**
```typescript
// ✅ CORRECT - Send via data channel
this.dataChannel.send(JSON.stringify({
  type: "input_audio_buffer.append",
  audio: base64PCM16Audio
}));
```

## Performance Considerations

### Chunk Size

**Current Setting:** 4800 samples (~200ms at 24kHz)

**Trade-offs:**
- **Smaller chunks (< 100ms):**
  - Lower latency
  - More frequent data channel sends
  - Higher CPU overhead
- **Larger chunks (> 300ms):**
  - Higher latency
  - Less frequent sends
  - Lower CPU overhead
  - Worse user experience (delayed responses)

**Recommendation:** 4800 samples (200ms) provides good balance.

### Resampling Algorithm

**Current Implementation:** Linear interpolation

**Why:**
- Simple and fast
- Low CPU usage
- Acceptable quality for voice
- Runs efficiently in AudioWorklet

**Alternatives:**
- Cubic interpolation (better quality, higher CPU)
- Sinc interpolation (best quality, highest CPU)
- Web Audio API's native resampling (browser-dependent quality)

### Base64 Encoding Performance

**Current Implementation:** Loop through Uint8Array + `String.fromCharCode()` + `btoa()`

**Why:**
- Native browser APIs (`btoa`/`atob`)
- Fast enough for real-time processing
- No external dependencies

**Chunk Size Impact:**
- 4800 samples × 2 bytes/sample = 9.6KB binary
- Base64 encoding increases size by ~33% → ~12.8KB per chunk
- At 200ms chunks = ~64KB/second upload bandwidth
- Acceptable for modern internet connections

## Error Handling

### AudioWorklet Loading Failures

**Possible Causes:**
- Browser doesn't support AudioWorklet (Safari < 14.1, Firefox < 76)
- `/audio-processor.js` file not found (404)
- CORS issues with worklet module

**Mitigation:**
- Try/catch around `audioWorklet.addModule()`
- Throw clear error message
- Future: Implement ScriptProcessorNode fallback

### Data Channel Failures

**Possible Causes:**
- Data channel not open (`readyState !== "open"`)
- WebRTC connection dropped
- Network issues

**Mitigation:**
- Check `dataChannel.readyState` before sending
- Log warnings instead of throwing
- Automatic reconnection in `recoverConnection()`

### Audio Playback Failures

**Possible Causes:**
- Browser autoplay policy blocks audio
- AudioContext suspended
- Invalid base64 audio data

**Mitigation:**
- Resume AudioContext on user interaction (mic button click)
- Try/catch around audio decoding
- Log errors without crashing

## Browser Compatibility

### AudioWorklet Support

| Browser | Minimum Version |
|---------|-----------------|
| Chrome/Edge | 66+ |
| Firefox | 76+ |
| Safari | 14.1+ |
| Opera | 53+ |

### WebRTC Data Channel Support

Widely supported across all modern browsers.

### getUserMedia Support

Widely supported, but requires HTTPS (except localhost).

## Testing Checklist

### Development Testing

- [ ] Microphone permission granted
- [ ] AudioContext created successfully
- [ ] AudioWorklet loaded without errors
- [ ] Console shows: `[Realtime] Starting microphone with AudioWorklet pipeline...`
- [ ] Console shows: `[Realtime] AudioWorklet module loaded successfully`
- [ ] Console shows: `[Realtime] Audio pipeline connected: Microphone → AudioWorklet → Data Channel`
- [ ] Console shows periodic: `[Realtime] Sending audio to OpenAI (sampling log)`
- [ ] Console shows: `[Realtime] Message type: input_audio_buffer.append` (in data channel logs)

### Functional Testing

- [ ] User speaks into microphone
- [ ] OpenAI responds with voice (audio plays back)
- [ ] Tool invocations appear in console (`update_project_state`)
- [ ] Story elements populate on canvas (characters, locations, beats, acts)
- [ ] No audio dropouts or glitches
- [ ] Latency is acceptable (< 1 second)

### Error Testing

- [ ] Deny microphone permission → Clear error message
- [ ] Close data channel → No crashes, graceful handling
- [ ] Disconnect/reconnect → Session recovers
- [ ] Stop microphone → Resources cleaned up properly

## Debugging Tips

### Enable Verbose Logging

The code already includes comprehensive logging. Watch console for:

```
[Realtime] Starting microphone with AudioWorklet pipeline...
[AudioProcessor] Initialized: {inputSampleRate: 48000, outputSampleRate: 24000, ...}
[Realtime] AudioContext created, sample rate: 48000
[Realtime] AudioWorklet module loaded successfully
[Realtime] Audio pipeline connected: Microphone → AudioWorklet → Data Channel
[Realtime] Sending audio to OpenAI (sampling log)
[Realtime] Message type: input_audio_buffer.append
[Realtime] Message type: response.audio.delta
[Realtime] Message type: tool.invocation
[Realtime] Tool invocation received: {name: "update_project_state", ...}
```

### Check Data Channel State

```javascript
console.log(realtimeClient.dataChannel?.readyState); // Should be "open"
```

### Verify AudioWorklet Processing

Add this to `audio-processor.js` temporarily:
```javascript
if (Math.random() < 0.01) {
  console.log('[AudioProcessor] Processed chunk, samples:', pcm16.length);
}
```

### Monitor Network Traffic

Use Chrome DevTools → Network → WS (WebSockets) to see data channel messages in real-time.

## Common Issues

### Issue: No audio sent to OpenAI

**Symptoms:**
- No `input_audio_buffer.append` messages in console
- OpenAI doesn't respond

**Solutions:**
1. Check data channel is open: `dataChannel.readyState === "open"`
2. Verify AudioWorklet loaded successfully
3. Check microphone permission granted
4. Look for errors in console

### Issue: Audio quality is poor

**Symptoms:**
- Robotic voice
- Distorted audio
- Stuttering

**Solutions:**
1. Check sample rate matches (24kHz)
2. Verify PCM16 conversion is correct
3. Increase chunk size to reduce processing overhead
4. Check network bandwidth

### Issue: High CPU usage

**Symptoms:**
- Browser tab becomes slow
- Fan spins up

**Solutions:**
1. Increase chunk size (fewer sends per second)
2. Optimize resampling algorithm
3. Check for audio buffer leaks (clear queue on stop)

## Future Improvements

1. **Browser Compatibility:**
   - Implement ScriptProcessorNode fallback for older browsers
   - Feature detection and graceful degradation

2. **Audio Quality:**
   - Experiment with better resampling algorithms
   - Add gain control / normalization
   - Implement noise gate

3. **Performance:**
   - Use Web Workers for base64 encoding
   - Implement adaptive chunk sizing based on network conditions
   - Pool AudioBuffer objects to reduce GC pressure

4. **User Experience:**
   - Visual waveform display
   - Voice activity detection (mute when not speaking)
   - Echo cancellation tuning

5. **Reliability:**
   - Retry logic for failed audio sends
   - Buffer audio during reconnection
   - Health monitoring and alerting

## References

- [OpenAI Realtime API Documentation](https://platform.openai.com/docs/api-reference/realtime)
- [AudioWorklet API](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)
- [WebRTC Data Channels](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

## Summary

The audio architecture was completely refactored to send audio via the WebRTC data channel instead of audio tracks. This is the ONLY way OpenAI's Realtime API accepts audio. The implementation uses AudioWorklet for high-performance real-time audio processing, converting browser audio (48kHz Float32 stereo) to OpenAI's required format (24kHz PCM16 mono) and transmitting it as base64-encoded chunks via the data channel.
