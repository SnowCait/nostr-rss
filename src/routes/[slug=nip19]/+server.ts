import 'websocket-polyfill';
import RSS from 'rss';
import { error, type RequestHandler } from '@sveltejs/kit';
import { nip19 } from 'nostr-tools';
import { type Content } from 'nostr-typedef';
import { NostrFetcher } from 'nostr-fetch';
import { defaultRelays } from '$lib/config';

export const GET: RequestHandler = async ({ params }) => {
	const npub = params.slug;
	if (npub === undefined) {
		error(404);
	}
	const { type, data } = nip19.decode(npub);
	if (type !== 'npub' && type !== 'nprofile') {
		error(404);
	}

	const pubkey = type === 'npub' ? data : data.pubkey;
	const relays = type === 'npub' ? [] : data.relays ?? [];
	if (relays.length === 0) {
		relays.push(...defaultRelays);
	}
	const fetcher = NostrFetcher.init();
	const event = await fetcher.fetchLastEvent(relays, { kinds: [0], authors: [pubkey] });
	let metadata: Content.Metadata | undefined;
	if (event !== undefined) {
		try {
			metadata = JSON.parse(event.content);
		} catch (error) {
			console.warn('[failed to parse metadata]', error, event);
		}
	}
	const events = await fetcher.fetchLatestEvents(relays, { kinds: [1], authors: [pubkey] }, 50);

	const name = metadata?.display_name
		? metadata.display_name
		: metadata?.name
			? metadata.name
			: npub;
	const feed = new RSS({
		title: name,
		site_url: `https://nostter.app/${npub}`,
		feed_url: `https://rss.nostter.app/${npub}`
	});
	for (const event of events) {
		console.log(event);
		feed.item({
			title: event.content.split('\n')[0],
			description: event.content,
			date: new Date(event.created_at * 1000),
			url: `https://nostter.app/${nip19.neventEncode({ id: event.id })}`
		});
	}
	return new Response(feed.xml(), {
		headers: {
			'Content-Type': 'application/xml; charset=UTF-8'
		}
	});
};
