import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import Image from 'next/image';
import {describe,it,expect} from 'vitest';
import {normalizeReact19Markup} from './react19Markup';
const srcSet='/_next/image?url=%2Fhero.png&amp;w=480&amp;q=75 480w, /_next/image?url=%2Fhero.png&amp;w=960&amp;q=75 960w';
const old=`<main class="bg-gold"><form method="get" action="/fleet" class="filter"><input name="start" type="date" value="2030-01-01"/><img fetchpriority="high" class="hero" sizes="480px" srcSet="${srcSet}" src="/hero.png"/></form></main>`;
const preload=`<link rel="preload" as="image" imageSrcSet="${srcSet}" imageSizes="480px" fetchPriority="high"/>`;
const current=`${preload}<main class="bg-gold"><form class="filter" action="/fleet" method="get"><input type="date" name="start" value="2030-01-01"/><img class="hero" fetchPriority="high" sizes="480px" srcSet="${srcSet}" src="/hero.png"/></form></main>`;
describe('narrow React19 SSR serialization comparison',()=>{
 it('ignores only equivalent leading preload and form/input/img attribute ordering/casing',()=>expect(normalizeReact19Markup(current)).toBe(normalizeReact19Markup(old)));
 it('is idempotent and retains the exact image URLs, widths, descriptors and candidate order',()=>{
  const normalized=normalizeReact19Markup(current);expect(normalized).toContain(`srcSet="${srcSet}"`);expect(normalizeReact19Markup(normalized)).toBe(normalized);
 });
 it.each([
  ['class',current.replace('bg-gold','bg-gold/90')],
  ['image URL',current.replace(/%2Fhero/g,'%2Fchanged')],
  ['width',current.replace(/w=480/g,'w=481')],
  ['descriptor',current.replace(/480w/g,'481w')],
  ['candidate order',current.replaceAll(srcSet,srcSet.split(', ').reverse().join(', '))],
  ['priority removed',current.replace(' fetchPriority="high" sizes=',' sizes=')],
  ['priority lowered',current.replace(' fetchPriority="high" sizes=',' fetchPriority="low" sizes=')],
  ['input value',current.replace('2030-01-01','2030-01-02')],
  ['form destination',current.replace('/fleet','/changed')],
 ])('still reports planted %s edits',(_name,changed)=>expect(normalizeReact19Markup(changed)).not.toBe(normalizeReact19Markup(old)));
 it.each([
  preload.replace('w=480','w=481'),preload.replace('imageSizes="480px"','imageSizes="960px"'),preload.replace('fetchPriority="high"','fetchPriority="low"'),preload.replace('/>',' crossOrigin="anonymous"/>'),preload.replace('/>',' imageSizes="480px"/>'),
 ])('never discards a mismatched, extra-field or duplicate preload',changed=>expect(normalizeReact19Markup(changed+current.slice(preload.length))).not.toBe(normalizeReact19Markup(old)));
 it('does not silently deduplicate attributes or normalize unrelated element attribute order',()=>{
  for(const [a,b] of [['<img src="/a" src="/b"/>','<img src="/b" src="/a"/>'],['<div id="x" class="y"></div>','<div class="y" id="x"></div>']])expect(normalizeReact19Markup(a)).not.toBe(normalizeReact19Markup(b));
 });
 it('preserves boolean attributes and refuses to normalize malformed or single-quoted attribute text',()=>{
  expect(normalizeReact19Markup('<input name="a" disabled="" type="date"/>')).toContain('disabled=""');
  for(const html of ["<input name='a' type='date'/>",'<input name="a" =broken/>'])expect(normalizeReact19Markup(html)).toBe(html);
 });
 it('leaves scripts, templates, textareas and comments byte-exact and cannot match a phantom image there',()=>{
  for(const html of [`<script>const x='${current}';</script>`,`<template>${current}</template>`,`<textarea>${current}</textarea>`,`<!--${current}-->`])expect(normalizeReact19Markup(html)).toBe(html);
  expect(normalizeReact19Markup(preload+`<script>const x='${current.slice(preload.length)}';</script>`)).toContain(preload);
 });
 it('accepts actual Next15/React19 priority image markup only when explicit high priority is preserved',()=>{
  const html=renderToStaticMarkup(createElement(Image,{src:'/hero.png',alt:'Hero',fill:true,sizes:'480px',priority:true,fetchPriority:'high'}));
  expect(html).toMatch(/<link rel="preload"/);expect(html).toMatch(/<img[^>]*fetchPriority="high"/);
  expect(normalizeReact19Markup(html)).not.toMatch(/^<link/);expect(normalizeReact19Markup(html)).toContain('fetchpriority="high"');
 });
});
