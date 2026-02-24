#!/usr/bin/env python3
"""Convert a JSON patcher file into a valid .amxd (Max for Live device) binary format.

.amxd files use a TLV (Type-Length-Value) chunk format:
  [4-byte field name][4-byte LE uint32 length][data bytes]

Required chunks:
  ampf - device type: aaaa=audio_effect, mmmm=midi_effect, iiii=instrument
  meta - metadata (always 4 bytes, value 1)
  ptch - the JSON patcher content (null-terminated)
"""

import struct
import sys
import json


def wrap_amxd(json_path, output_path, device_type="aaaa"):
    with open(json_path, "rb") as f:
        json_data = f.read()

    # Validate it's proper JSON
    json.loads(json_data)

    # Null-terminate the JSON data
    if not json_data.endswith(b'\x00'):
        json_data += b'\x00'

    with open(output_path, "wb") as f:
        # ampf chunk: device type identifier
        f.write(b'ampf')
        f.write(struct.pack('<I', 4))
        f.write(device_type.encode('ascii'))

        # meta chunk: metadata (always 4 bytes, value 1 in all observed .amxd files)
        f.write(b'meta')
        f.write(struct.pack('<I', 4))
        f.write(struct.pack('<I', 1))

        # ptch chunk: JSON patcher data
        f.write(b'ptch')
        f.write(struct.pack('<I', len(json_data)))
        f.write(json_data)

    print(f"Created {output_path} ({device_type} device, {len(json_data)} bytes patcher data)")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <input.json> <output.amxd> [device_type]")
        print("  device_type: aaaa (audio effect), mmmm (midi effect), iiii (instrument)")
        sys.exit(1)

    dtype = sys.argv[3] if len(sys.argv) > 3 else "aaaa"
    wrap_amxd(sys.argv[1], sys.argv[2], dtype)
