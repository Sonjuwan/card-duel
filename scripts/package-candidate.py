#!/usr/bin/env python3
"""Package an UNBUILT source candidate without losing ignored AI checkpoints.

The previous fully verified source+play ZIP is the only source of ignored AI
checkpoint files and the explicitly old playable dist/ assets. This script
never claims that an unbuilt source candidate has new runnable assets.
"""
import argparse
import hashlib
import io
import subprocess
import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
PREFIX = 'card-duel/'


def git(*args: str) -> bytes:
    return subprocess.check_output(['git', *args], cwd=ROOT)


def build(base: Path, output: Path, playable_version: str) -> dict:
    if not base.is_file():
        raise ValueError('Verified baseline ZIP not found')
    if output.exists():
        raise ValueError('Refusing to overwrite an existing candidate')
    if git('status', '--porcelain').strip():
        raise ValueError('Refusing to package uncommitted changes')
    rev = git('rev-parse', 'HEAD').decode().strip()
    source = io.BytesIO(git('archive', '--format=zip', 'HEAD'))
    ai_count = 0
    with ZipFile(base) as old, ZipFile(source) as head:
        oldfiles = {n.removeprefix(PREFIX): n for n in old.namelist() if n.startswith(PREFIX) and not n.endswith('/')}
        headfiles = [n for n in head.namelist() if not n.endswith('/')]
        baseline_data = {k for k in oldfiles if k.startswith('data/') and not k.startswith('data/ai/')}
        new_data = {k for k in headfiles if k.startswith('data/') and not k.startswith('data/ai/')}
        if baseline_data != new_data:
            raise ValueError('Tracked data paths changed; refusing to package')
        for k in baseline_data:
            if head.read(k) != old.read(oldfiles[k]):
                raise ValueError(f'Original card/AI data changed: {k}')
        if 'solo-offline.html' not in headfiles or head.read('solo-offline.html') != old.read(oldfiles['solo-offline.html']):
            raise ValueError('Standalone HTML no longer matches verified playable baseline')
        ai_files = [k for k in oldfiles if k.startswith('data/ai/')]
        dist_files = [k for k in oldfiles if k.startswith('dist/solo-app/')]
        if not ai_files or not dist_files:
            raise ValueError('Verified baseline is missing ignored AI checkpoints or playable assets')
        output.parent.mkdir(parents=True, exist_ok=True)
        try:
            with ZipFile(output, 'w', compression=ZIP_DEFLATED, compresslevel=5, allowZip64=True) as dest:
                for k in headfiles:
                    dest.writestr(PREFIX + k, head.read(k))
                for k in ai_files + dist_files:
                    if k in headfiles:
                        raise ValueError(f'Duplicate tracked/ignored file: {k}')
                    dest.writestr(PREFIX + k, old.read(oldfiles[k]))
                ai_count = len(ai_files)
                notice = (f'UNBUILT Card Duel source candidate: Git {rev}\n'
                          f'Contents: current tracked source + unchanged AI checkpoints.\n'
                          f'solo-offline.html and dist/solo-app/ are playable but ONLY from verified {playable_version}.\n'
                          f'They do not contain changes made in this candidate.\n'
                          f'Build on Node.js 24 and run all tests before promoting this candidate.\n')
                dest.writestr(PREFIX + 'UNBUILT-CANDIDATE-NOTICE.txt', notice)
            with ZipFile(output) as merged:
                if merged.testzip() is not None:
                    raise ValueError('Candidate ZIP CRC verification failed')
                for k in baseline_data | set(ai_files) | set(dist_files):
                    expected = head.read(k) if k in baseline_data else old.read(oldfiles[k])
                    if hashlib.sha256(merged.read(PREFIX + k)).digest() != hashlib.sha256(expected).digest():
                        raise ValueError(f'Backup integrity check failed: {k}')
        except Exception:
            output.unlink(missing_ok=True)
            raise
    return {'commit': rev, 'original_ai_files': ai_count, 'verified_playable_assets': len(dist_files), 'source_files': len(headfiles), 'size_bytes': output.stat().st_size}


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--base', required=True, type=Path, help='Last fully verified source-and-play ZIP')
    p.add_argument('--output', required=True, type=Path)
    p.add_argument('--playable-version', default='v0.197.0')
    args = p.parse_args()
    try:
        print(build(args.base, args.output, args.playable_version))
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(f'Candidate packaging refused: {error}', file=sys.stderr)
        sys.exit(1)
