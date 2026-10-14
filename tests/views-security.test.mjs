import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

test('unknown or unpublished articles cannot create Redis view or deduplication keys',async()=>{
 const source=readFileSync(new URL('../src/pages/api/views/[slug].ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replaceAll('import.meta.env.PROD','true');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 let calls=0;const exports={},upstream=async()=>{calls++;throw Error('unexpected Redis access');};
 vm.runInNewContext(code,{exports,Response,URL,getPostBySlug:async()=>undefined,redis:upstream,withinRateLimit:upstream,claimDailyView:upstream});
 const request=new Request('https://www.lenteyyy.com/api/views/attacker-key?increment=1',{headers:{referer:'https://www.lenteyyy.com/posts/attacker-key'}});
 const response=await exports.GET({params:{slug:'attacker-key'},request});assert.equal(response.status,404);assert.deepEqual(await response.json(),{error:'not_found'});assert.equal(calls,0);
});
