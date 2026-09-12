import type { APIRoute } from 'astro';
import { createOgImage } from '../../../../lib/og';
import { getPosts, type Post } from '../../../../lib/posts';

export const prerender = true;

export async function getStaticPaths() {
	return (await getPosts()).map((post) => ({ params: { slug: post.slug }, props: { post } }));
}

export const GET: APIRoute = ({ props }) => {
	return createOgImage((props as { post: Post }).post, 'zh-TW');
};
