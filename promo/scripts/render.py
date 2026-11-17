"""Render captured Electron actions into a deterministic editorial promo."""
import json, math, subprocess, wave, bisect, sys
from pathlib import Path
from functools import lru_cache
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg
P=Path(__file__).resolve().parents[1]; O=P/'output';Q=P/'qa';O.mkdir(exist_ok=True)
LANG='en' if '--en' in sys.argv else 'zh'
Q=Q/LANG;Q.mkdir(exist_ok=True);CAP=P/'captures'/LANG
STEM=f'PDFuck-promo-{LANG}'
W,H,FPS=1920,1080,30
SCENES=json.loads((P/('scenes.en.json' if LANG=='en' else 'scenes.json')).read_text()); DURATION=sum(s['seconds'] for s in SCENES)
FF=imageio_ffmpeg.get_ffmpeg_exe()
FONT='/System/Library/Fonts/STHeiti Medium.ttc'; REG='/System/Library/Fonts/STHeiti Light.ttc'
if LANG=='en':
 FONT='/System/Library/Fonts/Supplemental/Arial Bold.ttf';REG='/System/Library/Fonts/Supplemental/Arial.ttf'
@lru_cache(None)
def font(size,bold=False):return ImageFont.truetype(FONT if bold else REG,size)
# A restrained navy gradient; all captions stay outside the app viewport.
y,x=np.mgrid[0:H,0:W]; glow=np.exp(-((x-1390)**2+(y-360)**2)/(1000**2))
bg=np.stack([10+8*glow,19+20*glow,36+23*glow],axis=-1).astype('uint8');BG=Image.fromarray(bg)
ICON=Image.open(P.parent/'resources/icon.png').convert('RGBA');ICON.thumbnail((60,60))
LOG={v['name']:v for v in json.loads((Q/'capture-log.json').read_text())}
MOTION=json.loads((Q/'motion.json').read_text());MT=[v['time'] for v in MOTION]
# The original resolution is 2880x1920. Capture all media in normalized coordinates.
def focus_box(box):
 x1,y1,x2,y2=box;cx=(x1+x2)/2;cy=(y1+y2)/2
 width=max(x2-x1,(y2-y1)*1.5)*1.08;width=min(2880,width);height=width/1.5
 x1=max(0,min(2880-width,cx-width/2));y1=max(0,min(1920-height,cy-height/2))
 return (x1,y1,x1+width,y1+height)
def ease(t):t=max(0,min(1,t));return t*t*(3-2*t)
def txt(d,xy,text,size,color='#f4f8ff',bold=False,maxwidth=None):
 f=font(size,bold);b=d.textbbox(xy,text,font=f)
 assert b[0]>=0 and b[2]<=W and b[3]<=H,(text,b)
 if maxwidth:assert d.textlength(text,font=f)<=maxwidth,(text,'overflow')
 d.text(xy,text,font=f,fill=color)
STATIC=[]
for i,s in enumerate(SCENES):
 im=BG.copy();d=ImageDraw.Draw(im);im.paste(ICON,(64,44),ICON)
 txt(d,(140,50),'PDFuck',40,bold=True)
 txt(d,(600,67),s['chapter'],24,'#a5bcce')
 txt(d,(1770,68),f'{i+1:02d} / {len(SCENES):02d}',20,'#a5bcce')
 d.line((64,126,1856,126),fill='#294053',width=1)
 txt(d,(64,227),s['tag'],26,'#64dec7',True,maxwidth=490)
 for k,line in enumerate(s['title']):txt(d,(62,301+k*83),line,52 if LANG=='en' else 62,bold=True,maxwidth=496)
 base=332+len(s['title'])*83
 d.line((64,base,130,base),fill='#64dec7',width=4)
 for k,line in enumerate(s['body']):txt(d,(64,base+35+k*45),line,28,'#b9cbda',maxwidth=495)
 if s['id']=='outro':
  d.rounded_rectangle((64,829,490,903),18,fill='#64dec7');txt(d,(105,848),'Try PDFuck' if LANG=='en' else '欢迎下载试用',32,'#102d35',True)
 else:txt(d,(64,900),'READ  /  REVIEW  /  REVISE',19,'#68879d')
 # frame and fixed safe footer
 d.rounded_rectangle((594,148,1866,1000),18,fill='#30465a')
 txt(d,(64,1030),s['foot'],22,'#b9cbda',maxwidth=1792)
 STATIC.append(im)
@lru_cache(maxsize=40)
def read_image(path):return Image.open(path).convert('RGB')
def screen(s,t):
 # Replay the real final 1.4 seconds leading into each captured state, then hold.
 endpoint=LOG[s['shot']]['time'];span=0 if s['id'] in ['intro','outro'] else 1400
 if t<1.4 and span:
  stamp=max(0,endpoint-span)+t/1.4*min(span,endpoint)
  idx=max(0,bisect.bisect_right(MT,stamp)-1)
  img=read_image(str(CAP/'motion'/MOTION[idx]['file']))
 else:img=read_image(str(CAP/(s['shot']+'.png')))
 rect=(0,0,2880,1920)
 if s.get('focus'):
  goal=focus_box(s['focus']);z=ease((t-1.5)/1.2)
  rect=tuple(a+(b-a)*z for a,b in zip(rect,goal))
 scale=img.width/2880;rect=tuple(v*scale for v in rect)
 return img.resize((1260,840),Image.Resampling.LANCZOS,box=rect)
def frame(index,t,global_t):
 im=STATIC[index].copy();im.paste(screen(SCENES[index],t),(600,154))
 d=ImageDraw.Draw(im);d.rectangle((0,1075,int(W*global_t/DURATION),1079),fill='#64dec7')
 return im

def music():
 sr=44100;n=int(DURATION*sr);out=np.zeros(n,dtype=np.float64)
 # Original, procedural pentatonic ambient bed; no third-party recording.
 for beat in np.arange(0,DURATION,0.75):
  notes=[60,64,67,71,67,64,62,67];note=notes[int(beat/0.75)%len(notes)]
  dur=min(2.8,DURATION-beat);t=np.arange(int(dur*sr))/sr;freq=440*2**((note-69)/12)
  env=(1-np.exp(-t*24))*np.exp(-t*2.1)
  sig=(np.sin(2*np.pi*freq*t)+0.23*np.sin(2*np.pi*2*freq*t))*env*0.035
  start=int(beat*sr);out[start:start+len(sig)]+=sig
 fade=np.minimum(1,np.arange(n)/(sr*2))*np.minimum(1,(n-np.arange(n))/(sr*3));out*=fade
 stereo=np.stack([out,out*.94],axis=1);pcm=(np.clip(stereo,-1,1)*32767).astype('<i2')
 with wave.open(str(P/'assets/music.wav'),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes(pcm.tobytes())
 return float(np.max(np.abs(stereo)))
def timestamp(seconds):
 ms=round(seconds*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
# Preview and subtitle assets are produced even for --preview.
thumbs=[];current=0;srt=[]
for i,s in enumerate(SCENES):
 im=frame(i,s['seconds']-.5,current+s['seconds']-.5);im.save(Q/f'{i+1:02}-{s["id"]}.png');thumbs.append(im.resize((640,360)))
 srt.append(f'{i+1}\n{timestamp(current)} --> {timestamp(current+s["seconds"])}\n'+(' ' if LANG=='en' else '').join(s['title'])+'\n'+(' / ' if LANG=='en' else '；').join(s['body'])+'\n');current+=s['seconds']
(O/f'promo.{LANG}.srt').write_text('\n'.join(srt))
cover=frame(0,4,0);cover.save(O/f'cover-{LANG}.png')
contact=Image.new('RGB',(1920,4*390),'#0c192b');d=ImageDraw.Draw(contact)
for i,im in enumerate(thumbs):x=i%3*640;y=i//3*390;contact.paste(im,(x,y));d.text((x+12,y+362),f'{i+1:02} / {SCENES[i]["id"]}',font=font(18),fill='#c6d5e3')
contact.save(Q/'storyboard.jpg',quality=92)
if '--preview' in sys.argv:print('Preview ready');sys.exit()
peak=music();output=O/f'{STEM}.mp4'
cmd=[FF,'-y','-hide_banner','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s','1920x1080','-r',str(FPS),'-i','-','-i',str(P/'assets/music.wav'),'-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart','-shortest',str(output)]
proc=subprocess.Popen(cmd,stdin=subprocess.PIPE);elapsed=0;last=None
try:
 for i,s in enumerate(SCENES):
  for j in range(s['seconds']*FPS):
   t=j/FPS;im=frame(i,t,elapsed+t)
   if last is not None and t<.33:im=Image.blend(last,im,ease(t/.33))
   proc.stdin.write(im.tobytes())
  last=frame(i,s['seconds']-.01,elapsed+s['seconds']);elapsed+=s['seconds'];print('Rendered',s['id'],flush=True)
finally:proc.stdin.close()
assert proc.wait()==0,'MP4 encoding failed'
# Palette generation / use in one graph avoids an extra deliverable GIF palette.
subprocess.run([FF,'-y','-hide_banner','-loglevel','error','-i',str(output),'-filter_complex','fps=10,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff:max_colors=192[p];[b][p]paletteuse=dither=bayer:bayer_scale=3','-loop','0',str(O/f'{STEM}.gif')],check=True)
# Keep the lightweight web variant strictly under decimal 2 MB.
small=O/f'{STEM}-small.gif'
for width,fps,colors in [(640,3,64),(640,2,64),(600,2,48),(560,2,48)]:
 graph=f'fps={fps},scale={width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors={colors}:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle'
 subprocess.run([FF,'-y','-v','error','-i',str(output),'-filter_complex',graph,'-loop','0',str(small)],check=True)
 if small.stat().st_size<2_000_000:break
assert small.stat().st_size<2_000_000
(Q/'compression.json').write_text(json.dumps({'width':width,'fps':fps,'colors':colors,'bytes':small.stat().st_size},indent=2))
(Q/'render.json').write_text(json.dumps({'width':W,'height':H,'fps':FPS,'seconds':DURATION,'frames':DURATION*FPS,'scenes':len(SCENES),'audioPeak':peak,'renderer':'Pillow + FFmpeg','capture':'Electron CDP screencast + lossless stills','gifWidth':960,'gifFps':10},indent=2))
print('Rendered MP4 and GIF',flush=True)
