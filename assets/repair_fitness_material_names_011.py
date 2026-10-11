"""Repair pre-existing unnamed glTF materials blocking full-kit validation.

Names only: preserve every appearance property, binary byte, node and accessor.
"""
import copy
from check_glb import MODELS, read, validate
from palette_011 import write_glb

path = MODELS / 'fitness_corner.glb'
doc, binary = read(path)
original = copy.deepcopy(doc)
for material, name in zip(doc['materials'], ('fitness_ground', 'fitness_metal', 'fitness_wood', 'fitness_blue')):
    material.setdefault('name', name)
write_glb(path, doc, binary)
after, data = read(path)
assert data == binary
for material, old in zip(after['materials'], original['materials']):
    if 'name' not in old:
        material.pop('name')
assert after == original
print(validate(path))
