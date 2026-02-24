#!/usr/bin/env python3
"""Extract JSON patcher data from a binary .amxd file.

Reads the TLV chunks and writes the ptch (patcher) JSON to stdout or a file.
"""

import struct
import sys
import json


def unwrap_amxd(amxd_path, output_path=None):
    with open(amxd_path, "rb") as f:
        data = f.read()

    offset = 0
    device_type = None
    patcher_json = None

    while offset < len(data):
        if offset + 8 > len(data):
            break

        field = data[offset:offset + 4].decode("ascii")
        datasize = struct.unpack_from('<I', data, offset + 4)[0]
        chunk_data = data[offset + 8:offset + 8 + datasize]
        offset += 8 + datasize

        if field == "ampf":
            type_map = {"aaaa": "audio_effect", "mmmm": "midi_effect", "iiii": "instrument"}
            device_type = type_map.get(chunk_data.decode("ascii"), "unknown")
            print(f"Device type: {device_type}", file=sys.stderr)

        elif field == "ptch":
            # Strip null terminator if present
            if chunk_data and chunk_data[-1] == 0:
                chunk_data = chunk_data[:-1]
            patcher_json = chunk_data.decode("utf-8")
            # Validate and pretty-print
            parsed = json.loads(patcher_json)
            patcher_json = json.dumps(parsed, indent='\t') + '\n'

    if patcher_json is None:
        print("Error: no ptch chunk found in .amxd file", file=sys.stderr)
        sys.exit(1)

    if output_path:
        with open(output_path, "w") as f:
            f.write(patcher_json)
        print(f"Extracted patcher JSON to {output_path}", file=sys.stderr)
    else:
        sys.stdout.write(patcher_json)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <input.amxd> [output.json]")
        sys.exit(1)

    out = sys.argv[2] if len(sys.argv) > 2 else None
    unwrap_amxd(sys.argv[1], out)
