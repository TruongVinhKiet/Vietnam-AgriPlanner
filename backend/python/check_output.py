import json
import sys

path = sys.argv[1] if len(sys.argv) > 1 else 'test_planning_output.json'
d = json.load(open(path, 'r', encoding='utf-8'))
zones = d['zones']

print(f"Total zones: {len(zones)}")
print(f"Total zone types: {d.get('soilTypesCount', '?')}")
print()

# Count by zone type
types = {}
for z in zones:
    zt = z.get('zoneType') or 'UNCLASSIFIED'
    if zt not in types:
        types[zt] = {'count': 0, 'area': 0}
    types[zt]['count'] += 1
    types[zt]['area'] += z.get('areaPercent', 0)

print("Zone type breakdown:")
for zt, info in sorted(types.items(), key=lambda x: x[1]['area'], reverse=True):
    print(f"  {zt}: {info['count']} zones, {info['area']:.2f}%")

print()

# Show some unclassified zones
unclassified = [z for z in zones if not z.get('zoneType')]
if unclassified:
    print(f"Unclassified zones: {len(unclassified)}")
    for z in unclassified[:15]:
        print(f"  Zone {z['id']}: color={z['fillColor']}, rgb={z['colorRgb']}, area={z['areaPercent']}%")

# Show all unique colors
print()
colors = set()
for z in zones:
    colors.add((z['fillColor'], tuple(z['colorRgb'])))
print(f"Unique colors: {len(colors)}")
for c, rgb in sorted(colors):
    count = sum(1 for z in zones if z['fillColor'] == c)
    print(f"  {c} RGB={rgb}: {count} zones")
