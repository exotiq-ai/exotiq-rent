// MP-37 AC14: the operator note covers what an operator needs, and neither it nor any file this
// change adds carries private material. This repo is public, so the scan uses shapes only (token
// shapes, project-host shapes, key prefixes, addresses outside exotiq.ai) plus a short list of
// generic words for the note. Forbidden strings are assembled from fragments at run time so this
// file never contains one. Optional inputs:
//   MP37_BASE_REF=<ref>         also scan the commit messages since <ref>
//   MP37_PR_TEXTS=<a>:<b>       also scan these pull request text files
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROOT, exists, read, walkText } from './helpers';

const DOC = 'docs/rent/MAINTENANCE_WALL.md';
const ALLOWED_PATHS = ['middleware.wall.ts', 'app/[[...wall]]', 'next.config.js', 'package.json', DOC, 'domain/maintenance', 'scripts/maintenance', 'tests/maintenance', 'tests/polish/golden/census.base.json'];
const BASE_REF = process.env.MP37_BASE_REF ?? '';
const PR_TEXTS = (process.env.MP37_PR_TEXTS ?? '').split(':').filter(Boolean);
// The commit attribution trailer is the one address outside exotiq.ai a commit message may carry.
const TRAILER_ADDRESS = ['noreply', 'anthropic.com'].join('@');

const TOPICS: [string, RegExp[]][] = [
  ['what the wall is', [/maintenance wall/i, /\b503\b/, /Retry-After/]],
  ['the three variables', [/MAINTENANCE_MODE/, /MAINTENANCE_RETRY_AFTER/, /MAINTENANCE_BACK_BY/]],
  ['the variable rules', [/`on`, `true` or `1`/, /\b1800\b/, /\b60\b[^\n]*\b86400\b/, /60 characters/]],
  ['decided when a build is made', [/when (?:a|the) build is made/i, /built once/i]],
  ['the wall branch and its Deploy Preview', [/maintenance-wall/, /Deploy Preview/, /production context/i]],
  ['how to publish it', [/publish the wall deploy/i]],
  ['how to take it down', [/restore point/i, /publish the normal deploy/i, /unlock auto publishing/i]],
  ['how to check it', [/check-wall\.mjs \S+ --expect on/, /check-wall\.mjs \S+ --expect off/]],
  ['what it does not stop', [/already open/i, /canary/i, /availability-alerts/, /payment provider/i, /image/i, /trailing slash/i, /\b308\b/]],
  ['api links in e-mails', [/text\/html/, /JSON/]],
  ['outside monitors', [/monitor/i]],
  ['the build log is the record', [/build log's two lines are the record/i, /running site prints nothing/i]],
  ['what an off pass means', [/off pass means the wall is gone and the four core pages answer/i, /after each publish step/i]],
  ['the wall is per site', [/per Netlify site/i, /publish it on each site/i]],
  ['the variable must be in the build environment', [/build's environment/i, /env file/i]],
  ['which methods answer the wall', [/GET, HEAD, POST, PUT, PATCH, DELETE(,| and) OPTIONS/, /TRACE/, /over-long URL/i, /reach no application code/i]],
  ['image paths', [/every\s+page,\s+booking\s+step,\s+API\s+route,\s+static\s+file\s+and\s+platform\s+image\s+path\s+tried/i, /`next start`\s+server\s+handles\s+`\/_next\/image`\s+before\s+the\s+wall/]],
  ['the image optimizer is off', [/turns\s+the\s+image\s+optimizer\s+off/i, /allows\s+no\s+remote\s+image\s+source/i, /fetches\s+nothing/i]],
  ['the prefetch answer', [/`x-middleware-prefetch: 1`/, /an\s+empty\s+`\{\}`/]],
  ['only the icons come back as bytes', [/only\s+the\s+three\s+icon\s+files/i, /other\s+`public\/`\s+files\s+answered\s+the\s+wall/i]],
  ['on probes only at a wall or locally', [/only\s+at\s+a\s+deploy\s+that\s+is\s+meant\s+to\s+be\s+a\s+wall,\s+or\s+at\s+a\s+local\s+server/i]],
  ['a local server imitates a wall deploy', [/start\s+it\s+with\s+`MAINTENANCE_MODE=on`/i]],
  ['the Netlify exceptions', [/`x-nextjs-data: 1`/, /with\s+any\s+other\s+build\s+id\s+it\s+answers\s+Next's\s+own\s+404\s+page/i, /`\/\.netlify\/scripts\/cdp`/, /answers\s+200\s+on\s+every\s+deploy/i, /nothing\s+a\s+renter\s+can\s+use/i, /as\s+measured\s+at\s+rehearsal/i]],
  ['two layers', [/two\s+layers/i, /`app\/\[\[\.\.\.wall\]\]\/route\.wall\.ts`/, /holds\s+nothing\s+but\s+the\s+wall/i, /hand(?:s|ed)?\s+past\s+the\s+middleware/i]],
  ['what a wall build contains', [/no\s+page,\s+layout,\s+route\s+handler\s+or\s+metadata\s+route\s+of\s+the\s+real\s+app/i, /static\s+icon\s+files/i, /fixed\s+build\s+id\s+`maintenance-wall`/]],
  ['the tripwire checks the routes', [/still\s+contains\s+application\s+routes/i]],
  ['the checker probes data requests', [/data-request\s+probes/i]],
  ['an on pass needs the wall body', [/headers\s+say\s+wall,\s+body\s+is\s+not\s+the\s+wall/, /the\s+wall\s+page's\s+heading/i, /exact\s+wall\s+JSON/i]],
  ['wall builds fetch no fonts', [/a\s+wall\s+build\s+fetches\s+no\s+fonts/i]],
  ['font fetch at build time', [/fonts from Google/i, /failed\s+build\s+publishes\s+nothing/i]],
  ['trailing slash, server by server', [/plain\s+`next start`\s+server\s+a\s+trailing\s+slash\s+path\s+answers\s+a\s+308\s+first\s+and\s+then\s+the\s+wall/i, /on\s+Netlify\s+the\s+rehearsal\s+found\s+the\s+wall\s+answered\s+directly,\s+with\s+no\s+redirect\s+first/i]],
  ['an off pass and the backend', [/off\s+pass\s+does\s+not\s+prove\s+that\s+pages\s+which\s+need\s+the\s+backend\s+are\s+working/i, /storefront\s+line/i]],
];
// Claims the note must no longer make.
const RETIRED: [string, RegExp][] = [
  ['every method', /Every method too/],
  ['lines always agree', /they always agree/i],
  ['image cache guess', /may still answer from its own cache/i],
  ['every path on Netlify', /every path tried/i],
  ['Next data requests walled without exception', /static\s+files\s+and\s+Next\s+data\s+requests\./],
  ['the old data-request answer', /answers\s+404\s+with\s+the\s+site's\s+not-found\s+page/i],
  ['the old unreachable claim', /no\s+booking,\s+payment\s+or\s+form\s+route\s+can\s+be\s+reached/i],
  ['fonts fail any build', /fails\s+a\s+build,\s+wall\s+or\s+not/i],
  ['public files come back as bytes', /a\s+request\s+a\s+host\s+hands\s+straight\s+to\s+the\s+app\s+gets\s+the\s+file\s+itself/i],
  ['every image path walled', /static\s+file\s+and\s+image\s+path\s+tried\s+answered/i],
  ['308 stated as general', /A trailing slash path such as `\/exotiq\/` first answers a 308|The 308 redirect on trailing slash paths: it happens before the wall/],
];
const retiredProblems = (doc: string) => RETIRED.filter(([, re]) => re.test(doc)).map(([name]) => `still says: ${name}`);

function topicProblems(doc: string): string[] {
  return TOPICS.flatMap(([name, res]) => res.filter((re) => !re.test(doc)).map((re) => `${name}: missing ${re}`));
}

const JWT = new RegExp(['ey', 'J[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}'].join(''));
const PROJECT_HOST = new RegExp(['\\b[a-z]{20}\\.', 'supa', 'base\\.co\\b'].join(''));
const KEY_PREFIX = new RegExp(['\\b(?:s', 'k|p', 'k)_[A-Za-z0-9]|\\bwh', 'sec_'].join(''));
const ADDRESS = /[A-Za-z0-9._%+-]+@((?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,})/g;
const DOC_WORDS = [['run', ' sheet'], ['free', 'ze'], ['cut', 'over'], ['Lov', 'able'], ['secur', 'ity']].map((f) => f.join(''));

function shapeProblems(name: string, text: string, allowAddress: string[] = []): string[] {
  const p: string[] = [];
  if (JWT.test(text)) p.push(`${name}: token-shaped string`);
  if (PROJECT_HOST.test(text)) p.push(`${name}: project host`);
  if (KEY_PREFIX.test(text)) p.push(`${name}: key prefix`);
  for (const m of Array.from(text.matchAll(ADDRESS))) {
    if (m[1].toLowerCase() !== 'exotiq.ai' && !allowAddress.includes(m[0])) p.push(`${name}: address at ${m[1]}`);
  }
  return p;
}
const wordProblems = (name: string, text: string) => DOC_WORDS.filter((w) => text.toLowerCase().includes(w.toLowerCase())).map((w) => `${name}: says ${w}`);

describe('MP-37 the operator note', () => {
  it('the operator note covers the agreed topics', () => {
    expect(exists(DOC)).toBe(true);
    const doc = read(DOC);
    // Planted: a note without the canary sentence is reported.
    expect(topicProblems(doc.replace(/canary/gi, 'check'))).toEqual(['what it does not stop: missing /canary/i']);
    expect(topicProblems(doc)).toEqual([]);
    expect(retiredProblems(`${doc}\nEvery method too.`)).toEqual(['still says: every method']);
    expect(retiredProblems(doc)).toEqual([]);
  });

  it('the operator note and every added file carry no private material', () => {
    // Planted, each assembled here so no file holds it whole.
    const jwt = ['ey', 'JhbGciOiJIUzI1NiJ9', '.', 'eyJzdWIiOiJwbGFudGVkIn0', '.', 'c2lnbmF0dXJlcGxhbnRlZA'].join('');
    const host = ['abcdefghijklmnopqrst', '.supa', 'base.co'].join('');
    const key = ['s', 'k_live_', 'planted'].join('');
    const addr = ['someone', 'example.com'].join('@');
    expect(shapeProblems('planted', `a ${jwt} b`)).toEqual(['planted: token-shaped string']);
    expect(shapeProblems('planted', `https://${host}/rest`)).toEqual(['planted: project host']);
    expect(shapeProblems('planted', key)).toEqual(['planted: key prefix']);
    expect(shapeProblems('planted', `write to ${addr}`)).toEqual(['planted: address at example.com']);
    expect(wordProblems('planted', `the ${DOC_WORDS[2]} night`)).toEqual([`planted: says ${DOC_WORDS[2]}`]);
    expect(shapeProblems('ok', 'write to support@exotiq.ai; images from *.supabase.co')).toEqual([]);

    const added = walkText(ALLOWED_PATHS, /./);
    expect(added).toContain(DOC);
    expect(added).toContain('domain/maintenance/wall.ts');
    const problems = added.flatMap((f) => shapeProblems(f, read(f)));
    problems.push(...wordProblems(DOC, read(DOC)));
    for (const f of PR_TEXTS) {
      problems.push(...shapeProblems(f, readFileSync(f, 'utf8')));
      problems.push(...wordProblems(f, readFileSync(f, 'utf8')));
    }
    if (BASE_REF) {
      const log = execFileSync('git', ['log', `${BASE_REF}..HEAD`, '--format=%B'], { cwd: ROOT, encoding: 'utf8' });
      problems.push(...shapeProblems('commit messages', log, [TRAILER_ADDRESS]));
      problems.push(...wordProblems('commit messages', log));
    }
    expect(problems).toEqual([]);
    console.log(`scanned ${added.length} added files${PR_TEXTS.length ? `, ${PR_TEXTS.length} PR texts` : ''}${BASE_REF ? `, commit messages since ${BASE_REF}` : ''}`);
  });
});
