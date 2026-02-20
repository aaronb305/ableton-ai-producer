/**
 * audio-analyzer.js
 *
 * Formats pitch and loudness data from MSP objects into JSON
 * for the AI backend's audio analysis context.
 *
 * Runs inside Max's `js` object (SpiderMonkey engine, NOT Node.js).
 *
 * Inlet 0: pitch data from sigmund~ (list: frequency confidence)
 * Inlet 1: loudness data from loudness~ (list: momentary short_term integrated)
 * Inlet 2: bang — trigger output snapshot
 *
 * Outlet 0: "analysis_data" + JSON string
 */

inlets = 3;
outlets = 1;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

var pitchHistory = [];       // recent pitch readings for key detection
var HISTORY_SIZE = 64;       // number of pitch samples to accumulate
var lastOutputTime = 0;      // for debouncing (ms)
var DEBOUNCE_MS = 500;       // minimum interval between outputs

var currentPitch = 0;        // Hz
var pitchConfidence = 0;

var lufs = {
    momentary: -70,
    short_term: -70,
    integrated: -70
};

// Note names for key detection
var NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// ---------------------------------------------------------------------------
// Inlet handlers
// ---------------------------------------------------------------------------

function msg_float(val) {
    if (inlet === 0) {
        // Pitch from sigmund~ — single float (frequency in Hz)
        currentPitch = val;
        if (val > 20 && val < 20000) {
            recordPitch(val);
        }
    } else if (inlet === 1) {
        // First float from loudness~ — momentary LUFS
        lufs.momentary = val;
    }
}

function list() {
    var args = arrayfromargs(arguments);

    if (inlet === 0) {
        // sigmund~ may output frequency + confidence
        if (args.length >= 1) currentPitch = args[0];
        if (args.length >= 2) pitchConfidence = args[1];
        if (currentPitch > 20 && currentPitch < 20000) {
            recordPitch(currentPitch);
        }
    } else if (inlet === 1) {
        // loudness~ outputs: momentary short_term integrated
        if (args.length >= 1) lufs.momentary = args[0];
        if (args.length >= 2) lufs.short_term = args[1];
        if (args.length >= 3) lufs.integrated = args[2];
    }
}

function bang() {
    if (inlet === 2) {
        outputAnalysis();
    }
}

// ---------------------------------------------------------------------------
// Pitch tracking and key detection
// ---------------------------------------------------------------------------

function recordPitch(freqHz) {
    // Convert frequency to MIDI note number
    var midiNote = Math.round(12 * (Math.log(freqHz / 440) / Math.log(2)) + 69);
    if (midiNote < 0 || midiNote > 127) return;

    // Store pitch class (0-11)
    var pitchClass = midiNote % 12;
    pitchHistory.push(pitchClass);

    // Keep history bounded
    if (pitchHistory.length > HISTORY_SIZE) {
        pitchHistory = pitchHistory.slice(pitchHistory.length - HISTORY_SIZE);
    }
}

/**
 * Detect the key from accumulated pitch history using a histogram approach.
 * Compares pitch class distribution against major and minor scale templates.
 */
function detectKey() {
    if (pitchHistory.length < 8) {
        return { key: "?", scale: "unknown", confidence: 0 };
    }

    // Build pitch class histogram
    var histogram = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (var i = 0; i < pitchHistory.length; i++) {
        histogram[pitchHistory[i]]++;
    }

    // Normalize
    var total = pitchHistory.length;
    for (var j = 0; j < 12; j++) {
        histogram[j] = histogram[j] / total;
    }

    // Scale templates (intervals from root)
    // Major: W W H W W W H → [0, 2, 4, 5, 7, 9, 11]
    // Minor: W H W W H W W → [0, 2, 3, 5, 7, 8, 10]
    var majorTemplate = [0, 2, 4, 5, 7, 9, 11];
    var minorTemplate = [0, 2, 3, 5, 7, 8, 10];

    var bestKey = 0;
    var bestScale = "major";
    var bestScore = -1;

    for (var root = 0; root < 12; root++) {
        // Score against major template
        var majorScore = 0;
        for (var m = 0; m < majorTemplate.length; m++) {
            majorScore += histogram[(root + majorTemplate[m]) % 12];
        }

        // Score against minor template
        var minorScore = 0;
        for (var n = 0; n < minorTemplate.length; n++) {
            minorScore += histogram[(root + minorTemplate[n]) % 12];
        }

        if (majorScore > bestScore) {
            bestScore = majorScore;
            bestKey = root;
            bestScale = "major";
        }
        if (minorScore > bestScore) {
            bestScore = minorScore;
            bestKey = root;
            bestScale = "minor";
        }
    }

    return {
        key: NOTE_NAMES[bestKey],
        scale: bestScale,
        confidence: Math.round(bestScore * 100) / 100
    };
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function outputAnalysis() {
    // Debounce
    var now = new Date().getTime();
    if (now - lastOutputTime < DEBOUNCE_MS) return;
    lastOutputTime = now;

    var keyInfo = detectKey();

    var analysis = {
        key: keyInfo.key,
        scale: keyInfo.scale,
        confidence: keyInfo.confidence,
        lufs: {
            momentary: Math.round(lufs.momentary * 10) / 10,
            short_term: Math.round(lufs.short_term * 10) / 10,
            integrated: Math.round(lufs.integrated * 10) / 10
        },
        detected_pitch: Math.round(currentPitch * 10) / 10
    };

    outlet(0, "analysis_data", JSON.stringify(analysis));
}
