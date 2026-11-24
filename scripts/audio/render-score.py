"""Render Card Duel's original score with FluidSynth and TimGM6mb.
Usage: python3 scripts/audio/render-score.py [SoundFont path]
"""
import ctypes as c
import math
import random
import subprocess
import sys
from pathlib import Path

TRACKS = [
    ('home', 88, 66, 83, (24, 110, 46), (0, 5, 9, 7), True),
    ('prepare', 100, 75, 81, (24, 21, 73), (0, 5, 7, 5), True),
    ('library', 76, 57, 76, (46, 42, 24), (0, 8, 5, 7), False),
    ('deck', 94, 70, 79, (24, 71, 46), (0, 5, 4, 7), True),
    ('battle-1', 112, 84, 81, (24, 42, 110), (0, 3, 5, 7), False),
    ('battle-2', 100, 75, 77, (70, 71, 24), (0, 3, 6, 7), False),
    ('battle-3', 104, 78, 81, (78, 46, 110), (0, 5, 9, 7), True),
    ('battle-4', 88, 66, 76, (42, 24, 70), (0, 8, 5, 7), False),
    ('battle-5', 120, 90, 77, (21, 110, 24), (0, 5, 7, 0), True),
    ('battle-6', 96, 72, 79, (73, 46, 42), (0, 3, 8, 7), False),
    ('progress', 92, 69, 84, (46, 110, 24), (0, 5, 9, 7), True),
    ('win', 112, 5, 80, (48, 60, 46), (0, 5, 7, 0), True),
    ('loss', 76, 3, 76, (24, 42, 46), (0, 8, 0, 0), False),
]
RATE = 24000
FONT = Path(sys.argv[1] if len(sys.argv)>1 else '/usr/share/sounds/sf2/TimGM6mb.sf2')
OUT = Path(__file__).resolve().parents[2] / 'apps/client/src/assets/music'
LIB = c.CDLL('libfluidsynth.so.3')

def bind(name, result, *args):
    fn = getattr(LIB, name)
    fn.restype, fn.argtypes = result, args
    return fn

P, I, D, S = c.c_void_p, c.c_int, c.c_double, c.c_char_p
new_settings = bind('new_fluid_settings', P)
settings_num = bind('fluid_settings_setnum', I, P, S, D)
new_synth = bind('new_fluid_synth', P, P)
load = bind('fluid_synth_sfload', I, P, S, I)
program = bind('fluid_synth_program_change', I, P, I, I)
control = bind('fluid_synth_cc', I, P, I, I, I)
on = bind('fluid_synth_noteon', I, P, I, I, I)
off = bind('fluid_synth_noteoff', I, P, I, I)
write = bind('fluid_synth_write_s16', I, P, I, P, I, I, P, I, I)
destroy = bind('delete_fluid_synth', None, P)
delete_settings = bind('delete_fluid_settings', None, P)

def arrange(bars, root, changes, major, idx):
    rng = random.Random(30117 + idx)
    motifs = [[0,2,4,0,3,2,1,0],[2,4,5,4,2,3,1,0],[4,2,3,5,4,2,1,0],[0,4,2,5,4,3,2,0]]
    scale = (0,2,4,5,7,9,11) if major else (0,2,3,5,7,8,10)
    events = []
    def note(t, length, channel, key, velocity):
        t = max(0, t + rng.uniform(-.026,.026))
        events.extend(((t, channel, key, velocity), (t+length, channel, key, 0)))
    for bar in range(bars):
        pos = bar*4
        section = bar*6//bars
        root_note = root-36+changes[bar%len(changes)]
        chord = (0, 4 if major or changes[bar%len(changes)] in (3,8) else 3, 7)
        for j in range(4 if section in (0,4) else 8):
            note(pos+j*(1 if section in (0,4) else .5),.39 if j%2 else .69,0,root_note+12+chord[j%3],50+rng.randint(0,12))
        note(pos,1.7,1,root_note,46)
        if section not in (0,4):
            note(pos+2,.8,1,root_note+7,45)
        if section or bars<8:
            shape = motifs[(idx+section+bar//4)%len(motifs)]
            for j, offset in enumerate((0,.75,1.5,2.5,3.25) if section%2 else (.25,1.25,2,3.5)):
                degree = shape[(j+bar%4)%len(shape)]
                note(pos+offset,.28 if j%3==1 else .63,2,root_note+24+scale[degree],55+rng.randint(0,14))
    return sorted(events)

def render(track, idx):
    name,bpm,bars,root,patches,changes,major=track
    cfg=new_settings()
    settings_num(cfg,b'synth.sample-rate',RATE)
    settings_num(cfg,b'synth.gain',.76)
    synth=new_synth(cfg)
    if load(synth,str(FONT).encode(),1)<0:
        raise ValueError(FONT)
    for channel,patch in enumerate(patches):
        program(synth,channel,patch)
        control(synth,channel,10,(47,69,83)[channel])
        control(synth,channel,91,43)
    duration=bars*240/bpm+.8
    command=['ffmpeg','-loglevel','error','-y','-f','s16le','-ar',str(RATE),'-ac','2','-i','-',
             '-af',f'volume=8dB,alimiter=limit=0.86:level=false,afade=t=out:st={duration-.8}:d=0.8',
             '-c:a','libmp3lame','-b:a','48k',str(OUT/(name+'.mp3'))]
    data=(c.c_short*(4096*2))()
    with subprocess.Popen(command,stdin=subprocess.PIPE) as proc:
        frame=0
        def advance(target):
            nonlocal frame
            while frame<target:
                n=min(4096,target-frame)
                write(synth,n,data,0,2,data,1,2)
                proc.stdin.write(bytes(data)[:n*4])
                frame+=n
        for beat,channel,key,velocity in arrange(bars,root,changes,major,idx):
            advance(math.floor(beat*60/bpm*RATE))
            on(synth,channel,key,velocity) if velocity else off(synth,channel,key)
        advance(round(duration*RATE))
        proc.stdin.close()
        if proc.wait():
            raise RuntimeError(name)
    destroy(synth)
    delete_settings(cfg)
    print(name, round(duration,1), bpm, patches, flush=True)

if __name__=='__main__':
    OUT.mkdir(parents=True,exist_ok=True)
    for index,track in enumerate(TRACKS):
        render(track,index)
