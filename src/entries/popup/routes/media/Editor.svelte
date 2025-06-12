<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { fade } from "svelte/transition";
	import { useParams } from "svelte-navigator";
	import { queryStore, getContextClient, mutationStore } from "@urql/svelte";
	import Icon from "svelte-fa";
	import { faTimes } from "@fortawesome/free-solid-svg-icons";
	import {
		GetFullUserMediaListDocument,
		GetMediaByIdDocument,
		MediaListStatus,
		UpdateMediaListDocument,
		type FuzzyDateInput,
		type GetMediaByIdQuery,
	} from "@anilist/graphql";
	import { textify, hexToRgb } from "$lib/util";
	import Button from "$lib/components/Button.svelte";
	import { user, extensionConfig } from "$lib/store";

	export let entry: GetMediaByIdQuery["Media"] | null;

	const dispatch = createEventDispatcher();
	const params = useParams();
	const client = getContextClient();
	let fmt = (n: number) => `${n}`.padStart(2, "0");

	let media;
	let initialized = false;
	let isSaving = false;
	let maxProgress = 0;

	$: currentId = entry?.id;
	$: listId = entry?.mediaListEntry.id;
	$: name = $user?.name;
	$: if (currentId && name) {
		getData();
	}

	async function getData() {
		media = queryStore({
			client,
			query: GetFullUserMediaListDocument,
			variables: { userName: name, mediaId: currentId },
			requestPolicy: "network-only",
		});
		initialized = false;
	}

	let status: MediaListStatus | "" = "";
	let score = 0;
	let progress = 0;
	let startDate = "";
	let finishDate = "";
	let rewatchCount = 0;
	let notes = "";
	let orig = {
		status: "" as MediaListStatus | "",
		score: 0,
		progress: 0,
		rewatchCount: 0,
		notes: "",
		startedAt: "",
		CompletedAt: "",
	};

	$: if ($media.data?.MediaList && !initialized) {
		status = $media.data?.MediaList.status || null;
		score = $media.data?.MediaList.score || 0;
		progress = $media.data?.MediaList.progress || 0;
		rewatchCount = $media.data?.MediaList.repeat || 0;
		notes = $media.data?.MediaList.notes || "";

		if ($media.data?.MediaList.media.nextAiringEpisode?.episode) {
			maxProgress = $media.data?.MediaList.media.nextAiringEpisode?.episode - 1;
		} else {
			maxProgress =
				$media.data?.MediaList.media.episodes ||
				$media.data?.MediaList.media.chapters ||
				undefined;
		}

		let { day, month, year } = $media.data?.MediaList.startedAt ?? {};
		if (day && month && year) {
			startDate = `${year}-${fmt(month)}-${fmt(day)}`;
		}

		let { day2, month2, year2 } = $media.data?.MediaList.completedAt ?? {};
		if (day2 && month2 && year2) {
			finishDate = `${year2}-${fmt(month2)}-${fmt(day2)}`;
		}

		orig = {
			status: status,
			score: score,
			progress: progress,
			rewatchCount: rewatchCount,
			notes: notes,
			startedAt: startDate,
			CompletedAt: finishDate,
		};

		initialized = true;
	}

	$: isDirty =
		status !== orig.status ||
		score !== orig.score ||
		progress !== orig.progress ||
		startDate !== orig.startedAt ||
		finishDate !== orig.CompletedAt ||
		rewatchCount !== orig.rewatchCount ||
		notes !== orig.notes;

	function close() {
		dispatch("close");
	}

	function parseISO(s: string): FuzzyDateInput | undefined {
		if (!s) return undefined;
		let [y, m, d] = s.split("-").map(Number);
		return y && m && d ? { year: y, month: m, day: d } : undefined;
	}

	function formatFuzzyDate(
		date?: { year?: number; month?: number; day?: number } | null
	): string {
		if (!date?.year || !date.month || !date.day) return "";
		const pad2 = (n: number) => `${n}`.padStart(2, "0");
		return `${date.year}-${pad2(date.month)}-${pad2(date.day)}`;
	}

	async function save() {
		try {
			isSaving = true;

			let { data, error } = await client.mutation(UpdateMediaListDocument, {
				mediaId: currentId,
				saveMediaListEntryId: listId,
				progress: progress,
				status: status === "" ? undefined : status,
				score: score,
				repeat: rewatchCount,
				notes: notes,
				completedAt: parseISO(finishDate),
				startedAt: parseISO(startDate),
			});

			if (!error) {
				getData();
				console.log("Saved!");
				dispatch("saved");
			} else {
				console.log("Error saving!");
			}
		} finally {
			isSaving = false;
		}
	}
</script>

<div
	class="fixed -top-5 bottom-0 left-0 right-0 flex items-center justify-center"
>
	<div class="absolute inset-0 backdrop-blur-[10px]" on:click={close} />

	<div
		class="relative w-full max-w-5xl mx-4
           bg-surface dark:bg-background
           rounded-2xl shadow-2xl overflow-hidden"
		in:fade={{ duration: 200 }}
	>
		<div
			class="relative w-full {$media.data?.MediaList.media.bannerImage
				? 'h-[20vh]'
				: 'h-[24vh] -mt-[4vh]'} bg-cover bg-center"
			style="background-image:url({$media.data?.MediaList.media.bannerImage ||
				$media.data?.MediaList.media.coverImage.extraLarge})"
		>
			<div class="h-full w-full bg-gradient-to-b from-shadow/40 to-shadow/60" />

			<div
				class="absolute left-6 bottom-4 transform translate-y-1/2 flex items-end space-x-4"
			>
				<img
					src={$media.data?.MediaList.media.coverImage.large}
					alt="{$media.data?.MediaList.media.title.userPreferred} poster"
					class="w-24 sm:w-32 rounded-xl shadow-lg border-2 border-white"
				/>
				<div class="text-text drop-shadow-md">
					<h2 class="text-xl sm:text-2xl font-bold leading-tight">
						{$media.data?.MediaList.media.title.userPreferred}
					</h2>
					<p class="text-sm sm:text-base text-text-secondary">
						{$media.data?.MediaList.media.format} • {$media.data?.MediaList
							.media.status}
					</p>
				</div>
			</div>
			<button
				class="absolute top-4 right-4 p-2 text-white"
				on:click={close}
				aria-label="Close editor"
			>
				<Icon icon={faTimes} />
			</button>
		</div>

		<div
			class="w-full px-6 pb-6 relative z-10"
			class:mt-16={!$extensionConfig.theme.wide}
			class:mt-24={$extensionConfig.theme.wide}
			style="--color-variable:{hexToRgb(
				$media.data?.MediaList.media.coverImage.color
			) || 'var(--color-accent)'}"
		>
			<div class="grid grid-cols-3 gap-2">
				<div>
					<label class="block text-sm text-text-secondary mb-1">Status</label>
					<select
						bind:value={status}
						class="w-full px-3 py-2 bg-surface dark:bg-background border rounded text-text focus:ring-2 focus:ring-variable"
					>
						{#if !status}
							<option value="" disabled>Status</option>
						{/if}
						{#each Object.values(MediaListStatus) as s}
							{#if s == "CURRENT"}
								<option value={s}>Watching</option>
							{:else if s == "PLANNING"}
								<option value={s}>Plan to watch</option>
							{:else if s == "COMPLETED"}
								<option value={s}>Completed</option>
							{:else if s == "REPEATING"}
								<option value={s}>Rewatching</option>
							{:else if s == "PAUSED"}
								<option value={s}>Paused</option>
							{:else if s == "DROPPED"}
								<option value={s}>Dropped</option>
							{:else}
								<option value={s}>{textify(s)}</option>
							{/if}
						{/each}
					</select>
				</div>

				<div>
					<label class="block text-sm text-text-secondary mb-1">Score</label>
					<input
						type="number"
						min="0"
						max="100"
						bind:value={score}
						class="w-full px-3 py-2 bg-surface dark:bg-background border rounded text-text focus:ring-2 focus:ring-variable"
					/>
				</div>

				<div>
					<label class="block text-sm text-text-secondary mb-1"
						>Episode Progress</label
					>
					<input
						type="number"
						min="0"
						max={maxProgress}
						bind:value={progress}
						class="w-full px-3 py-2 bg-surface dark:bg-background border rounded text-text focus:ring-2 focus:ring-variable"
					/>
				</div>

				<div>
					<label class="block text-sm text-text-secondary mb-1"
						>Start Date</label
					>
					<input
						type="date"
						bind:value={startDate}
						class="w-full px-3 py-2 bg-surface dark:bg-background border rounded text-text focus:ring-2 focus:ring-variable"
					/>
				</div>
				<div>
					<label class="block text-sm text-text-secondary mb-1"
						>Finish Date</label
					>
					<input
						type="date"
						bind:value={finishDate}
						class="w-full px-3 py-2 bg-surface dark:bg-background border rounded text-text focus:ring-2 focus:ring-variable"
					/>
				</div>

				<div>
					<label class="block text-sm text-text-secondary mb-1"
						>Total Rewatches</label
					>
					<input
						type="number"
						min="0"
						bind:value={rewatchCount}
						class="w-full px-3 py-2 bg-surface dark:bg-background border rounded text-text focus:ring-2 focus:ring-variable"
					/>
				</div>
			</div>
			<div class="mt-4">
				<label class="block text-sm text-text-secondary mb-1">Notes</label>
				<textarea
					rows="3"
					bind:value={notes}
					class="w-full px-3 py-2 bg-surface dark:bg-background border rounded text-text resize-none focus:ring-2 focus:ring-variable"
					placeholder="Type your notes…"
				/>
			</div>
			<div class="mt-6 flex justify-end space-x-2">
				<Button type="INFO" on:click={save} disabled={!isDirty || isSaving}
					>{#if isSaving}Saving...{:else}Save{/if}</Button
				>
				<Button type="ERROR" on:click={close}>Cancel</Button>
			</div>
		</div>
	</div>
</div>
