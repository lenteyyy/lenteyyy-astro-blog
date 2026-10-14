import type {APIRoute} from 'astro';
export const prerender = false;
export const GET:APIRoute=({url,params})=>{const target=new URL('https://lenteyielts.cn');const route=params.path||'';target.pathname='/'+route;target.search=url.search;return new Response(null,{status:308,headers:{Location:target.toString(),'Cache-Control':'public, max-age=3600'}});};
