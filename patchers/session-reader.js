/**
 * session-reader.js
 *
 * Reads Ableton Live session state via LiveAPI and outputs it as JSON.
 * Runs inside Max's `js` object (SpiderMonkey engine, NOT Node.js).
 *
 * Depth tiers:
 *   0 = minimal  — track names, types, arm/solo/mute, transport info
 *   1 = standard — + volume, pan, sends, device names, clip slot info
 *   2 = detailed — + device parameters, MIDI note data
 *   3 = full     — + everything (reserved for future expansion)
 *
 * Inlet 0: bang (read at standard depth) or int (read at specified depth)
 * Outlet 0: "session_state" + JSON string
 */

inlets = 1;
outlets = 1;

// ---------------------------------------------------------------------------
// Inlet handlers
// ---------------------------------------------------------------------------

function bang() {
    getSessionState(1);
}

function msg_int(depth) {
    if (depth < 0) depth = 0;
    if (depth > 3) depth = 3;
    getSessionState(depth);
}

// ---------------------------------------------------------------------------
// Main reader
// ---------------------------------------------------------------------------

function getSessionState(depth) {
    try {
        var song = new LiveAPI(null, "live_set");

        var state = {};
        state.tempo = parseFloat(song.get("tempo"));
        state.time_signature_numerator = parseInt(song.get("signature_numerator"), 10);
        state.time_signature_denominator = parseInt(song.get("signature_denominator"), 10);
        state.is_playing = parseInt(song.get("is_playing"), 10) === 1;
        state.song_length = parseFloat(song.get("song_length"));
        state.current_song_time = parseFloat(song.get("current_song_time"));

        state.tracks = getTracks(depth);

        var json = JSON.stringify(state);
        outlet(0, "session_state", json);
    } catch (e) {
        post("session-reader error: " + e.message + "\n");
        outlet(0, "session_error", JSON.stringify({ error: e.message }));
    }
}

// ---------------------------------------------------------------------------
// Track iteration
// ---------------------------------------------------------------------------

function getTracks(depth) {
    var song = new LiveAPI(null, "live_set");
    var trackCount = song.getcount("tracks");
    var returnTrackCount = song.getcount("return_tracks");
    var tracks = [];

    // Regular tracks (audio + midi)
    var i;
    for (i = 0; i < trackCount; i++) {
        var track = readTrack("live_set tracks " + i, depth);
        track.index = i;
        track.category = "track";
        tracks.push(track);
    }

    // Return tracks
    for (i = 0; i < returnTrackCount; i++) {
        var retTrack = readTrack("live_set return_tracks " + i, depth);
        retTrack.index = i;
        retTrack.category = "return";
        tracks.push(retTrack);
    }

    // Master track
    var masterTrack = readTrack("live_set master_track", depth);
    masterTrack.index = -1;
    masterTrack.category = "master";
    tracks.push(masterTrack);

    return tracks;
}

function readTrack(trackPath, depth) {
    var api = new LiveAPI(null, trackPath);
    var track = {};

    // Basic info (depth 0 — always included)
    track.name = getString(api, "name");
    track.mute = parseInt(api.get("mute"), 10) === 1;
    track.solo = parseInt(api.get("solo"), 10) === 1;
    track.color = parseInt(api.get("color"), 10);

    // has_audio_input / has_midi_input determine track type
    var hasAudioInput = parseInt(api.get("has_audio_input"), 10) === 1;
    var hasMidiInput = parseInt(api.get("has_midi_input"), 10) === 1;
    if (hasMidiInput && !hasAudioInput) {
        track.type = "midi";
    } else if (hasAudioInput && !hasMidiInput) {
        track.type = "audio";
    } else {
        track.type = "hybrid";
    }

    // arm is only available on regular tracks (not returns or master)
    try {
        track.arm = parseInt(api.get("arm"), 10) === 1;
    } catch (e) {
        track.arm = false;
    }

    // Depth 1+: mixer values, devices, clip slots
    if (depth >= 1) {
        track.volume = getMixerValue(trackPath, "volume");
        track.panning = getMixerValue(trackPath, "panning");
        track.sends = getSendValues(trackPath);
        track.devices = getDevices(trackPath, depth);
        track.clip_slots = getClipSlots(trackPath, depth, track.type);
    }

    return track;
}

// ---------------------------------------------------------------------------
// Mixer helpers
// ---------------------------------------------------------------------------

function getMixerValue(trackPath, paramName) {
    try {
        var mixer = new LiveAPI(null, trackPath + " mixer_device " + paramName);
        return parseFloat(mixer.get("value"));
    } catch (e) {
        return null;
    }
}

function getSendValues(trackPath) {
    var sends = [];
    try {
        var mixer = new LiveAPI(null, trackPath + " mixer_device");
        var sendCount = mixer.getcount("sends");
        for (var i = 0; i < sendCount; i++) {
            var send = new LiveAPI(null, trackPath + " mixer_device sends " + i);
            sends.push({
                name: getString(send, "name"),
                value: parseFloat(send.get("value"))
            });
        }
    } catch (e) {
        // Return whatever we collected so far
    }
    return sends;
}

// ---------------------------------------------------------------------------
// Device iteration
// ---------------------------------------------------------------------------

function getDevices(trackPath, depth) {
    var devices = [];
    try {
        var track = new LiveAPI(null, trackPath);
        var deviceCount = track.getcount("devices");
        for (var i = 0; i < deviceCount; i++) {
            var devicePath = trackPath + " devices " + i;
            var api = new LiveAPI(null, devicePath);
            var device = {};

            device.name = getString(api, "name");
            device.class_name = getString(api, "class_name");
            device.type = parseInt(api.get("type"), 10);
            device.is_active = parseInt(api.get("is_active"), 10) === 1;

            // Depth 2+: full parameter readout
            if (depth >= 2) {
                device.parameters = getDeviceParameters(devicePath);
            }

            devices.push(device);
        }
    } catch (e) {
        post("getDevices error (" + trackPath + "): " + e.message + "\n");
    }
    return devices;
}

function getDeviceParameters(devicePath) {
    var params = [];
    try {
        var device = new LiveAPI(null, devicePath);
        var paramCount = device.getcount("parameters");
        for (var i = 0; i < paramCount; i++) {
            var paramPath = devicePath + " parameters " + i;
            var api = new LiveAPI(null, paramPath);
            var param = {};

            param.name = getString(api, "name");
            param.value = parseFloat(api.get("value"));
            param.min = parseFloat(api.get("min"));
            param.max = parseFloat(api.get("max"));
            param.is_quantized = parseInt(api.get("is_quantized"), 10) === 1;

            params.push(param);
        }
    } catch (e) {
        post("getDeviceParameters error (" + devicePath + "): " + e.message + "\n");
    }
    return params;
}

// ---------------------------------------------------------------------------
// Clip slot iteration
// ---------------------------------------------------------------------------

function getClipSlots(trackPath, depth, trackType) {
    var slots = [];
    try {
        var track = new LiveAPI(null, trackPath);
        var slotCount = track.getcount("clip_slots");
        for (var i = 0; i < slotCount; i++) {
            var slotPath = trackPath + " clip_slots " + i;
            var api = new LiveAPI(null, slotPath);
            var slot = {};

            var hasClip = parseInt(api.get("has_clip"), 10) === 1;
            slot.index = i;
            slot.has_clip = hasClip;

            if (hasClip) {
                var clipPath = slotPath + " clip";
                var clipApi = new LiveAPI(null, clipPath);

                slot.clip = {};
                slot.clip.name = getString(clipApi, "name");
                slot.clip.length = parseFloat(clipApi.get("length"));
                slot.clip.is_playing = parseInt(clipApi.get("is_playing"), 10) === 1;
                slot.clip.is_recording = parseInt(clipApi.get("is_recording"), 10) === 1;
                slot.clip.color = parseInt(clipApi.get("color"), 10);

                // Depth 2+ and MIDI track: read note data
                if (depth >= 2 && trackType === "midi") {
                    slot.clip.notes = getNotes(clipPath);
                }
            }

            slots.push(slot);
        }
    } catch (e) {
        post("getClipSlots error (" + trackPath + "): " + e.message + "\n");
    }
    return slots;
}

// ---------------------------------------------------------------------------
// MIDI note reading
// ---------------------------------------------------------------------------

function getNotes(clipPath) {
    var notes = [];
    try {
        var clip = new LiveAPI(null, clipPath);
        var clipLength = parseFloat(clip.get("length"));

        // select_all_notes then get_selected_notes returns a flattened list:
        // "notes" count pitch start_time duration velocity pitch start_time ...  "done"
        clip.call("select_all_notes");
        var raw = clip.call("get_selected_notes");

        // raw is returned as an array of mixed strings and numbers
        // Format: ["notes", count, pitch, time, duration, velocity, mute, pitch, ...]
        if (raw && raw.length > 2) {
            var count = parseInt(raw[1], 10);
            var idx = 2;
            for (var i = 0; i < count; i++) {
                if (idx + 4 >= raw.length) break;
                notes.push({
                    pitch: parseInt(raw[idx], 10),
                    start_time: parseFloat(raw[idx + 1]),
                    duration: parseFloat(raw[idx + 2]),
                    velocity: parseInt(raw[idx + 3], 10),
                    mute: parseInt(raw[idx + 4], 10) === 1
                });
                idx += 5;
            }
        }

        // Deselect to avoid side effects
        clip.call("deselect_all_notes");
    } catch (e) {
        post("getNotes error (" + clipPath + "): " + e.message + "\n");
    }
    return notes;
}

// ---------------------------------------------------------------------------
// Utility: safely extract a string property from LiveAPI
// LiveAPI.get() returns an array; for string values we may need to join
// multi-word results.
// ---------------------------------------------------------------------------

function getString(api, property) {
    var val = api.get(property);
    if (val === undefined || val === null) return "";
    if (typeof val === "string") return val;
    if (val.length !== undefined) {
        // Join array elements, trimming surrounding quotes if present
        var joined = val.join(" ");
        // LiveAPI often wraps string values in quotes
        if (joined.charAt(0) === '"' && joined.charAt(joined.length - 1) === '"') {
            joined = joined.substring(1, joined.length - 1);
        }
        return joined;
    }
    return String(val);
}
