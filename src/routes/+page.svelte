<script lang="ts">
	import { goto } from '$app/navigation';

	let npub = '';

	async function navigate() {
		console.log(npub);
		await goto(`/${npub}`);
	}
</script>

<h1>Nostr RSS</h1>

<form on:submit|preventDefault={navigate}>
	<input type="text" required bind:value={npub} />
	<input type="submit" value="Search" />
</form>
