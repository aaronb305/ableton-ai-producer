/**
 * action-executor.js
 *
 * Executes Ableton actions requested by Claude (via tool-use).
 * Runs inside Max's `js` object (SpiderMonkey engine, NOT Node.js).
 *
 * Receives messages in the form:
 *   <toolName> <paramsJson>
 *
 * Outputs:
 *   action_result <resultJson>    on success
 *   action_error  <errorJson>     on failure
 *
 * Inlet 0:  action request messages
 * Outlet 0: action result / error output
 */

inlets = 1;
outlets = 1;

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

function anything() {
    var args = arrayfromargs(messagename, arguments);

    if (args.length < 1) {
        outputError("No tool name provided");
        return;
    }

    var toolName = args[0];
    var paramsJson = args.length > 1 ? args.slice(1).join(" ") : "{}";

    var params;
    try {
        params = JSON.parse(paramsJson);
    } catch (e) {
        outputError("Invalid params JSON: " + e.message);
        return;
    }

    executeAction(toolName, params);
}

// ---------------------------------------------------------------------------
// Action router
// ---------------------------------------------------------------------------

function executeAction(toolName, params) {
    try {
        var result;

        switch (toolName) {
            // Track creation
            case "create_midi_track":
                result = createMidiTrack(params);
                break;
            case "create_audio_track":
                result = createAudioTrack(params);
                break;

            // Track properties
            case "set_track_name":
                result = setTrackName(params);
                break;
            case "set_track_volume":
                result = setTrackVolume(params);
                break;
            case "set_track_pan":
                result = setTrackPan(params);
                break;
            case "set_track_mute":
                result = setTrackMute(params);
                break;
            case "set_track_solo":
                result = setTrackSolo(params);
                break;
            case "set_track_arm":
                result = setTrackArm(params);
                break;
            case "delete_track":
                result = deleteTrack(params);
                break;

            // Devices
            case "load_instrument":
                result = loadInstrument(params);
                break;
            case "load_effect":
                result = loadEffect(params);
                break;
            case "set_device_parameter":
                result = setDeviceParameter(params);
                break;
            case "remove_device":
                result = removeDevice(params);
                break;

            // Clips
            case "create_clip":
                result = createClip(params);
                break;
            case "add_notes_to_clip":
                result = addNotesToClip(params);
                break;
            case "remove_notes_from_clip":
                result = removeNotesFromClip(params);
                break;
            case "set_clip_name":
                result = setClipName(params);
                break;
            case "delete_clip":
                result = deleteClip(params);
                break;
            case "duplicate_clip":
                result = duplicateClip(params);
                break;

            // Transport
            case "set_tempo":
                result = setTempo(params);
                break;
            case "set_time_signature":
                result = setTimeSignature(params);
                break;
            case "start_playback":
                result = startPlayback();
                break;
            case "stop_playback":
                result = stopPlayback();
                break;

            // Clip launch / stop / scene
            case "fire_clip":
                result = fireClip(params);
                break;
            case "stop_clip":
                result = stopClip(params);
                break;
            case "fire_scene":
                result = fireScene(params);
                break;

            // Sends / Returns
            case "create_return_track":
                result = createReturnTrack(params);
                break;
            case "set_track_send":
                result = setTrackSend(params);
                break;

            // Library
            case "search_library":
                result = searchLibrary(params);
                break;

            default:
                outputError("Unknown tool: " + toolName);
                return;
        }

        outlet(0, "action_result", JSON.stringify(result));

    } catch (e) {
        outputError(e.message);
    }
}

// ---------------------------------------------------------------------------
// Track creation
// ---------------------------------------------------------------------------

function createMidiTrack(params) {
    var song = new LiveAPI(null, "live_set");
    var index = (params.index !== undefined) ? params.index : -1;

    song.call("create_midi_track", index);

    var trackCount = song.getcount("tracks");
    var actualIndex = (index >= 0) ? index : trackCount - 1;

    if (params.name) {
        var track = new LiveAPI(null, "live_set tracks " + actualIndex);
        track.set("name", params.name);
    }

    return {
        status: "ok",
        action: "create_midi_track",
        track_index: actualIndex,
        name: params.name || null
    };
}

function createAudioTrack(params) {
    var song = new LiveAPI(null, "live_set");
    var index = (params.index !== undefined) ? params.index : -1;

    song.call("create_audio_track", index);

    var trackCount = song.getcount("tracks");
    var actualIndex = (index >= 0) ? index : trackCount - 1;

    if (params.name) {
        var track = new LiveAPI(null, "live_set tracks " + actualIndex);
        track.set("name", params.name);
    }

    return {
        status: "ok",
        action: "create_audio_track",
        track_index: actualIndex,
        name: params.name || null
    };
}

// ---------------------------------------------------------------------------
// Track properties
// ---------------------------------------------------------------------------

function setTrackName(params) {
    requireParams(params, ["track_index", "name"]);
    var track = new LiveAPI(null, "live_set tracks " + params.track_index);
    track.set("name", params.name);

    return {
        status: "ok",
        action: "set_track_name",
        track_index: params.track_index,
        name: params.name
    };
}

function setTrackVolume(params) {
    requireParams(params, ["track_index", "volume"]);
    var mixer = new LiveAPI(null, "live_set tracks " + params.track_index + " mixer_device volume");
    mixer.set("value", params.volume);

    return {
        status: "ok",
        action: "set_track_volume",
        track_index: params.track_index,
        volume: params.volume
    };
}

function setTrackPan(params) {
    requireParams(params, ["track_index", "pan"]);
    var mixer = new LiveAPI(null, "live_set tracks " + params.track_index + " mixer_device panning");
    mixer.set("value", params.pan);

    return {
        status: "ok",
        action: "set_track_pan",
        track_index: params.track_index,
        pan: params.pan
    };
}

function setTrackMute(params) {
    requireParams(params, ["track_index", "mute"]);
    var track = new LiveAPI(null, "live_set tracks " + params.track_index);
    track.set("mute", params.mute ? 1 : 0);

    return {
        status: "ok",
        action: "set_track_mute",
        track_index: params.track_index,
        mute: params.mute
    };
}

function setTrackSolo(params) {
    requireParams(params, ["track_index", "solo"]);
    var track = new LiveAPI(null, "live_set tracks " + params.track_index);
    track.set("solo", params.solo ? 1 : 0);

    return {
        status: "ok",
        action: "set_track_solo",
        track_index: params.track_index,
        solo: params.solo
    };
}

function setTrackArm(params) {
    requireParams(params, ["track_index", "arm"]);
    var track = new LiveAPI(null, "live_set tracks " + params.track_index);
    track.set("arm", params.arm ? 1 : 0);

    return {
        status: "ok",
        action: "set_track_arm",
        track_index: params.track_index,
        arm: params.arm
    };
}

function deleteTrack(params) {
    requireParams(params, ["track_index"]);
    var song = new LiveAPI(null, "live_set");
    song.call("delete_track", params.track_index);

    return {
        status: "ok",
        action: "delete_track",
        track_index: params.track_index
    };
}

// ---------------------------------------------------------------------------
// Instrument / Effect loading
// ---------------------------------------------------------------------------

function loadInstrument(params) {
    requireParams(params, ["track_index", "uri"]);

    var browser = new LiveAPI(null, "live_app browser");
    browser.goto("live_app browser " + params.uri);
    browser.call("load_item");

    return {
        status: "ok",
        action: "load_instrument",
        track_index: params.track_index,
        uri: params.uri
    };
}

function loadEffect(params) {
    requireParams(params, ["track_index", "uri"]);

    var browser = new LiveAPI(null, "live_app browser");
    browser.goto("live_app browser " + params.uri);
    browser.call("load_item");

    return {
        status: "ok",
        action: "load_effect",
        track_index: params.track_index,
        uri: params.uri
    };
}

// ---------------------------------------------------------------------------
// Device parameter control
// ---------------------------------------------------------------------------

function setDeviceParameter(params) {
    requireParams(params, ["track_index", "device_index", "value"]);

    var devicePath = "live_set tracks " + params.track_index +
                     " devices " + params.device_index;

    var paramIndex;

    if (params.parameter_name !== undefined) {
        var device = new LiveAPI(null, devicePath);
        var paramCount = parseInt(device.getcount("parameters"));
        paramIndex = -1;

        for (var i = 0; i < paramCount; i++) {
            var p = new LiveAPI(null, devicePath + " parameters " + i);
            var pName = p.get("name").toString();
            if (pName === params.parameter_name) {
                paramIndex = i;
                break;
            }
        }

        if (paramIndex === -1) {
            throw new Error("Parameter not found: " + params.parameter_name);
        }
    } else if (params.parameter_index !== undefined) {
        paramIndex = params.parameter_index;
    } else {
        throw new Error("Missing required parameter: parameter_name or parameter_index");
    }

    var paramPath = devicePath + " parameters " + paramIndex;
    var param = new LiveAPI(null, paramPath);
    param.set("value", params.value);

    var actualValue = parseFloat(param.get("value"));

    return {
        status: "ok",
        action: "set_device_parameter",
        track_index: params.track_index,
        device_index: params.device_index,
        parameter_index: paramIndex,
        parameter_name: params.parameter_name || null,
        requested_value: params.value,
        actual_value: actualValue
    };
}

function removeDevice(params) {
    requireParams(params, ["track_index", "device_index"]);
    var track = new LiveAPI(null, "live_set tracks " + params.track_index);
    track.call("delete_device", params.device_index);

    return {
        status: "ok",
        action: "remove_device",
        track_index: params.track_index,
        device_index: params.device_index
    };
}

// ---------------------------------------------------------------------------
// Clip creation and editing
// ---------------------------------------------------------------------------

function createClip(params) {
    requireParams(params, ["track_index", "clip_index", "length"]);

    var slotPath = "live_set tracks " + params.track_index +
                   " clip_slots " + params.clip_index;
    var slot = new LiveAPI(null, slotPath);
    slot.call("create_clip", params.length);

    if (params.name) {
        var clip = new LiveAPI(null, slotPath + " clip");
        clip.set("name", params.name);
    }

    return {
        status: "ok",
        action: "create_clip",
        track_index: params.track_index,
        clip_index: params.clip_index,
        length: params.length,
        name: params.name || null
    };
}

function addNotesToClip(params) {
    requireParams(params, ["track_index", "clip_index", "notes"]);

    var clipPath = "live_set tracks " + params.track_index +
                   " clip_slots " + params.clip_index + " clip";
    var clip = new LiveAPI(null, clipPath);

    var notes = params.notes;
    if (!notes || !notes.length) {
        return {
            status: "ok",
            action: "add_notes_to_clip",
            notes_added: 0
        };
    }

    clip.call("set_notes");
    clip.call("notes", notes.length);

    for (var i = 0; i < notes.length; i++) {
        var n = notes[i];
        var pitch     = (n.pitch !== undefined) ? n.pitch : 60;
        var startTime = (n.start_time !== undefined) ? n.start_time : 0;
        var duration  = (n.duration !== undefined) ? n.duration : 0.25;
        var velocity  = (n.velocity !== undefined) ? n.velocity : 100;
        var mute      = (n.mute !== undefined && n.mute) ? 1 : 0;

        clip.call("note", pitch, startTime, duration, velocity, mute);
    }

    clip.call("done");

    return {
        status: "ok",
        action: "add_notes_to_clip",
        track_index: params.track_index,
        clip_index: params.clip_index,
        notes_added: notes.length
    };
}

function removeNotesFromClip(params) {
    requireParams(params, ["track_index", "clip_index"]);

    var clipPath = "live_set tracks " + params.track_index +
                   " clip_slots " + params.clip_index + " clip";
    var clip = new LiveAPI(null, clipPath);

    var fromTime  = (params.from_time !== undefined) ? params.from_time : 0;
    var toTime    = (params.to_time !== undefined) ? params.to_time : parseFloat(clip.get("length"));
    var fromPitch = (params.from_pitch !== undefined) ? params.from_pitch : 0;
    var toPitch   = (params.to_pitch !== undefined) ? params.to_pitch : 127;

    clip.call("remove_notes", fromTime, fromPitch, toTime - fromTime, toPitch - fromPitch + 1);

    return {
        status: "ok",
        action: "remove_notes_from_clip",
        track_index: params.track_index,
        clip_index: params.clip_index
    };
}

function setClipName(params) {
    requireParams(params, ["track_index", "clip_index", "name"]);

    var clipPath = "live_set tracks " + params.track_index +
                   " clip_slots " + params.clip_index + " clip";
    var clip = new LiveAPI(null, clipPath);
    clip.set("name", params.name);

    return {
        status: "ok",
        action: "set_clip_name",
        track_index: params.track_index,
        clip_index: params.clip_index,
        name: params.name
    };
}

function deleteClip(params) {
    requireParams(params, ["track_index", "clip_index"]);

    var slotPath = "live_set tracks " + params.track_index +
                   " clip_slots " + params.clip_index;
    var slot = new LiveAPI(null, slotPath);
    slot.call("delete_clip");

    return {
        status: "ok",
        action: "delete_clip",
        track_index: params.track_index,
        clip_index: params.clip_index
    };
}

function duplicateClip(params) {
    requireParams(params, ["track_index", "clip_index"]);

    var track = new LiveAPI(null, "live_set tracks " + params.track_index);
    track.call("duplicate_clip_slot", params.clip_index);

    return {
        status: "ok",
        action: "duplicate_clip",
        track_index: params.track_index,
        clip_index: params.clip_index
    };
}

// ---------------------------------------------------------------------------
// Transport control
// ---------------------------------------------------------------------------

function setTempo(params) {
    requireParams(params, ["bpm"]);

    var song = new LiveAPI(null, "live_set");
    song.set("tempo", params.bpm);

    var actualTempo = parseFloat(song.get("tempo"));

    return {
        status: "ok",
        action: "set_tempo",
        requested_bpm: params.bpm,
        actual_bpm: actualTempo
    };
}

function setTimeSignature(params) {
    requireParams(params, ["numerator", "denominator"]);

    var song = new LiveAPI(null, "live_set");
    song.set("signature_numerator", params.numerator);
    song.set("signature_denominator", params.denominator);

    return {
        status: "ok",
        action: "set_time_signature",
        numerator: params.numerator,
        denominator: params.denominator
    };
}

function startPlayback() {
    var song = new LiveAPI(null, "live_set");
    song.call("start_playing");

    return {
        status: "ok",
        action: "start_playback"
    };
}

function stopPlayback() {
    var song = new LiveAPI(null, "live_set");
    song.call("stop_playing");

    return {
        status: "ok",
        action: "stop_playback"
    };
}

// ---------------------------------------------------------------------------
// Clip launch / stop / scene
// ---------------------------------------------------------------------------

function fireClip(params) {
    requireParams(params, ["track_index", "clip_index"]);

    var slotPath = "live_set tracks " + params.track_index +
                   " clip_slots " + params.clip_index;
    var slot = new LiveAPI(null, slotPath);
    slot.call("fire");

    return {
        status: "ok",
        action: "fire_clip",
        track_index: params.track_index,
        clip_index: params.clip_index
    };
}

function stopClip(params) {
    requireParams(params, ["track_index", "clip_index"]);

    var slotPath = "live_set tracks " + params.track_index +
                   " clip_slots " + params.clip_index;
    var slot = new LiveAPI(null, slotPath);
    slot.call("stop");

    return {
        status: "ok",
        action: "stop_clip",
        track_index: params.track_index,
        clip_index: params.clip_index
    };
}

function fireScene(params) {
    requireParams(params, ["scene_index"]);

    var scene = new LiveAPI(null, "live_set scenes " + params.scene_index);
    scene.call("fire");

    return {
        status: "ok",
        action: "fire_scene",
        scene_index: params.scene_index
    };
}

// ---------------------------------------------------------------------------
// Sends / Returns
// ---------------------------------------------------------------------------

function createReturnTrack(params) {
    var song = new LiveAPI(null, "live_set");
    song.call("create_return_track");

    var returnCount = song.getcount("return_tracks");
    var newIndex = returnCount - 1;

    if (params && params.name) {
        var track = new LiveAPI(null, "live_set return_tracks " + newIndex);
        track.set("name", params.name);
    }

    return {
        status: "ok",
        action: "create_return_track",
        return_track_index: newIndex,
        name: (params && params.name) ? params.name : null
    };
}

function setTrackSend(params) {
    requireParams(params, ["track_index", "send_index", "level"]);

    var sendPath = "live_set tracks " + params.track_index +
                   " mixer_device sends " + params.send_index;
    var send = new LiveAPI(null, sendPath);
    send.set("value", params.level);

    return {
        status: "ok",
        action: "set_track_send",
        track_index: params.track_index,
        send_index: params.send_index,
        level: params.level
    };
}

// ---------------------------------------------------------------------------
// Library search
// ---------------------------------------------------------------------------

function searchLibrary(params) {
    requireParams(params, ["query"]);

    return {
        status: "ok",
        action: "search_library",
        query: params.query,
        message: "Browser search via LiveAPI is limited. Use load_instrument or load_effect with a known browser URI path."
    };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function requireParams(params, keys) {
    for (var i = 0; i < keys.length; i++) {
        if (params[keys[i]] === undefined) {
            throw new Error("Missing required parameter: " + keys[i]);
        }
    }
}

function outputError(message) {
    post("action-executor error: " + message + "\n");
    outlet(0, "action_error", JSON.stringify({ error: message }));
}
