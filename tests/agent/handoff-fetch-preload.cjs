// TEST ONLY: production-host-shaped HTTPS names are mapped to one owned loopback
// fixture. Every other server fetch is refused; no provider or Supabase network.
const nativeFetch=globalThis.fetch;
globalThis.fetch=(input,init)=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
 if(!['identity.synthetic.invalid','api.synthetic.invalid'].includes(url.hostname))throw new Error('Offline handoff harness rejected external network');
 url.protocol='https:';url.hostname='127.0.0.1';url.port='9443';return nativeFetch(url,init);
};
