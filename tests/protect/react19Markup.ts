interface Attribute {name:string;value:string|undefined;}
/** Comparison-only: preserve values verbatim, including escaped image URLs and
 * every srcSet candidate. Malformed/duplicate attributes are never normalized. */
function attributes(source:string):Attribute[]|null {
 const token=/\s+([A-Za-z_:][A-Za-z0-9_:.-]*)(?:="([^"]*)")?/gy;
 const result:Attribute[]=[],seen=new Set<string>();let index=0;
 while(index<source.length){
  if(/^\s*$/.test(source.slice(index)))break;
  token.lastIndex=index;const match=token.exec(source);if(!match)return null;
  const name=match[1],folded=name.toLowerCase();if(seen.has(folded))return null;
  seen.add(folded);result.push({name:folded==='fetchpriority'?'fetchpriority':name,value:match[2]});index=token.lastIndex;
 }
 return result;
}
// Raw text/template/comment content must remain byte-for-byte protected.
const tokens=()=>/<!--[\s\S]*?-->|<(script|style|textarea|template)\b[^>]*>[\s\S]*?<\/\1>|<(?:form|input|img)\b[^>]*>/g;
function parsedTag(token:string){const match=/^<(form|input|img|link)(\s[^>]*?)(\/?)>$/.exec(token);if(!match)return null;const attrs=attributes(match[2]);return attrs?{tag:match[1],attrs,selfClosing:match[3]}:null;}
const field=(attrs:Attribute[],name:string)=>attrs.find(a=>a.name.toLowerCase()===name.toLowerCase())?.value;
export function normalizeReact19Markup(input:string):string {
 let html=input;
 const preload=/^<link\b[^>]*\/>/.exec(html)?.[0];
 if(preload){
  const parsed=parsedTag(preload),allowed=new Set(['rel','as','imagesrcset','imagesizes','fetchpriority']);
  if(parsed&&parsed.attrs.every(a=>allowed.has(a.name.toLowerCase()))&&field(parsed.attrs,'rel')==='preload'&&field(parsed.attrs,'as')==='image'&&field(parsed.attrs,'imageSrcSet')&&field(parsed.attrs,'imageSizes')&&(field(parsed.attrs,'fetchPriority')===undefined||field(parsed.attrs,'fetchPriority')==='high')){
   const matches=[...html.matchAll(tokens())].some(([token])=>{
    const image=parsedTag(token);return image?.tag==='img'&&field(image.attrs,'fetchpriority')==='high'&&field(image.attrs,'srcSet')===field(parsed.attrs,'imageSrcSet')&&field(image.attrs,'sizes')===field(parsed.attrs,'imageSizes');
   });
   if(matches)html=html.slice(preload.length);
  }
 }
 return html.replace(tokens(),token=>{
  const parsed=parsedTag(token);if(!parsed||parsed.tag==='link')return token;
  const attrs=[...parsed.attrs].sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0).map(a=>a.name+(a.value===undefined?'':`="${a.value}"`)).join(' ');
  return `<${parsed.tag} ${attrs}${parsed.selfClosing}>`;
 });
}
