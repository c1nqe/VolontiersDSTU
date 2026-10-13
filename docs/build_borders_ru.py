import json, sys
from shapely.geometry import shape, mapping, box
from shapely.ops import unary_union, linemerge
from shapely.strtree import STRtree
from shapely import set_precision

TOL = float(sys.argv[1]) if len(sys.argv) > 1 else 0.004
# Скрипт строит borders-ru.geojson: границы в российской трактовке (Крым, ДНР, ЛНР, Херсонская и Запорожская
# области в составе России). Исходные данные — Natural Earth (общественное достояние), из репозитория
# github.com/nvkelso/natural-earth-vector (папка geojson):
#   ne_10m_admin_0_countries_rus.geojson  — страны, российская трактовка
#   ne_10m_admin_1_states_provinces.geojson — области (берутся UA-14, UA-09, UA-65, UA-23)
# Запуск: python3 build_borders_ru.py 0.002   (число — допуск упрощения линий в градусах)
c = json.load(open('ne_10m_admin_0_countries_rus.geojson'))
a1 = json.load(open('ne_10m_admin_1_states_provinces.geojson'))

countries = {}
for f in c['features']:
    p = f['properties']
    countries[p['ADM0_A3']] = shape(f['geometry']).buffer(0)
r4 = unary_union([shape(f['geometry']).buffer(0) for f in a1['features']
                  if f['properties'].get('iso_3166_2') in ('UA-14', 'UA-09', 'UA-65', 'UA-23')])
# Полигоны областей из Natural Earth обобщены и не захватывают центр Херсона (≈400 м от границы),
# поэтому добавляем небольшой круг вокруг города, чтобы он оказался на российской стороне линии.
from shapely.geometry import Point as _P
r4 = r4.union(_P(32.617, 46.635).buffer(0.05))
print('R4 area', r4.area)
rus = countries['RUS'].union(r4)
ukr = countries['UKR'].difference(r4)
countries['RUS'], countries['UKR'] = rus, ukr
# Крым и Севастополь в российской трактовке NE уже в составе России; проверим
from shapely.geometry import Point
for n, (x, y) in {'Симферополь': (34.1, 44.95), 'Донецк': (37.8, 48.0), 'Луганск': (39.3, 48.57), 'Херсон': (32.6, 46.63), 'Мелитополь': (35.37, 46.84), 'Мариуполь': (37.55, 47.1), 'Запорожье': (35.14, 47.84)}.items():
    print(n, 'RUS' if rus.contains(Point(x, y)) else ('UKR' if ukr.contains(Point(x, y)) else '-'))

names = list(countries)
geoms = [countries[k] for k in names]
tree = STRtree(geoms)
# общие границы: линия границы страны A, которая лежит в пределах малого буфера другой страны B
EPS = 2e-4
lines = []
for i, a in enumerate(geoms):
    bd = a.boundary
    for j in tree.query(a.buffer(EPS)):
        if j <= i: continue
        b = geoms[j]
        shared = bd.intersection(b.buffer(EPS))
        if not shared.is_empty:
            lines.append(shared)
u = unary_union(lines)
u = linemerge(u) if u.geom_type == 'MultiLineString' else u
u = u.simplify(TOL, preserve_topology=False)
def q(g):
    return mapping(set_precision(g, 0.0001))
out = {'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'properties': {}, 'geometry': q(u)}]}
s = json.dumps(out, separators=(',', ':'))
open('borders_ru.geojson', 'w').write(s)
print('size', len(s), 'parts', len(u.geoms) if hasattr(u, 'geoms') else 1)
