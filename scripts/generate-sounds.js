/**
 * Sound Asset Generator for IronTrain
 * Generates simple sine-wave-based WAV sound effects for timer feedback.
 * Run with: node scripts/generate-sounds.js
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'sounds');

function generateWav(samples, sampleRate = 44100, numChannels = 1, bitsPerSample = 16) {
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = samples.length * (bitsPerSample / 8);
    const fileSize = 36 + dataSize;

    const buffer = Buffer.alloc(44 + dataSize);
    let offset = 0;

    // RIFF header
    buffer.write('RIFF', offset); offset += 4;
    buffer.writeUInt32LE(fileSize, offset); offset += 4;
    buffer.write('WAVE', offset); offset += 4;

    // Format chunk
    buffer.write('fmt ', offset); offset += 4;
    buffer.writeUInt32LE(16, offset); offset += 4; // chunk size
    buffer.writeUInt16LE(1, offset); offset += 2; // PCM
    buffer.writeUInt16LE(numChannels, offset); offset += 2;
    buffer.writeUInt32LE(sampleRate, offset); offset += 4;
    buffer.writeUInt32LE(byteRate, offset); offset += 4;
    buffer.writeUInt16LE(blockAlign, offset); offset += 2;
    buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;

    // Data chunk
    buffer.write('data', offset); offset += 4;
    buffer.writeUInt32LE(dataSize, offset); offset += 4;

    for (let i = 0; i < samples.length; i++) {
        const clamped = Math.max(-1, Math.min(1, samples[i]));
        const intVal = Math.round(clamped * 32767);
        buffer.writeInt16LE(intVal, offset); offset += 2;
    }

    return buffer;
}

function sineWave(freq, duration, sampleRate = 44100, amplitude = 0.5) {
    const numSamples = Math.floor(sampleRate * duration);
    const samples = new Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        // Apply fade-in/fade-out envelope (10ms)
        const fadeLen = Math.floor(sampleRate * 0.01);
        let envelope = 1;
        if (i < fadeLen) envelope = i / fadeLen;
        if (i > numSamples - fadeLen) envelope = (numSamples - i) / fadeLen;
        samples[i] = Math.sin(2 * Math.PI * freq * t) * amplitude * envelope;
    }
    return samples;
}

function mixSamples(...arrays) {
    const maxLen = Math.max(...arrays.map(a => a.length));
    const result = new Array(maxLen).fill(0);
    for (const arr of arrays) {
        for (let i = 0; i < arr.length; i++) {
            result[i] += arr[i];
        }
    }
    // Normalize
    const peak = Math.max(...result.map(Math.abs));
    if (peak > 1) {
        for (let i = 0; i < result.length; i++) {
            result[i] /= peak;
        }
    }
    return result;
}

function concatSamples(...arrays) {
    return [].concat(...arrays);
}

function silence(duration, sampleRate = 44100) {
    return new Array(Math.floor(sampleRate * duration)).fill(0);
}

// ─── Sound Definitions ────────────────────────────────────────────────────────

// Timer complete: two ascending tones (C5 + E5, quick)
function generateTimerComplete() {
    const tone1 = sineWave(523, 0.15, 44100, 0.5); // C5
    const gap = silence(0.05);
    const tone2 = sineWave(659, 0.2, 44100, 0.5); // E5
    return concatSamples(tone1, gap, tone2);
}

// Countdown tick: short click/tick sound (high frequency burst)
function generateCountdownTick() {
    const tick = sineWave(1000, 0.08, 44100, 0.4);
    return tick;
}

// Workout complete: victory fanfare (C5-E5-G5 ascending chord)
function generateWorkoutComplete() {
    const tone1 = sineWave(523, 0.15, 44100, 0.4); // C5
    const gap1 = silence(0.05);
    const tone2 = sineWave(659, 0.15, 44100, 0.4); // E5
    const gap2 = silence(0.05);
    const tone3 = sineWave(784, 0.3, 44100, 0.5);  // G5
    return concatSamples(tone1, gap1, tone2, gap2, tone3);
}

// Phase work: energetic burst (two high tones)
function generatePhaseWork() {
    const tone1 = sineWave(880, 0.1, 44100, 0.5); // A5
    const gap = silence(0.05);
    const tone2 = sineWave(1047, 0.15, 44100, 0.5); // C6
    return concatSamples(tone1, gap, tone2);
}

// Phase rest: descending calming tone (G5 → E5)
function generatePhaseRest() {
    const tone1 = sineWave(784, 0.15, 44100, 0.4); // G5
    const gap = silence(0.05);
    const tone2 = sineWave(659, 0.2, 44100, 0.35); // E5
    return concatSamples(tone1, gap, tone2);
}

// ─── Generate All Sounds ──────────────────────────────────────────────────────

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const sounds = {
    'timer_complete': generateTimerComplete,
    'countdown_tick': generateCountdownTick,
    'workout_complete': generateWorkoutComplete,
    'phase_work': generatePhaseWork,
    'phase_rest': generatePhaseRest,
};

for (const [name, generator] of Object.entries(sounds)) {
    const samples = generator();
    const wav = generateWav(samples);
    const filePath = path.join(OUTPUT_DIR, `${name}.mp3`); // WAV with .mp3 extension works in expo-av
    fs.writeFileSync(filePath, wav);
    console.log(`Generated: ${filePath} (${wav.length} bytes, ${(samples.length / 44100).toFixed(2)}s)`);
}

console.log('\nAll sound assets generated successfully.');
