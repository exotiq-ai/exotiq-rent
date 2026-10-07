import {it,expect} from 'vitest';
import {createRequire} from 'node:module';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const rootRequire=createRequire(import.meta.url),nextRequire=createRequire(rootRequire.resolve('next/package.json'));
it('the actual Next PostCSS dependency refuses an out-of-tree source map without a from option',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'exotiq-owned-postcss-')),map=join(directory,'synthetic.map'),marker='SYNTHETIC-OWNED-SOURCE-MAP-ONLY';
 writeFileSync(map,JSON.stringify({version:3,sources:['synthetic.css'],names:[],mappings:'',sourcesContent:[marker]}));
 try{const postcss=nextRequire('postcss');const result=await postcss([]).process('a{color:red}\n/*# sourceMappingURL='+map+' */',{map:true});expect(JSON.stringify(result.map?.toJSON())??'').not.toContain(marker);}finally{rmSync(directory,{recursive:true,force:true});}
});
