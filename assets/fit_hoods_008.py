"""Lower existing hood meshes behind the neck; preserve materials, skin weights and binds.

Run from any directory with Python. Target boxes are in villager_base model space
(+Y up, +Z face). Absolute bounds make the repair repeatable and idempotent.
"""
import json
import math
import struct
from check_glb import MODELS, read, values


def fit(name):
    path = MODELS / (name + '.glb')
    doc, source = read(path)
    binary = bytearray(source)
    for node in doc['nodes']:
        if node.get('name') not in ('hood', 'hood_back'):
            continue
        target_min = [-.285, .985, -.36] if node['name'] == 'hood' else [-.25, .90, -.35]
        target_max = [.285, 1.10, -.105] if node['name'] == 'hood' else [.25, 1.11, -.10]
        for primitive in doc['meshes'][node['mesh']]['primitives']:
            index = primitive['attributes']['POSITION']
            positions = values(doc, binary, index)
            lo = [min(p[i] for p in positions) for i in range(3)]
            hi = [max(p[i] for p in positions) for i in range(3)]
            scale = [(target_max[i] - target_min[i]) / (hi[i] - lo[i]) for i in range(3)]
            for attribute in ('POSITION', 'NORMAL'):
                if attribute not in primitive['attributes']:
                    continue
                accessor = doc['accessors'][primitive['attributes'][attribute]]
                view = doc['bufferViews'][accessor['bufferView']]
                start = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
                for j, point in enumerate(values(doc, binary, primitive['attributes'][attribute])):
                    if attribute == 'POSITION':
                        result = [(point[i] - lo[i]) * scale[i] + target_min[i] for i in range(3)]
                    else:
                        result = [point[i] / scale[i] for i in range(3)]
                        length = math.sqrt(sum(v*v for v in result))
                        result = [v / length for v in result]
                    struct.pack_into('<3f', binary, start + j * view.get('byteStride', 12), *result)
                if attribute == 'POSITION':
                    accessor['min'], accessor['max'] = target_min, target_max
    metadata = json.dumps(doc, separators=(',', ':')).encode()
    metadata += b' ' * (-len(metadata) % 4)
    binary += b'\0' * (-len(binary) % 4)
    path.write_bytes(struct.pack('<III', 0x46546C67, 2, 28 + len(metadata) + len(binary)) +
                     struct.pack('<II', len(metadata), 0x4E4F534A) + metadata +
                     struct.pack('<II', len(binary), 0x004E4942) + binary)


if __name__ == '__main__':
    for asset in ('shirt_hoodie', 'outfit_hoodie'):
        fit(asset)
        print('Fitted', asset)
