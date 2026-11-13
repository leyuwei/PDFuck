const fs=require('fs'),path=require('path'),assert=require('assert/strict'),Module=require('module'),{buildSync}=require('esbuild')
const root=path.resolve(__dirname,'../..'),m=new Module(__filename,module);m._compile(buildSync({entryPoints:[path.join(root,'src/main/grammar.ts')],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text,__filename)
const {LocalGrammarEngine,validGrammarRequest,grammarResponse}=m.exports
const cases=[
 ['en','These is an important result. We has tested the method carefully.','These are important results. We have tested the method carefully.'],
 ['de','Das ist ein gute Idee. Wir überprüft die Ergebnisse gründlich.','Das ist eine gute Idee. Wir überprüfen die Ergebnisse gründlich.'],
 ['fr','Il sont très heureux. Nous a terminé le travail.','Ils sont très heureux. Nous avons terminé le travail.'],
 ['es','Nosotros tiene una casa grande. Ellos es muy inteligentes.','Nosotros tenemos una casa grande. Ellos son muy inteligentes.'],
 ['pt','Nós tem uma casa grande. Eles é muito felizes.','Nós temos uma casa grande. Eles são muito felizes.'],
 ['ru','Она красивый девушка. Он читать книгу каждый день.','Она красивая девушка. Он читает книгу каждый день.'],
 ['zh','我们应该削减不必要的开消。','我们应该削减不必要的开销。'],
 ['ja','私は千葉で住む。','私は千葉に住む。'],
 ['ar','هذا هذا اختبار مهم. نحن يذهب إلى المدرسة.','هذا اختبار مهم. نحن نذهب إلى المدرسة.']
]
async function main(){const engine=new LocalGrammarEngine(path.join(root,`resources/grammar/tmp/${process.platform==='darwin'?'mac':process.platform==='win32'?'win':'linux'}-${process.arch}`)),records=[],requests=[],originalFetch=global.fetch;global.fetch=async(url,...rest)=>{assert.match(String(url),/^http:\/\/127\.0\.0\.1:\d+\/v2\/(?:languages|check)$/);requests.push(String(url));const r=await originalFetch(url,...rest);if(!r.ok)console.error(r.status,await r.clone().text());return r}
 try{for(const [language,incorrect,correct]of cases){const bad=await engine.check({text:incorrect,language}),good=await engine.check({text:correct,language});assert.ok(bad.matches.length>0,language+' must detect a real error');assert.equal(good.matches.length,0,language+' correct sentence: '+JSON.stringify(good.matches));for(const match of bad.matches){assert.ok(match.offset>=0&&match.offset+match.length<=incorrect.length);assert.ok(incorrect.slice(match.offset,match.offset+match.length).trim());assert.ok(match.message)}records.push({language,positiveRules:bad.matches.map(m=>m.ruleId),negativeCount:good.matches.length});console.log(language,'passed')}
 const science='The proposed method maintains a positive service margin. The results demonstrate the effectiveness of deadline-aware trajectory optimization. Radio Access Network (RAN) connects devices. The result is tested and the input was received.';const good=await engine.check({text:science});assert.equal(good.matches.length,0,JSON.stringify(good.matches));assert.match(good.language,/en/)
 assert.equal(validGrammarRequest({text:'a',language:'http://evil'}),false);assert.equal(validGrammarRequest({text:'a'.repeat(20001)}),false);assert.equal(validGrammarRequest({text:'a',language:42}),false)
 assert.throws(()=>grammarResponse({warnings:{incompleteResults:true},language:{code:'en'},matches:[]},'abc'),/grammar.checkFailed/);
 const sample={language:{code:'en'},matches:[{offset:0,length:3,message:'spelling',rule:{id:'MORFOLOGIK_RULE_EN_US',issueType:'misspelling'},replacements:[]},{offset:-1,length:3,message:'bad',rule:{id:'GRAMMAR'}},{offset:0,length:3,message:'style',rule:{id:'STYLE',category:{id:'STYLE'}}}]};assert.equal(grammarResponse(sample,'abc').matches.length,0)
 fs.writeFileSync(path.join(root,'tests/output/release-2.1.17/grammar-engine.json'),JSON.stringify({sourceOnly:true,engine:'LanguageTool 6.6',records,scienceNegative:true,loopbackOnly:requests.every(u=>u.startsWith('http://127.0.0.1:')),checks:24},null,2))
 }finally{engine.stop();global.fetch=originalFetch}console.log('offline grammar passed')}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});module.exports={LocalGrammarEngine,validGrammarRequest,grammarResponse}
