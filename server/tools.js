/**
 * Tool definitions for AI providers using Vercel AI SDK format.
 *
 * Each tool uses Zod schemas for parameter validation.
 * Tools that require Ableton interaction are defined without execute()
 * since they're dispatched to Max via the action-stream SSE.
 */

const { tool } = require("ai");
const { z } = require("zod");

// Destructive tools that require confirmed=true
const DESTRUCTIVE_TOOLS = new Set([
  "delete_track",
  "delete_clip",
  "remove_device",
  "remove_notes_from_clip",
]);

const tools = {
  // --- Track Management ---
  create_midi_track: tool({
    description:
      "Create a new MIDI track in the Ableton session. Use index -1 to append at the end.",
    parameters: z.object({
      index: z.number().int().optional().describe("Position to insert the track (-1 for end)"),
      name: z.string().optional().describe("Name for the new track"),
    }),
  }),

  create_audio_track: tool({
    description:
      "Create a new audio track in the Ableton session. Use index -1 to append at the end.",
    parameters: z.object({
      index: z.number().int().optional().describe("Position to insert the track (-1 for end)"),
      name: z.string().optional().describe("Name for the new track"),
    }),
  }),

  set_track_name: tool({
    description: "Rename an existing track.",
    parameters: z.object({
      track_index: z.number().int().describe("Index of the track to rename (0-based)"),
      name: z.string().describe("New name for the track"),
    }),
  }),

  delete_track: tool({
    description:
      "Delete a track from the session. DESTRUCTIVE: requires confirmed=true after getting explicit user consent.",
    parameters: z.object({
      track_index: z.number().int().describe("Index of the track to delete (0-based)"),
      confirmed: z
        .boolean()
        .describe("Must be true. Only set after the user explicitly confirms deletion."),
    }),
  }),

  set_track_volume: tool({
    description: "Set the volume of a track (0.0 = -inf dB, 0.85 = 0 dB, 1.0 = +6 dB).",
    parameters: z.object({
      track_index: z.number().int().describe("Index of the track (0-based)"),
      volume: z.number().min(0).max(1).describe("Volume value (0.0 to 1.0, where 0.85 is 0 dB)"),
    }),
  }),

  set_track_pan: tool({
    description:
      "Set the pan position of a track (-1.0 = full left, 0.0 = center, 1.0 = full right).",
    parameters: z.object({
      track_index: z.number().int().describe("Index of the track (0-based)"),
      pan: z.number().min(-1).max(1).describe("Pan position (-1.0 to 1.0)"),
    }),
  }),

  set_track_mute: tool({
    description: "Mute or unmute a track.",
    parameters: z.object({
      track_index: z.number().int().describe("Index of the track (0-based)"),
      mute: z.boolean().describe("True to mute, false to unmute"),
    }),
  }),

  set_track_solo: tool({
    description: "Solo or unsolo a track.",
    parameters: z.object({
      track_index: z.number().int().describe("Index of the track (0-based)"),
      solo: z.boolean().describe("True to solo, false to unsolo"),
    }),
  }),

  set_track_arm: tool({
    description: "Arm or disarm a track for recording.",
    parameters: z.object({
      track_index: z.number().int().describe("Index of the track (0-based)"),
      arm: z.boolean().describe("True to arm, false to disarm"),
    }),
  }),

  // --- Device / Instrument / Effect ---
  load_instrument: tool({
    description:
      "Load an instrument or preset onto a track from Ableton's browser. The URI identifies the specific instrument/preset in Ableton's content library.",
    parameters: z.object({
      track_index: z.number().int().describe("Index of the target track (0-based)"),
      uri: z.string().describe("Browser URI of the instrument/preset (e.g., from search_library results)"),
    }),
  }),

  load_effect: tool({
    description:
      "Load an audio effect onto a track. The effect is appended to the end of the device chain.",
    parameters: z.object({
      track_index: z.number().int().describe("Index of the target track (0-based)"),
      uri: z.string().describe("Browser URI of the audio effect"),
    }),
  }),

  set_device_parameter: tool({
    description:
      "Set a parameter value on a device. Parameter values are normalized to the device's own range.",
    parameters: z.object({
      track_index: z.number().int().describe("Index of the track (0-based)"),
      device_index: z.number().int().describe("Index of the device in the track's chain (0-based)"),
      parameter_name: z.string().describe("Name of the parameter to set (must match exactly)"),
      value: z.number().describe("Value to set (within the parameter's min/max range)"),
    }),
  }),

  remove_device: tool({
    description:
      "Remove a device from a track's device chain. DESTRUCTIVE: requires confirmed=true after getting explicit user consent.",
    parameters: z.object({
      track_index: z.number().int().describe("Index of the track (0-based)"),
      device_index: z.number().int().describe("Index of the device to remove (0-based)"),
      confirmed: z.boolean().describe("Must be true. Only set after the user explicitly confirms removal."),
    }),
  }),

  // --- Clip Management ---
  create_clip: tool({
    description:
      "Create an empty MIDI clip in a track's clip slot. The clip can then be populated with notes using add_notes_to_clip.",
    parameters: z.object({
      track_index: z.number().int().describe("Index of the MIDI track (0-based)"),
      clip_index: z.number().int().describe("Index of the clip slot (0-based, corresponds to scene index)"),
      length: z.number().describe("Length of the clip in beats (e.g., 4 = 1 bar in 4/4)"),
      name: z.string().optional().describe("Optional name for the clip"),
    }),
  }),

  add_notes_to_clip: tool({
    description:
      "Add MIDI notes to an existing clip. Notes are defined with pitch (MIDI number), start_time (in beats), duration (in beats), and optional velocity.",
    parameters: z.object({
      track_index: z.number().int().describe("Index of the track (0-based)"),
      clip_index: z.number().int().describe("Index of the clip slot (0-based)"),
      notes: z.array(
        z.object({
          pitch: z.number().int().min(0).max(127).describe("MIDI note number (0-127, where 60 = middle C)"),
          start_time: z.number().min(0).describe("Start time in beats (0 = start of clip)"),
          duration: z.number().min(0).describe("Duration in beats"),
          velocity: z.number().int().min(1).max(127).optional().describe("Note velocity (1-127, default 100)"),
        })
      ).describe("Array of MIDI notes to add"),
    }),
  }),

  remove_notes_from_clip: tool({
    description:
      "Remove MIDI notes from a clip within a specified time and pitch range. DESTRUCTIVE: requires confirmed=true after getting explicit user consent.",
    parameters: z.object({
      track_index: z.number().int().describe("Index of the track (0-based)"),
      clip_index: z.number().int().describe("Index of the clip slot (0-based)"),
      from_time: z.number().optional().describe("Start of the time range in beats (default 0)"),
      to_time: z.number().optional().describe("End of the time range in beats (default: clip length)"),
      from_pitch: z.number().int().min(0).max(127).optional().describe("Lowest pitch to remove (default 0)"),
      to_pitch: z.number().int().min(0).max(127).optional().describe("Highest pitch to remove (default 127)"),
      confirmed: z.boolean().describe("Must be true. Only set after the user explicitly confirms removal."),
    }),
  }),

  set_clip_name: tool({
    description: "Rename a clip.",
    parameters: z.object({
      track_index: z.number().int().describe("Index of the track (0-based)"),
      clip_index: z.number().int().describe("Index of the clip slot (0-based)"),
      name: z.string().describe("New name for the clip"),
    }),
  }),

  delete_clip: tool({
    description:
      "Delete a clip from a clip slot. DESTRUCTIVE: requires confirmed=true after getting explicit user consent.",
    parameters: z.object({
      track_index: z.number().int().describe("Index of the track (0-based)"),
      clip_index: z.number().int().describe("Index of the clip slot (0-based)"),
      confirmed: z.boolean().describe("Must be true. Only set after the user explicitly confirms deletion."),
    }),
  }),

  duplicate_clip: tool({
    description: "Duplicate a clip to the next empty clip slot on the same track.",
    parameters: z.object({
      track_index: z.number().int().describe("Index of the track (0-based)"),
      clip_index: z.number().int().describe("Index of the source clip slot (0-based)"),
    }),
  }),

  // --- Transport ---
  set_tempo: tool({
    description: "Set the session tempo in BPM.",
    parameters: z.object({
      bpm: z.number().min(20).max(999).describe("Tempo in beats per minute (20-999)"),
    }),
  }),

  set_time_signature: tool({
    description: "Set the time signature of the session.",
    parameters: z.object({
      numerator: z.number().int().min(1).max(99).describe("Time signature numerator (e.g., 4 for 4/4)"),
      denominator: z.enum(["1", "2", "4", "8", "16"]).transform(Number).describe("Time signature denominator (e.g., 4 for 4/4)"),
    }),
  }),

  start_playback: tool({
    description: "Start transport playback from the current position.",
    parameters: z.object({}),
  }),

  stop_playback: tool({
    description: "Stop transport playback.",
    parameters: z.object({}),
  }),

  fire_clip: tool({
    description:
      "Launch (fire) a clip in Session View. The clip will start playing according to the global quantization setting.",
    parameters: z.object({
      track_index: z.number().int().describe("Index of the track (0-based)"),
      clip_index: z.number().int().describe("Index of the clip slot (0-based)"),
    }),
  }),

  stop_clip: tool({
    description: "Stop a playing clip.",
    parameters: z.object({
      track_index: z.number().int().describe("Index of the track (0-based)"),
      clip_index: z.number().int().describe("Index of the clip slot (0-based)"),
    }),
  }),

  fire_scene: tool({
    description: "Launch an entire scene (all clips in that row across all tracks).",
    parameters: z.object({
      scene_index: z.number().int().describe("Index of the scene (0-based)"),
    }),
  }),

  // --- Library Search ---
  search_library: tool({
    description:
      "Search Ableton's sound library for instruments, presets, samples, or effects matching a description. Returns a list of matching items with URIs that can be loaded onto tracks.",
    parameters: z.object({
      query: z.string().describe("Natural language search query (e.g., 'warm analog pad', 'punchy 808 kick')"),
      category: z
        .enum(["instruments", "sounds", "drums", "audio_effects", "midi_effects", "samples", "all"])
        .optional()
        .describe("Category to search within"),
    }),
  }),

  // --- Send / Return ---
  create_return_track: tool({
    description: "Create a new return track in the session.",
    parameters: z.object({
      name: z.string().optional().describe("Name for the return track"),
    }),
  }),

  set_track_send: tool({
    description: "Set the send level from a track to a return track.",
    parameters: z.object({
      track_index: z.number().int().describe("Index of the source track (0-based)"),
      send_index: z.number().int().describe("Index of the send/return (0-based, A=0, B=1, etc.)"),
      level: z.number().min(0).max(1).describe("Send level (0.0 to 1.0)"),
    }),
  }),

  // --- Session Info ---
  get_session_state: tool({
    description:
      "Request a fresh snapshot of the current Ableton session state. Use this when you need up-to-date information about the session that may have changed since the last state update.",
    parameters: z.object({
      depth: z
        .enum(["minimal", "standard", "detailed", "full"])
        .optional()
        .describe("Level of detail to retrieve"),
      track_filter: z.array(z.number().int()).optional().describe("Optional list of track indices to include (omit for all tracks)"),
    }),
  }),
};

module.exports = { tools, DESTRUCTIVE_TOOLS };
