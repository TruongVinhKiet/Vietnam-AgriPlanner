"""Find cyan colors in the map image"""
import cv2
import numpy as np

img = cv2.imread(r'E:\Agriplanner\backend\python\image\upscalemedia-transformed (1).jpeg')
rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
p = rgb.reshape(-1, 3)

# Filter
r, g, b = p[:, 0].astype(np.int32), p[:, 1].astype(np.int32), p[:, 2].astype(np.int32)
not_white = ~((r > 252) & (g > 252) & (b > 252))
not_black = ~((r < 35) & (g < 35) & (b < 35))
mask = not_white & not_black

valid = p[mask]
print(f'Valid pixels: {len(valid):,}')

# Quantize with HISTOGRAM_BINS=64
step = 256 // 64
q = (valid // step) * step

# Pack to key
keys = q[:, 0].astype(np.int32) * 65536 + q[:, 1].astype(np.int32) * 256 + q[:, 2].astype(np.int32)
unique_keys, counts = np.unique(keys, return_counts=True)

print("\n=== HIGH BLUE COLORS (Blue > 200) ===")
# Find all colors where Blue channel is high
cyan_found = []
for i in np.argsort(-counts):
    key = unique_keys[i]
    cnt = counts[i]
    pct = cnt / len(valid) * 100
    
    rr = (key // 65536) & 0xFF
    gg = (key // 256) & 0xFF
    bb = key & 0xFF
    
    # Check if Blue is high (>200)
    if bb > 200:
        hex_c = f'#{rr:02x}{gg:02x}{bb:02x}'
        cyan_found.append((hex_c, rr, gg, bb, pct, cnt))
        
if not cyan_found:
    print("NO COLORS WITH BLUE > 200 FOUND!")
else:
    for c in sorted(cyan_found, key=lambda x: -x[5])[:30]:
        print(f'{c[0]} RGB({c[1]},{c[2]},{c[3]}) - {c[4]:.3f}% - {c[5]:,} pixels')

print("\n=== YELLOW/LIGHT COLORS (Dat cat, Dat man candidates) ===")
# Find yellow-ish colors
for i in np.argsort(-counts):
    key = unique_keys[i]
    cnt = counts[i]
    pct = cnt / len(valid) * 100
    
    rr = (key // 65536) & 0xFF
    gg = (key // 256) & 0xFF
    bb = key & 0xFF
    
    # Check if yellow (R and G high, B low)
    if rr > 180 and gg > 180 and bb < 150:
        hex_c = f'#{rr:02x}{gg:02x}{bb:02x}'
        print(f'{hex_c} RGB({rr},{gg},{bb}) - {pct:.3f}% - {cnt:,} pixels')

print("\n=== LIGHT CYAN (Bai boi candidates) ===")
# Find light cyan colors
for i in np.argsort(-counts):
    key = unique_keys[i]
    cnt = counts[i]
    pct = cnt / len(valid) * 100
    
    rr = (key // 65536) & 0xFF
    gg = (key // 256) & 0xFF
    bb = key & 0xFF
    
    # Light cyan (all channels high but B slightly higher)
    if rr > 180 and gg > 200 and bb > 220 and bb >= rr:
        hex_c = f'#{rr:02x}{gg:02x}{bb:02x}'
        print(f'{hex_c} RGB({rr},{gg},{bb}) - {pct:.3f}% - {cnt:,} pixels')

print("\n=== SALMON/ORANGE (Dat vang do candidates) ===")
# Find salmon/orange colors  
for i in np.argsort(-counts):
    key = unique_keys[i]
    cnt = counts[i]
    pct = cnt / len(valid) * 100
    
    rr = (key // 65536) & 0xFF
    gg = (key // 256) & 0xFF
    bb = key & 0xFF
    
    # Salmon (R high, G medium, B low-medium)
    if rr > 180 and 80 < gg < 180 and bb < 160:
        hex_c = f'#{rr:02x}{gg:02x}{bb:02x}'
        print(f'{hex_c} RGB({rr},{gg},{bb}) - {pct:.3f}% - {cnt:,} pixels')
