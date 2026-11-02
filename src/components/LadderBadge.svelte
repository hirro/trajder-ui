<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { LADDER_DOCS, RUNG_INFO, fmtPct, ladderView, type LadderBox, type LadderChipState, type PromotionInputs } from "../lib/sleeveFormat";

  interface Props {
    status: string | null | undefined;
    /** The sleeve row (n_closed, p_positive, scorecard_computed_at, promotion). Omit where only the rung is known. */
    sleeve?: PromotionInputs | null;
    /** Render with the hover card already open — for stories and tests only. */
    initialOpen?: boolean;
    /** Ring diameter in px (min 16 — below that it is unreadable). The geometry is proportional. */
    size?: number;
    /** A disabled sleeve: rings drawn grey (#4b5566 on #2b3444), fills and hover card unchanged. */
    disabled?: boolean;
    /** Click on the ring (e.g. a sleeve grid row opens the sleeve). The ring is a button
     *  itself, so callers must not wrap it in another button. */
    onclick?: () => void;
  }
  let { status, sleeve = null, initialOpen = false, size = 26, disabled = false, onclick }: Props = $props();

  // All numbers, fills and copy come from the pure view-model (lib/sleeveFormat.ladderView), which
  // reads every threshold from the backend `promotion` payload; this file only owns layout + colour.
  const view = $derived(ladderView({ ...(sleeve ?? {}), ladder_status: status }));

  // Stage colours (text / background / border) from the Ladder Control design handoff.
  interface StageColour { c: string; bg: string; b: string; }
  const STAGE: Record<string, StageColour> = {
    SHADOW: { c: "#c3cad5", bg: "#2a3342", b: "#4a5568" },
    PROBATION: { c: "#9cc2ff", bg: "#1c3566", b: "#3d6fd0" },
    FULL: { c: "#6ee79a", bg: "#123d25", b: "#23874a" },
    FROZEN: { c: "#ff8a8a", bg: "#4a1a1c", b: "#a83a3d" },
  };
  const MUTED = "#6b7585";

  // Triple ring (default 26×26) in Apple Activity-ring colours, no text beside it:
  //   outer  (red,   Move)     = the rung itself: FROZEN 0, SHADOW ⅓, PROBATION ⅔, FULL full
  //   middle (green, Exercise) = P(edge>0) toward the next gate
  //   inner  (blue,  Stand)    = closed trades toward the minimum
  // All start at 12 o'clock and fill clockwise; FROZEN, unknown rungs and disabled sleeves are grey.
  // Proportional geometry from the design handoff (Ladder Rings Sizes): for diameter D each stroke is
  // 10.4% of D and the middle / inner rings are inset 14.6% / 29.2% of D, so the rings stay concentric
  // and evenly spaced at every size.
  const SIZE = $derived(Math.max(16, size));
  const C = $derived(SIZE / 2);
  const SW = $derived(0.104 * SIZE);
  const radius = (insetPct: number) => C - insetPct * SIZE - SW / 2;
  const R_OUT = $derived(radius(0));
  const R_MID = $derived(radius(0.146));
  const R_IN = $derived(radius(0.292));
  const circ = (r: number) => 2 * Math.PI * r;
  const grey = $derived(disabled || view.frozen || !view.stage);
  const GREY_FILL = "#4b5566";
  const GREY_TRACK = "#2b3444";
  const rings = $derived([
    { id: "stage", r: R_OUT, fill: view.stageFill, colour: grey ? GREY_FILL : "#FA114F", track: grey ? GREY_TRACK : "rgba(250,17,79,.22)" },
    { id: "p", r: R_MID, fill: view.pFill, colour: grey ? GREY_FILL : "#92E82A", track: grey ? GREY_TRACK : "rgba(146,232,42,.2)" },
    { id: "trades", r: R_IN, fill: view.tradesFill, colour: grey ? GREY_FILL : "#1EEAEF", track: grey ? GREY_TRACK : "rgba(30,234,239,.2)" },
  ]);
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  const uid = $props.id();
  const verdictId = `ladder-verdict-${uid}`;

  function chipStyle(rung: string, state: LadderChipState): string {
    const s = STAGE[rung];
    switch (state) {
      case "current":
        return `background:${s.bg};border:1px solid ${s.b};color:${s.c};box-shadow:0 0 0 2px #141b27,0 0 0 3px ${s.b}`;
      case "next":
        return `background:transparent;border:1px dashed ${s.b};color:${s.c}`;
      case "past":
        return `background:${s.bg};border:1px solid ${s.b};color:${s.c}`;
      default:
        return `background:transparent;border:1px solid #34405a;color:${MUTED}`;
    }
  }

  const TONE: Record<string, string> = { met: "#34c46a", muted: "#8a94a3", danger: "#ff8a8a" };
  // Requirement bars in the card use the colour of the ring that shows the same quantity, so the card
  // reads as a zoom-in on the rings: closed trades = inner blue, P(edge>0) = middle green. Only the
  // FULL hold box's below-the-demotion-line state overrides that with danger red.
  const RING_COLOUR: Record<string, string> = { trades: "#1EEAEF", confidence: "#92E82A" };
  const RUNG_COLOUR = "#FA114F"; // outer ring = the rung; the stepper's connectors use it too
  const DANGER_BAR = "#d05555";
  const barColour = (row: { id: string; tone: string }) => (row.tone === "danger" ? DANGER_BAR : (RING_COLOUR[row.id] ?? "#e5b73b"));
  const MONO = "font-family:ui-monospace,Menlo,monospace";

  // The card sits inside scrollable tables (overflow-x-auto), which clip an absolutely positioned
  // popover at the table's edge. So it is portalled to <body> and placed with fixed coordinates
  // measured from the trigger — below it when there is room, above it otherwise.
  const POP_W = 360;
  const GAP = 6;
  const MARGIN = 8;
  let open = $state(false);
  let placement = $state("");
  let trigger: HTMLButtonElement | undefined = $state();
  let popEl: HTMLElement | undefined = $state();
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  let openTimer: ReturnType<typeof setTimeout> | undefined;
  // Hover intent: the card only opens once the pointer has rested on the trigger this long, so sweeping
  // across a table full of badges doesn't flash cards. Keyboard focus opens immediately.
  const HOVER_OPEN_MS = 400;
  // Grace period so the pointer can cross the gap from the trigger into the card.
  const CLOSE_GRACE_MS = 150;

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }

  function place() {
    if (!trigger || !popEl) return;
    const r = trigger.getBoundingClientRect();
    const h = popEl.offsetHeight;
    const roomBelow = window.innerHeight - r.bottom - MARGIN;
    const roomAbove = r.top - MARGIN;
    const below = roomBelow >= h + GAP || roomBelow >= roomAbove;
    const top = below ? r.bottom + GAP : Math.max(MARGIN, r.top - GAP - h);
    const left = Math.max(MARGIN, Math.min(r.left, window.innerWidth - POP_W - MARGIN));
    placement = `top:${Math.round(top)}px;left:${Math.round(left)}px`;
  }

  async function show() {
    if (closeTimer) clearTimeout(closeTimer);
    if (openTimer) clearTimeout(openTimer);
    open = true;
    await tick();
    place();
  }
  // Pointer on the trigger: open after the hover-intent delay (instantly if already open).
  function showSoon() {
    if (closeTimer) clearTimeout(closeTimer);
    if (open) return;
    if (openTimer) clearTimeout(openTimer);
    openTimer = setTimeout(show, HOVER_OPEN_MS);
  }
  function hide() {
    if (openTimer) clearTimeout(openTimer);
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = setTimeout(() => (open = false), CLOSE_GRACE_MS);
  }
  function hideNow() {
    if (openTimer) clearTimeout(openTimer);
    if (closeTimer) clearTimeout(closeTimer);
    open = false;
  }

  onDestroy(() => {
    if (openTimer) clearTimeout(openTimer);
    if (closeTimer) clearTimeout(closeTimer);
  });

  onMount(() => {
    if (initialOpen) show();
  });
</script>

<svelte:window onscroll={() => open && hideNow()} onresize={() => open && place()} />

<button
  type="button"
  bind:this={trigger}
  class="inline-flex items-center {onclick ? 'cursor-pointer' : 'cursor-help'} bg-transparent border-0 p-0 align-middle"
  aria-label="Ladder rung {view.label} — hover for promotion details"
  aria-expanded={open}
  aria-describedby={view.verdict ? verdictId : undefined}
  onmouseenter={showSoon}
  onmouseleave={hide}
  onfocus={show}
  onblur={hide}
  onkeydown={(e) => e.key === "Escape" && hideNow()}
  onclick={onclick
    ? () => {
        hideNow();
        onclick();
      }
    : undefined}
>
  <svg
    width={SIZE}
    height={SIZE}
    viewBox="0 0 {SIZE} {SIZE}"
    class="flex-none"
    aria-hidden="true"
    data-testid="ladder-ring"
    data-p-fill={r3(view.pFill)}
    data-trades-fill={r3(view.tradesFill)}
    data-stage-fill={r3(view.stageFill)}
    data-frozen={view.frozen ? "true" : undefined}
    data-disabled={disabled ? "true" : undefined}
  >
    <g transform="rotate(-90 {C} {C})" fill="none" stroke-width={r3(SW)} stroke-linecap="round">
      {#each rings as ring (ring.id)}
        <circle cx={C} cy={C} r={ring.r} stroke={ring.track} data-ring={ring.id} />
        {#if ring.fill >= 1}
          <circle cx={C} cy={C} r={ring.r} stroke={ring.colour} />
        {:else if ring.fill > 0}
          <circle cx={C} cy={C} r={ring.r} stroke={ring.colour} stroke-dasharray="{ring.fill * circ(ring.r)} {circ(ring.r)}" />
        {/if}
      {/each}
    </g>
  </svg>
</button>
<!-- The verdict as the trigger's accessible description. Not a title attribute: the browser's native
     tooltip would pop over the hover card, which already shows the same information. -->
{#if view.verdict}<span id={verdictId} class="sr-only">{view.verdict}</span>{/if}

{#snippet reqRows(box: LadderBox, preview: boolean)}
  <div class="grid grid-cols-[90px_1fr_auto] gap-[10px] items-center text-[12px]">
    {#each box.rows as row (row.id)}
      <span style="color:{preview ? '#8a94a3' : '#aab3c0'}">{row.label}</span>
      {#if row.fill === null}
        <span></span>
      {:else}
        <div class="relative h-[4px] rounded-[2px] bg-[#2b3444]">
          {#if row.fill > 0}
            <div
              class="h-full rounded-[2px]"
              style="width:{row.fill * 100}%;background:{barColour(row)}"
              data-testid={preview ? undefined : `ladder-bar-${row.id}`}
            ></div>
          {/if}
          {#if row.marker !== null}
            <div class="absolute top-[-3px] bottom-[-3px] w-[2px]" style="left:calc({row.marker * 100}% - 1px);background:{preview ? '#8a94a3' : '#e6ebf2'}"></div>
          {/if}
        </div>
      {/if}
      <span
        class="text-[11.5px] min-w-[92px] text-right whitespace-nowrap"
        style="{MONO};color:{preview ? '#8a94a3' : '#d7dde6'}"
        data-testid={preview ? undefined : `ladder-req-${row.id}`}
      >{row.value}{#if row.note}&nbsp;<span style="color:{TONE[row.tone]}">{row.note}</span>{/if}</span>
    {/each}
  </div>
{/snippet}

{#snippet boxFooter(box: LadderBox, rungColour: string)}
  <div class="pt-[10px] border-t border-[#263041] text-[12px] leading-[1.45] text-[#8a94a3]">
    <span class="font-semibold" style="color:{rungColour}">{box.rung}</span> · {box.footer}
  </div>
{/snippet}

{#if open}
  <!-- Stepper card, portalled to <body> so table overflow can't clip it. -->
  <div
    use:portal
    bind:this={popEl}
    class="fixed z-50 w-[360px] box-border flex flex-col rounded-[8px] border border-[#2c3647] bg-[#141b27] text-left font-normal whitespace-normal normal-case tracking-normal"
    style="box-shadow:0 12px 32px rgba(0,0,0,.45);font-family:system-ui,-apple-system,'Segoe UI',sans-serif;{placement}"
    role="tooltip"
    data-testid="ladder-card"
    onmouseenter={show}
    onmouseleave={hide}
  >
    <!-- a. Header -->
    <div class="flex justify-between items-center px-4 py-3 border-b border-[#232c3b]">
      <span class="text-[11px] tracking-[.1em] text-[#7d8795]">PROMOTION LADDER</span>
      {#if LADDER_DOCS.href}
        <a href={LADDER_DOCS.href} target={LADDER_DOCS.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" class="text-[12px] text-[#6ea8ff] hover:text-[#9cc2ff] no-underline">{LADDER_DOCS.label}</a>
      {/if}
    </div>

    {#if !view.stage}
      <div class="px-4 py-3 text-[12px] text-[#6b7585]">Rung unknown — no ladder data for this sleeve.</div>
    {:else}
      <!-- b. Stepper -->
      <div class="p-4 grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-y-[6px]">
        {#each view.chips as chip, i (chip.rung)}
          {#if i > 0}
            <div class="h-[2px] mx-[6px] bg-[#2b3444]" data-testid="ladder-connector-{i}">
              <!-- Red like the outer (rung) ring: the connectors are progress along the ladder. -->
              <div class="h-full" style="width:{view.connectors[i - 1] * 100}%;background:{RUNG_COLOUR}"></div>
            </div>
          {/if}
          <span
            class="text-[10.5px] font-semibold tracking-[.06em] px-[7px] py-[4px] rounded-[3px] leading-none"
            style={chipStyle(chip.rung, chip.state)}
            data-testid="ladder-step-{chip.rung}"
            data-state={chip.state}
            aria-current={chip.state === "current" ? "step" : undefined}
          >{chip.rung}</span>
        {/each}
        {#if view.gateLabels[0] || view.gateLabels[1]}
          <span></span>
          <span class="text-[10px] text-[#6b7585] text-center" style={MONO}>{view.gateLabels[0] ?? ""}</span>
          <span></span>
          <span class="text-[10px] text-[#6b7585] text-center" style={MONO}>{view.gateLabels[1] ?? ""}</span>
          <span></span>
        {/if}
      </div>

      <!-- c. Current stage line -->
      <div class="px-4 pb-[14px] text-[13px] leading-[1.45] text-[#aab3c0]">
        <span class="font-semibold" style="color:{view.frozen ? STAGE.FROZEN.c : '#e6ebf2'}">{view.stage}</span> · {RUNG_INFO[view.stage].meaning}
        {#if !view.hasProgress}
          <div class="mt-1 text-[12px] text-[#7d8795]">{RUNG_INFO[view.stage].rule}</div>
        {/if}
      </div>

      <!-- d. Next gate -->
      {#if view.nextGate}
        {@const box = view.nextGate}
        <div class="mx-4 p-[14px] bg-[#1a2231] border border-[#263041] rounded-[6px] flex flex-col gap-3" data-testid="ladder-next-gate">
          <div class="text-[12px] text-[#8a94a3]">To reach <span class="font-semibold" style="color:{STAGE[box.rung].c}">{box.rung}</span></div>
          {@render reqRows(box, false)}
          {@render boxFooter(box, STAGE[box.rung].c)}
        </div>
      {/if}

      <!-- d'. Holding FULL (the demotion line instead of a next gate) -->
      {#if view.hold}
        {@const box = view.hold}
        <div class="mx-4 p-[14px] bg-[#1a2231] border border-[#263041] rounded-[6px] flex flex-col gap-3" data-testid="ladder-hold">
          <div class="text-[12px] text-[#8a94a3]">Holding <span class="font-semibold" style="color:{STAGE.FULL.c}">FULL</span></div>
          {@render reqRows(box, false)}
          <!-- No footer: the current-stage line just above already says what FULL means. -->
        </div>
      {/if}

      <!-- e. Then FULL (SHADOW only, greyed preview) -->
      {#if view.thenFull}
        {@const box = view.thenFull}
        <div class="mx-4 mt-2 p-[14px] border border-dashed border-[#2c3647] rounded-[6px] flex flex-col gap-3 opacity-55" data-testid="ladder-then-full">
          <div class="text-[12px] text-[#7d8795]">Then <span class="font-semibold text-[#aab3c0]">{box.rung}</span></div>
          {@render reqRows(box, true)}
          {@render boxFooter(box, "#aab3c0")}
        </div>
      {/if}

      <!-- f. Rules legend -->
      <div class="px-4 pt-3 pb-[14px] flex flex-col gap-[6px] text-[11.5px] text-[#7d8795]" data-testid="ladder-legend">
        <div class="flex gap-2 items-center">
          <span class="w-[14px] flex-none border-t border-[#8a94a3]"></span>
          <span>
            {#if view.demoteThreshold !== null}
              Demotes one step if P &lt; {fmtPct(view.demoteThreshold)}
            {:else}
              Demotes one step if P falls below the demotion line
            {/if}
          </span>
        </div>
        <div class="flex gap-2 items-center">
          <span class="w-[14px] flex-none border-t border-dashed border-[#d05555]"></span>
          <span>Kill switch → <span class="text-[#ff8a8a]">FROZEN</span> if drawdown &gt; 2× its shadow-era worst · unfreeze manual only</span>
        </div>
      </div>
    {/if}
  </div>
{/if}
