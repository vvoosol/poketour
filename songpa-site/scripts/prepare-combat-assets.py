"""Prepare pinned PMDCollab sprite sheets for local browser playback.

Run with Python + Pillow. --download fetches only the selected public assets;
normal game builds use the checked-in output and need neither Python nor network.
Images are copied verbatim. Only XML/marker metadata is converted to JSON/JS.
"""
import argparse
import concurrent.futures
import hashlib
import html
import json
from pathlib import Path
import re
import urllib.request
import xml.etree.ElementTree as ET
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'source-data' / 'combat'
OUTPUT = ROOT / 'public' / 'combat'
COMMIT = '0250bd6e62029bb896276a7f6bcb2385ed1a02f0'
RAW = f'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/{COMMIT}/'
PAGE = f'https://github.com/PMDCollab/SpriteCollab/blob/{COMMIT}/'
SPECIES = [749, 915, 940]
ACTIONS = ['Idle', 'Walk', 'Attack', 'Shoot', 'Hurt', 'Faint']
DIRECTIONS = ['down', 'down-right', 'right', 'up-right', 'up', 'up-left', 'left', 'down-left']


def fetch(relative, destination):
    if destination.exists():
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(RAW + relative, headers={'User-Agent': 'Poketour-asset-preparation'})
    with urllib.request.urlopen(request, timeout=20) as response:
        content = response.read()
    destination.write_bytes(content)


def resolve(animations, name, seen=()):
    if name in seen:
        raise ValueError('Cyclic animation: ' + name)
    item = animations.get(name)
    if item is None:
        return None
    alias = item.findtext('CopyOf')
    return resolve(animations, alias, seen + (name,)) if alias else item


def marker(image, box, kind):
    frame = image.crop(box)
    positions = []
    for y in range(frame.height):
        for x in range(frame.width):
            r, g, b, a = frame.getpixel((x, y))
            if a == 255 and ((kind == 'foot' and r == g == b == 255) or (kind == 'center' and g == 255)):
                positions.append([x, y])
    if len(positions) > 1:
        raise ValueError('Ambiguous ' + kind + ' marker')
    return positions[0] if positions else [frame.width // 2, frame.height // 2]


def prepare(download=False):
    SOURCE.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    if download:
        jobs = [('README.md', SOURCE / 'README.md'), ('credit_names.txt', SOURCE / 'credit_names.txt')]
        for license_name in ['LICENSE.PMDCollab_1.md', 'LICENSE.PMDCollab_2.md', 'LICENSE.CC_BY-NC_4.md']:
            jobs.append(('license_history/' + license_name, OUTPUT / license_name))
        for number in SPECIES:
            for filename in ['AnimData.xml', 'credits.txt']:
                jobs.append((f'sprite/{number:04d}/{filename}', SOURCE / str(number) / filename))
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            list(pool.map(lambda item: fetch(*item), jobs))

    manifest = {'version': 1, 'sourceCommit': COMMIT, 'directions': DIRECTIONS,
                'ticksPerSecond': 60, 'timingNote': 'Poketour display rate; original XML ticks retained.',
                'fallback': {'species': 'existing front PNG', 'action': 'procedural motion',
                             'back': 'unavailable unless a directional sheet is present',
                             'shiny': 'existing tinted PNG; no dedicated shiny sheets imported'},
                'excluded': {'318': 'Upstream base credits identify CHUNSOFT/Unspecified; kept existing sprite.'},
                'species': {}, 'files': []}
    jobs = []
    xml_by_species = {}
    for number in SPECIES:
        xml = ET.parse(SOURCE / str(number) / 'AnimData.xml')
        animations = {a.findtext('Name'): a for a in xml.findall('./Anims/Anim')}
        xml_by_species[number] = animations
        required = {a.findtext('Name') for name in ACTIONS if (a := resolve(animations, name)) is not None}
        for name in required:
            for suffix in ['Anim', 'Offsets', 'Shadow']:
                filename = f'{name}-{suffix}.png'
                jobs.append((f'sprite/{number:04d}/{filename}', OUTPUT / str(number) / filename))
    if download:
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            list(pool.map(lambda item: fetch(*item), jobs))
    names = (SOURCE / 'credit_names.txt').read_text(encoding='utf-8-sig')
    credits_html = []
    for number, animations in xml_by_species.items():
        credits = (SOURCE / str(number) / 'credits.txt').read_text(encoding='utf-8-sig')
        assert 'CHUNSOFT' not in credits and 'Unspecified' not in credits, 'Review official/unlicensed materials separately'
        authors = sorted(set(re.findall(r'<@!?(\d+)>', credits)))
        author_lines = [line for line in names.splitlines() if any(author in line for author in authors)]
        licenses = sorted(set(line.split('\t')[3] for line in credits.splitlines() if len(line.split('\t')) > 3))
        assert all(v in ['PMDCollab_1', 'PMDCollab_2', 'CC_BY-NC_4'] for v in licenses), licenses
        target = {'source': PAGE + f'sprite/{number:04d}/AnimData.xml', 'credits': credits,
                  'authors': author_lines or authors, 'licenses': licenses, 'shiny': False,
                  'views': {'front': 'down', 'back': 'up', 'style': 'directional-overworld'}, 'actions': {}}
        for name in ACTIONS:
            item = resolve(animations, name)
            if item is None:
                target['actions'][name] = {'fallback': 'Hurt' if name == 'Faint' else 'Idle', 'dedicated': False}
                continue
            source_name = item.findtext('Name')
            width, height = int(item.findtext('FrameWidth')), int(item.findtext('FrameHeight'))
            durations = [int(d.text) for d in item.findall('./Durations/Duration')]
            assert durations and min(durations) > 0
            paths = {suffix: OUTPUT / str(number) / f'{source_name}-{suffix}.png' for suffix in ['Anim', 'Offsets', 'Shadow']}
            images = {k: Image.open(v).convert('RGBA') for k, v in paths.items()}
            size = images['Anim'].size
            assert all(i.size == size for i in images.values())
            assert size[0] == width * len(durations) and size[1] in [height, height * 8], (number, name, size)
            rows = size[1] // height
            anchors, centers = [], []
            for row in range(rows):
                feet, mids = [], []
                for column in range(len(durations)):
                    box = (column * width, row * height, (column + 1) * width, (row + 1) * height)
                    feet.append(marker(images['Shadow'], box, 'foot'))
                    mids.append(marker(images['Offsets'], box, 'center'))
                anchors.append(feet)
                centers.append(mids)
            target['actions'][name] = {'sheet': f'combat/{number}/{source_name}-Anim.png', 'width': width, 'height': height,
                'frames': len(durations), 'rows': rows, 'ticks': durations, 'durationMs': sum(durations) * 1000 / 60,
                'rushFrame': int(item.findtext('RushFrame', '0')), 'hitFrame': int(item.findtext('HitFrame', '0')),
                'returnFrame': int(item.findtext('ReturnFrame', str(len(durations)-1))),
                'feet': anchors, 'centers': centers, 'dedicated': True, 'alias': source_name if source_name != name else None}
        manifest['species'][str(number)] = target
        credits_html.append(f'<h2>#{number}</h2><p>{html.escape(" · ".join(target["authors"]))}</p><p>{html.escape(", ".join(licenses))}</p><a href="{target["source"]}">Original source</a><pre>{html.escape(credits)}</pre>')
    for relative, path in jobs:
        content = path.read_bytes()
        manifest['files'].append({'path': path.relative_to(ROOT / 'public').as_posix(), 'source': RAW + relative,
                                  'sha256': hashlib.sha256(content).hexdigest(), 'bytes': len(content)})
    manifest['coverage'] = {'animatedSpecies': SPECIES, 'starterAnimated': [749, 940], 'starterFallback': [318],
                            'testWildAnimated': [915], 'dedicatedFaint': [], 'canonicalBattleBacks': []}
    encoded = json.dumps(manifest, ensure_ascii=False, separators=(',', ':'))
    (OUTPUT / 'manifest.json').write_text(encoded, encoding='utf-8')
    (OUTPUT / 'manifest.js').write_text('globalThis.PoketourCombatAssets = ' + encoded + ';\n', encoding='utf-8')
    (OUTPUT / 'CREDITS.html').write_text('<!doctype html><html lang="ko"><meta charset="utf-8"><title>Poketour combat credits</title><h1>Combat sprite credits</h1><p>PMDCollab / SpriteCollab. PNG files unchanged; XML and marker data converted to manifest. Directional overworld views, not mainline battle sprites. Character rights remain with their respective owners.</p>' + ''.join(credits_html) + '<p><a href="EFFECTS_CREDITS.md">Move effects source and modifications</a></p><h2>Licenses</h2>' + ''.join(f'<p><a href="LICENSE.{name}.md">{name}</a></p>' for name in ['PMDCollab_1', 'PMDCollab_2', 'CC_BY-NC_4']) + '</html>', encoding='utf-8')
    print(f'Prepared {len(SPECIES)} animated species, {len(jobs)} original PNG sheets; explicit missing-action/species fallback.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--download', action='store_true')
    prepare(parser.parse_args().download)
