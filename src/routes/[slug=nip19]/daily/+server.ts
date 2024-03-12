import 'websocket-polyfill';
import RSS from 'rss';
import { error, type RequestHandler } from '@sveltejs/kit';
import { nip19 } from 'nostr-tools';
import { type Content, type Event } from 'nostr-typedef';
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

	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const since = new Date();
	since.setDate(since.getDate() - 3);
	since.setHours(0, 0, 0, 0);
	const events = await fetcher.fetchAllEvents(
		relays,
		{ kinds: [1], authors: [pubkey] },
		{ since: Math.floor(since.getTime() / 1000), until: Math.floor(today.getTime() / 1000 - 1) },
		{ abortSignal: AbortSignal.timeout(4000) }
	);

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
	const map = new Map<string, Event[]>();
	for (const event of events) {
		const group = new Date(event.created_at * 1000).toDateString();
		const groupedEvents = map.get(group);
		if (groupedEvents === undefined) {
			map.set(group, [event]);
		} else {
			groupedEvents.push(event);
			map.set(group, groupedEvents);
		}
	}
	for (const [group, groupedEvents] of map) {
		console.log(group, groupedEvents);
		const date = new Date(group);
		feed.item({
			title: group,
			description: groupedEvents.map((event) => `<article>${event.content}</article>`).join(''),
			date,
			url: `https://nostter.app/${npub}/${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate()}`
		});
	}
	return new Response(feed.xml(), {
		headers: {
			'Content-Type': 'application/xml; charset=UTF-8'
		}
	});
};
