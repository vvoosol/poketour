"""Build a small cached place snapshot from OpenFreeMap's OSM vector tiles.
No runtime Overpass calls, no GPS, no proprietary map scraping.
Dependencies: mapbox-vector-tile, shapely (development only).
"""
import concurrent.futures
import json
import math
import pathlib
import urllib.request
import mapbox_vector_tile
from shapely.geometry import shape, Point

ROOT = pathlib.Path(__file__).resolve().parent.parent
BOUNDARY_FILE = ROOT/'source-data/seoul-boundaries.json'
boundary = next(f for f in json.loads(BOUNDARY_FILE.read_text())['features'] if '송파' in str(f['properties']))
polygon = shape(boundary['geometry'])
tile_template = json.loads((ROOT/'source-data/tilejson.json').read_text())['tiles'][0]
minx, miny, maxx, maxy = polygon.bounds
zoom = 14
def tile(lo,la):
    return int((lo+180)/360*2**zoom), int((1-math.asinh(math.tan(math.radians(la)))/math.pi)/2*2**zoom)
x0,y0=tile(minx,maxy)
x1,y1=tile(maxx,miny)
def convert(x,y,coord,extent):
    gx=(x+coord[0]/extent)/2**zoom
    gy=(y+1-coord[1]/extent)/2**zoom
    return gx*360-180, math.degrees(math.atan(math.sinh(math.pi*(1-2*gy))))
def load(pair):
    x,y=pair
    url=tile_template.format(z=zoom,x=x,y=y)
    request=urllib.request.Request(url,headers={'User-Agent':'SongpaMapPrototype/1.0'})
    with urllib.request.urlopen(request,timeout=25) as response:
        decoded=mapbox_vector_tile.decode(response.read())
    elements=[]
    for layer_name in ['poi','water_name','park']:
        layer=decoded.get(layer_name,{})
        extent=layer.get('extent',4096)
        for feature in layer.get('features',[]):
            props=feature['properties']
            name=props.get('name:ko') or props.get('name')
            if not name: continue
            sub=props.get('subclass','')
            cls=props.get('class','')
            if layer_name=='water_name': tags={'natural':'water'}
            elif layer_name=='park' or sub=='park': tags={'leisure':'park'}
            elif sub=='hospital': tags={'amenity':'hospital'}
            elif sub in ['school','university']: tags={'amenity':sub}
            else: continue
            geom=feature['geometry']
            if geom['type']=='Point': c=geom['coordinates']
            elif geom['type'] in ['Polygon','MultiPolygon']:
                center=shape(geom).representative_point();c=[center.x,center.y]
            else: continue
            lon,lat=convert(x,y,c,extent)
            if not polygon.covers(Point(lon,lat)): continue
            tags['name']=name
            elements.append({'type':'tile-feature','id':f'{layer_name}-{feature.get("id",0)}-{x}-{y}', 'lat':lat,'lon':lon,'tags':tags})
    return elements
pairs=[(x,y) for x in range(x0,x1+1) for y in range(y0,y1+1)]
elements=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    for points in pool.map(load,pairs): elements.extend(points)
seen=set();unique=[]
for e in elements:
    key=(e['tags']['name'],round(e['lat'],3),round(e['lon'],3))
    if key not in seen: unique.append(e);seen.add(key)
geometry=boundary['geometry']
if geometry['type']=='Polygon': geometry={'type':'MultiPolygon','coordinates':[geometry['coordinates']]}
output={'source':'OpenFreeMap / OpenMapTiles / OpenStreetMap','osm3s':{'timestamp_osm_base':'2026-09-27'},'boundary':geometry,'boundary_note':'2015 공개 행정경계 데이터 기반 시험 범위. 최신 행정경계를 보장하지 않음.','elements':unique}
(ROOT/'public/songpa-osm.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':')))
print(json.dumps({'tiles':len(pairs),'places':len(unique),'types':{t:sum(1 for e in unique if e['tags'].get('amenity')==t) for t in ['school','university','hospital']}},ensure_ascii=False))
