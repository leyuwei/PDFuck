from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
P=Path(__file__).resolve().parents[1]/'assets/Demo.pdf'
c=canvas.Canvas(str(P),pagesize=(720,900))
c.setTitle('Reading research, without losing context')
def text(x,y,s,size=12,font='Helvetica',color='#334155'):
 c.setFillColor(HexColor(color));c.setFont(font,size);c.drawString(x,y,s)
def base(n):
 text(52,858,'RESEARCH NOTES   /   PDFuck DEMO',10,color='#089183')
 c.setStrokeColor(HexColor('#dbe4ec'));c.line(52,842,668,842)
 text(52,32,'Synthetic demonstration document - no experimental claims',9,color='#64748b');text(650,32,str(n),9)
base(1)
text(52,802,'Reading research,',30,'Helvetica-Bold','#12243b')
text(52,765,'without losing context',30,'Helvetica-Bold','#12243b')
text(52,726,'A workflow for clear annotations and connected evidence',13)
text(52,682,'Abstract',16,'Helvetica-Bold')
for i,s in enumerate(['Scientific reading connects claims, figures and earlier work.','Retrieval-Augmented Generation (RAG) combines retrieval with generation.','We describe a reading workflow that keeps this context close to the reader.','The example values below are synthetic and are used for demonstration.']):text(52,656-i*21,s)
text(52,548,'1. A connected reading workflow',16,'Helvetica-Bold')
for i,s in enumerate(['Figure 1 illustrates the stages of a document review workflow.','RAG can help readers connect a question to relevant source passages [1].','A clear revision should state its evidence and scope before its conclusion.']):text(52,522-i*21,s)
# original vector figure
for x,label,sub in [(64,'READ','Find the context'),(270,'REVIEW','Ask better questions'),(476,'REVISE','Make changes clear')]:
 c.setFillColor(HexColor('#edf8f6'));c.setStrokeColor(HexColor('#9cd7cf'));c.roundRect(x,306,178,118,12,fill=1,stroke=1)
 text(x+16,383,label,15,'Helvetica-Bold','#087e74');text(x+16,350,sub,11)
for x in [244,450]:
 c.setStrokeColor(HexColor('#089183'));c.setLineWidth(2);c.line(x,365,x+22,365);c.line(x+17,370,x+22,365);c.line(x+17,360,x+22,365)
text(64,278,'Figure 1. Read, review and revise with source context.',12,'Helvetica-Bold')
text(52,227,'2. Evidence before conclusions',16,'Helvetica-Bold')
for i,s in enumerate(['The proposed method always improves accuracy in every setting.','This claim needs a defined baseline, an evaluation protocol and uncertainty.','Table 1 provides an example of how to make the comparison explicit.']):text(52,201-i*21,s)
c.showPage();base(2)
text(52,798,'3. Evaluation at a glance',24,'Helvetica-Bold','#12243b')
text(52,755,'Table 1. Synthetic workflow comparison (illustration only).',12,'Helvetica-Bold')
rows=[['Workflow','Context available','Revision status'],['Separate tools','Manual lookup','Scattered notes'],['Connected reading','Source-linked','Tracked in document']]
for r,row in enumerate(rows):
 y=705-r*48;c.setFillColor(HexColor('#e8f5f2' if r==0 else '#f4f7fa'));c.rect(52,y-16,616,46,fill=1,stroke=0)
 for x,s in zip([66,270,468],row):text(x,y,s,12,'Helvetica-Bold' if r==0 else 'Helvetica')
text(52,500,'Abbreviations',18,'Helvetica-Bold')
text(52,466,'RAG: Retrieval-Augmented Generation',13)
text(52,380,'References',18,'Helvetica-Bold')
text(52,344,'[1] Lewis, P. et al. Retrieval-Augmented Generation for',12)
text(70,324,'Knowledge-Intensive NLP Tasks. NeurIPS, 2020.',12)
text(52,240,'Reviewer note',15,'Helvetica-Bold','#087e74')
text(52,210,'Clarify the baseline and qualify the claim on page 1.',12)
c.save()
print(P)
