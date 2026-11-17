import json, subprocess, hashlib, re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg
P=Path(__file__).resolve().parents[1];O=P/'output';Q=P/'qa';ff=imageio_ffmpeg.get_ffmpeg_exe()
scenes=json.loads((P/'scenes.json').read_text());duration=sum(s['seconds'] for s in scenes)
video=O/'PDFuck-2.1.21-promo.mp4';gif=O/'PDFuck-2.1.21-promo.gif'
reader=imageio_ffmpeg.read_frames(str(video));meta=next(reader);reader.close()
assert meta['size']==(1920,1080),meta
assert meta['fps']==30,meta
assert abs(meta['duration']-duration)<.1,meta
assert meta['audio_codec']!='',meta
result=subprocess.run([ff,'-hide_banner','-v','error','-i',str(video),'-progress','pipe:1','-f','null','-'],capture_output=True,text=True,check=True)
assert not result.stderr,result.stderr
frames=int(re.findall(r'^frame=(\d+)',result.stdout,re.M)[-1]);assert frames==duration*30,frames
with Image.open(gif) as im:
 assert im.size==(960,540);assert im.info.get('loop')==0
 n=im.n_frames;total=0
 for i in range(n):im.seek(i);im.load();total+=im.info.get('duration',0)
 assert abs(total/1000-duration)<.11,(total,duration)
assert len(list(O.glob('*.mp4')))==1 and len(list(O.glob('*.gif')))==1
ends=[];time=0
for s in scenes:time+=s['seconds'];ends.append(round((time-.5)*30))
expr='+'.join(f'eq(n,{n})' for n in ends)
subprocess.run([ff,'-y','-v','error','-i',str(video),'-vf',f'select={expr.replace(",",chr(92)+",")},scale=640:360','-fps_mode','vfr',str(Q/'encoded-%02d.png')],check=True)
contact=Image.new('RGB',(1920,1560),'#0c192b');d=ImageDraw.Draw(contact)
f=ImageFont.truetype('/System/Library/Fonts/STHeiti Light.ttc',18)
for i,s in enumerate(scenes):
 im=Image.open(Q/f'encoded-{i+1:02}.png');x=i%3*640;y=i//3*390;contact.paste(im,(x,y));d.text((x+12,y+362),f'{i+1:02} / {s["id"]}',font=f,fill='white')
contact.save(Q/'encoded-storyboard.jpg',quality=92)
report={'status':'passed','durationSeconds':duration,'video':{'size':list(meta['size']),'fps':meta['fps'],'framesDecoded':frames,'audioCodec':meta['audio_codec'],'fullDecodeErrors':0},'gif':{'size':[960,540],'frames':n,'durationSeconds':total/1000,'loop':0},'outputs':{p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [video,gif,O/'cover.png']},'visualReview':'See VALIDATION.md; encoded storyboard extracted from final MP4.'}
(Q/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
