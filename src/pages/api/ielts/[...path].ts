import type { APIRoute } from 'astro';
export const prerender = false;
export const ALL: APIRoute = () => new Response(JSON.stringify({error:'site_moved',url:'https://lenteyielts.cn'}),{status:410,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Robots-Tag':'noindex'}});
