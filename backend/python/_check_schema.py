import psycopg2
conn = psycopg2.connect(host='localhost', port=5432, dbname='AgriPlanner', user='postgres', password='Kiet2004')
cur = conn.cursor()
cur.execute("""SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'land_parcels' 
ORDER BY ordinal_position""")
for r in cur.fetchall():
    ml = str(r[2]) if r[2] else ""
    print(f"  {r[0]:<30} {r[1]:<25} {ml}")

# Check constraints
print("\n--- Indexes/Constraints ---")
cur.execute("""SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'land_parcels'""")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]}")

# Count per district
print("\n--- Counts per district ---")
cur.execute("SELECT district, COUNT(*) FROM land_parcels GROUP BY district ORDER BY COUNT(*) DESC")
for r in cur.fetchall():
    print(f"  {r[0]:<25} {r[1]:>10,}")

# Sample parcel_ids
print("\n--- Sample parcel_ids (non-Thoi Binh) ---")
cur.execute("SELECT parcel_id, district FROM land_parcels WHERE district != 'Thới Bình' LIMIT 10")
for r in cur.fetchall():
    print(f"  {r[0]:<40} {r[1]}")

# Sample parcel_ids (Thoi Binh)
print("\n--- Sample parcel_ids (Thoi Binh) ---")
cur.execute("SELECT parcel_id FROM land_parcels WHERE district = 'Thới Bình' LIMIT 5")
for r in cur.fetchall():
    print(f"  {r[0]}")

# Check total features via objectid range per district
print("\n--- ObjectID ranges ---")
cur.execute("SELECT district, MIN(object_id), MAX(object_id), COUNT(*) FROM land_parcels GROUP BY district ORDER BY district")
for r in cur.fetchall():
    print(f"  {r[0]:<25} min={r[1]:<15} max={r[2]:<15} count={r[3]:,}")

cur.close()
conn.close()
