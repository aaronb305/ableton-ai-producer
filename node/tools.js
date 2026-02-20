/**
 * Tool definitions for Claude's tool-use capability.
 *
 * Each tool maps to an Ableton Live action that will be executed
 * by the Max JS object via the Live API. The input_schema follows
 * the JSON Schema format required by the Anthropic API.
 */

const tools = [
  // --- Track Management ---
  {
    name: "create_midi_track",
    description:
      "Create a new MIDI track in the Ableton session. Use index -1 to append at the end.",
    input_schema: {
      type: "object",
      properties: {
        index: {
          type: "integer",
          description: "Position to insert the track (-1 for end)",
        },
        name: {
          type: "string",
          description: "Name for the new track",
        },
      },
    },
  },
  {
    name: "create_audio_track",
    description:
      "Create a new audio track in the Ableton session. Use index -1 to append at the end.",
    input_schema: {
      type: "object",
      properties: {
        index: {
          type: "integer",
          description: "Position to insert the track (-1 for end)",
        },
        name: {
          type: "string",
          description: "Name for the new track",
        },
      },
    },
  },
  {
    name: "set_track_name",
    description: "Rename an existing track.",
    input_schema: {
      type: "object",
      properties: {
        track_index: {
          type: "integer",
          description: "Index of the track to rename (0-based)",
        },
        name: {
          type: "string",
          description: "New name for the track",
        },
      },
      required: ["track_index", "name"],
    },
  },
  {
    name: "delete_track",
    description:
      "Delete a track from the session. DESTRUCTIVE: requires confirmed=true after getting explicit user consent.",
    input_schema: {
      type: "object",
      properties: {
        track_index: {
          type: "integer",
          description: "Index of the track to delete (0-based)",
        },
        confirmed: {
          type: "boolean",
          description: "Must be true. Only set after the user explicitly confirms deletion.",
        },
      },
      required: ["track_index", "confirmed"],
    },
  },
  {
    name: "set_track_volume",
    description: "Set the volume of a track (0.0 = -inf dB, 0.85 = 0 dB, 1.0 = +6 dB).",
    input_schema: {
      type: "object",
      properties: {
        track_index: {
          type: "integer",
          description: "Index of the track (0-based)",
        },
        volume: {
          type: "number",
          description: "Volume value (0.0 to 1.0, where 0.85 is 0 dB)",
          minimum: 0,
          maximum: 1,
        },
      },
      required: ["track_index", "volume"],
    },
  },
  {
    name: "set_track_pan",
    description: "Set the pan position of a track (-1.0 = full left, 0.0 = center, 1.0 = full right).",
    input_schema: {
      type: "object",
      properties: {
        track_index: {
          type: "integer",
          description: "Index of the track (0-based)",
        },
        pan: {
          type: "number",
          description: "Pan position (-1.0 to 1.0)",
          minimum: -1,
          maximum: 1,
        },
      },
      required: ["track_index", "pan"],
    },
  },
  {
    name: "set_track_mute",
    description: "Mute or unmute a track.",
    input_schema: {
      type: "object",
      properties: {
        track_index: {
          type: "integer",
          description: "Index of the track (0-based)",
        },
        mute: {
          type: "boolean",
          description: "True to mute, false to unmute",
        },
      },
      required: ["track_index", "mute"],
    },
  },
  {
    name: "set_track_solo",
    description: "Solo or unsolo a track.",
    input_schema: {
      type: "object",
      properties: {
        track_index: {
          type: "integer",
          description: "Index of the track (0-based)",
        },
        solo: {
          type: "boolean",
          description: "True to solo, false to unsolo",
        },
      },
      required: ["track_index", "solo"],
    },
  },
  {
    name: "set_track_arm",
    description: "Arm or disarm a track for recording.",
    input_schema: {
      type: "object",
      properties: {
        track_index: {
          type: "integer",
          description: "Index of the track (0-based)",
        },
        arm: {
          type: "boolean",
          description: "True to arm, false to disarm",
        },
      },
      required: ["track_index", "arm"],
    },
  },

  // --- Device / Instrument / Effect ---
  {
    name: "load_instrument",
    description:
      "Load an instrument or preset onto a track from Ableton's browser. The URI identifies the specific instrument/preset in Ableton's content library.",
    input_schema: {
      type: "object",
      properties: {
        track_index: {
          type: "integer",
          description: "Index of the target track (0-based)",
        },
        uri: {
          type: "string",
          description:
            "Browser URI of the instrument/preset (e.g., from search_library results)",
        },
      },
      required: ["track_index", "uri"],
    },
  },
  {
    name: "load_effect",
    description:
      "Load an audio effect onto a track. The effect is appended to the end of the device chain.",
    input_schema: {
      type: "object",
      properties: {
        track_index: {
          type: "integer",
          description: "Index of the target track (0-based)",
        },
        uri: {
          type: "string",
          description: "Browser URI of the audio effect",
        },
      },
      required: ["track_index", "uri"],
    },
  },
  {
    name: "set_device_parameter",
    description:
      "Set a parameter value on a device. Parameter values are normalized to the device's own range.",
    input_schema: {
      type: "object",
      properties: {
        track_index: {
          type: "integer",
          description: "Index of the track (0-based)",
        },
        device_index: {
          type: "integer",
          description: "Index of the device in the track's chain (0-based)",
        },
        parameter_name: {
          type: "string",
          description: "Name of the parameter to set (must match exactly)",
        },
        value: {
          type: "number",
          description: "Value to set (within the parameter's min/max range)",
        },
      },
      required: ["track_index", "device_index", "parameter_name", "value"],
    },
  },
  {
    name: "remove_device",
    description: "Remove a device from a track's device chain. DESTRUCTIVE: requires confirmed=true after getting explicit user consent.",
    input_schema: {
      type: "object",
      properties: {
        track_index: {
          type: "integer",
          description: "Index of the track (0-based)",
        },
        device_index: {
          type: "integer",
          description: "Index of the device to remove (0-based)",
        },
        confirmed: {
          type: "boolean",
          description: "Must be true. Only set after the user explicitly confirms removal.",
        },
      },
      required: ["track_index", "device_index", "confirmed"],
    },
  },

  // --- Clip Management ---
  {
    name: "create_clip",
    description:
      "Create an empty MIDI clip in a track's clip slot. The clip can then be populated with notes using add_notes_to_clip.",
    input_schema: {
      type: "object",
      properties: {
        track_index: {
          type: "integer",
          description: "Index of the MIDI track (0-based)",
        },
        clip_index: {
          type: "integer",
          description: "Index of the clip slot (0-based, corresponds to scene index)",
        },
        length: {
          type: "number",
          description: "Length of the clip in beats (e.g., 4 = 1 bar in 4/4)",
        },
        name: {
          type: "string",
          description: "Optional name for the clip",
        },
      },
      required: ["track_index", "clip_index", "length"],
    },
  },
  {
    name: "add_notes_to_clip",
    description:
      "Add MIDI notes to an existing clip. Notes are defined with pitch (MIDI number), start_time (in beats), duration (in beats), and optional velocity.",
    input_schema: {
      type: "object",
      properties: {
        track_index: {
          type: "integer",
          description: "Index of the track (0-based)",
        },
        clip_index: {
          type: "integer",
          description: "Index of the clip slot (0-based)",
        },
        notes: {
          type: "array",
          description: "Array of MIDI notes to add",
          items: {
            type: "object",
            properties: {
              pitch: {
                type: "integer",
                description: "MIDI note number (0-127, where 60 = middle C)",
                minimum: 0,
                maximum: 127,
              },
              start_time: {
                type: "number",
                description: "Start time in beats (0 = start of clip)",
                minimum: 0,
              },
              duration: {
                type: "number",
                description: "Duration in beats",
                minimum: 0,
              },
              velocity: {
                type: "integer",
                description: "Note velocity (1-127, default 100)",
                minimum: 1,
                maximum: 127,
              },
            },
            required: ["pitch", "start_time", "duration"],
          },
        },
      },
      required: ["track_index", "clip_index", "notes"],
    },
  },
  {
    name: "remove_notes_from_clip",
    description:
      "Remove MIDI notes from a clip within a specified time and pitch range. DESTRUCTIVE: requires confirmed=true after getting explicit user consent.",
    input_schema: {
      type: "object",
      properties: {
        track_index: {
          type: "integer",
          description: "Index of the track (0-based)",
        },
        clip_index: {
          type: "integer",
          description: "Index of the clip slot (0-based)",
        },
        from_time: {
          type: "number",
          description: "Start of the time range in beats (default 0)",
        },
        to_time: {
          type: "number",
          description: "End of the time range in beats (default: clip length)",
        },
        from_pitch: {
          type: "integer",
          description: "Lowest pitch to remove (default 0)",
          minimum: 0,
          maximum: 127,
        },
        to_pitch: {
          type: "integer",
          description: "Highest pitch to remove (default 127)",
          minimum: 0,
          maximum: 127,
        },
        confirmed: {
          type: "boolean",
          description: "Must be true. Only set after the user explicitly confirms removal.",
        },
      },
      required: ["track_index", "clip_index", "confirmed"],
    },
  },
  {
    name: "set_clip_name",
    description: "Rename a clip.",
    input_schema: {
      type: "object",
      properties: {
        track_index: {
          type: "integer",
          description: "Index of the track (0-based)",
        },
        clip_index: {
          type: "integer",
          description: "Index of the clip slot (0-based)",
        },
        name: {
          type: "string",
          description: "New name for the clip",
        },
      },
      required: ["track_index", "clip_index", "name"],
    },
  },
  {
    name: "delete_clip",
    description: "Delete a clip from a clip slot. DESTRUCTIVE: requires confirmed=true after getting explicit user consent.",
    input_schema: {
      type: "object",
      properties: {
        track_index: {
          type: "integer",
          description: "Index of the track (0-based)",
        },
        clip_index: {
          type: "integer",
          description: "Index of the clip slot (0-based)",
        },
        confirmed: {
          type: "boolean",
          description: "Must be true. Only set after the user explicitly confirms deletion.",
        },
      },
      required: ["track_index", "clip_index", "confirmed"],
    },
  },
  {
    name: "duplicate_clip",
    description: "Duplicate a clip to the next empty clip slot on the same track.",
    input_schema: {
      type: "object",
      properties: {
        track_index: {
          type: "integer",
          description: "Index of the track (0-based)",
        },
        clip_index: {
          type: "integer",
          description: "Index of the source clip slot (0-based)",
        },
      },
      required: ["track_index", "clip_index"],
    },
  },

  // --- Transport ---
  {
    name: "set_tempo",
    description: "Set the session tempo in BPM.",
    input_schema: {
      type: "object",
      properties: {
        bpm: {
          type: "number",
          description: "Tempo in beats per minute (20-999)",
          minimum: 20,
          maximum: 999,
        },
      },
      required: ["bpm"],
    },
  },
  {
    name: "set_time_signature",
    description: "Set the time signature of the session.",
    input_schema: {
      type: "object",
      properties: {
        numerator: {
          type: "integer",
          description: "Time signature numerator (e.g., 4 for 4/4)",
          minimum: 1,
          maximum: 99,
        },
        denominator: {
          type: "integer",
          description: "Time signature denominator (e.g., 4 for 4/4)",
          enum: [1, 2, 4, 8, 16],
        },
      },
      required: ["numerator", "denominator"],
    },
  },
  {
    name: "start_playback",
    description:
      "Start transport playback from the current position.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "stop_playback",
    description:
      "Stop transport playback.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "fire_clip",
    description:
      "Launch (fire) a clip in Session View. The clip will start playing according to the global quantization setting.",
    input_schema: {
      type: "object",
      properties: {
        track_index: {
          type: "integer",
          description: "Index of the track (0-based)",
        },
        clip_index: {
          type: "integer",
          description: "Index of the clip slot (0-based)",
        },
      },
      required: ["track_index", "clip_index"],
    },
  },
  {
    name: "stop_clip",
    description: "Stop a playing clip.",
    input_schema: {
      type: "object",
      properties: {
        track_index: {
          type: "integer",
          description: "Index of the track (0-based)",
        },
        clip_index: {
          type: "integer",
          description: "Index of the clip slot (0-based)",
        },
      },
      required: ["track_index", "clip_index"],
    },
  },
  {
    name: "fire_scene",
    description:
      "Launch an entire scene (all clips in that row across all tracks).",
    input_schema: {
      type: "object",
      properties: {
        scene_index: {
          type: "integer",
          description: "Index of the scene (0-based)",
        },
      },
      required: ["scene_index"],
    },
  },

  // --- Library Search ---
  {
    name: "search_library",
    description:
      "Search Ableton's sound library for instruments, presets, samples, or effects matching a description. Returns a list of matching items with URIs that can be loaded onto tracks.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Natural language search query (e.g., 'warm analog pad', 'punchy 808 kick', 'sidechain compressor')",
        },
        category: {
          type: "string",
          description: "Category to search within",
          enum: [
            "instruments",
            "sounds",
            "drums",
            "audio_effects",
            "midi_effects",
            "samples",
            "all",
          ],
        },
      },
      required: ["query"],
    },
  },

  // --- Send / Return ---
  {
    name: "create_return_track",
    description: "Create a new return track in the session.",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name for the return track",
        },
      },
    },
  },
  {
    name: "set_track_send",
    description:
      "Set the send level from a track to a return track.",
    input_schema: {
      type: "object",
      properties: {
        track_index: {
          type: "integer",
          description: "Index of the source track (0-based)",
        },
        send_index: {
          type: "integer",
          description: "Index of the send/return (0-based, A=0, B=1, etc.)",
        },
        level: {
          type: "number",
          description: "Send level (0.0 to 1.0)",
          minimum: 0,
          maximum: 1,
        },
      },
      required: ["track_index", "send_index", "level"],
    },
  },

  // --- Session Info ---
  {
    name: "get_session_state",
    description:
      "Request a fresh snapshot of the current Ableton session state. Use this when you need up-to-date information about the session that may have changed since the last state update.",
    input_schema: {
      type: "object",
      properties: {
        depth: {
          type: "string",
          description:
            "Level of detail to retrieve: 'minimal' (track names/types only), 'standard' (+ devices/clips), 'detailed' (+ parameter values), 'full' (everything)",
          enum: ["minimal", "standard", "detailed", "full"],
        },
        track_filter: {
          type: "array",
          description:
            "Optional list of track indices to include (omit for all tracks)",
          items: { type: "integer" },
        },
      },
    },
  },
];

module.exports = { tools };
