// Engineering write-ups published at /insights/<slug>/ (English only).
//
// Facts only, the same rule as case-deep-dives.mjs: what a write-up says about a
// client system is already stated on the site (the case study it links to) or
// in cv/cv.html. Everything else is written as general practice ("what I would
// tell a team"), never as a claim about how the client's system works. Code
// samples are simplified illustrations of a pattern and say so.
//
// `body` is trusted HTML written here (not user input). `related` is a
// FLAGSHIP slug: the article links to that case study, the case study links
// back, and the article shares that case's card. `crumb` is the short page name
// used by both the visible breadcrumb and its BreadcrumbList.
//
// Editing a published article: set `dateModified: 'YYYY-MM-DD'` on it so the
// article's JSON-LD agrees with the sitemap date the edit will produce.

export const INSIGHTS_INDEX = {
  title: 'Engineering write-ups from production systems · Ahmed Farid',
  h1: 'Engineering write-ups.',
  description: 'How production systems stay correct under load: real-time bidding, webhook sync and multi-tenant SaaS. By Ahmed Farid, senior software engineer in Dubai.',
  lede: 'Notes from systems that are live: the problem, the decision that mattered, and what I would tell a team about to build the same thing.',
};

export const INSIGHTS = [
  {
    slug: 'real-time-bidding-laravel-redis',
    title: 'Real-time Auction Bidding with Laravel, Redis and Socket.IO',
    crumb: 'Real-time bidding',
    h1: 'Bids that never go out of order.',
    description: 'How a live vehicle auction keeps every bid in order under final-second load: bid order decided on the server in Redis, Socket.IO broadcast and proxy auto-bidding.',
    datePublished: '2026-10-20',
    related: 'yelo-sale',
    minutes: 6,
    lede: 'Live auctions are unforgiving. In the last seconds of a lot, dozens of bidders press the button at once, and the system has one job: decide, correctly and fast, who is winning.',
    body: `
<p>This is the architecture behind <a href="/work/yelo-sale/">Yelo Sale</a>, a B2B2C vehicle auction platform in Saudi Arabia: a Laravel 11 API serving a Next.js 14 web app and Flutter apps for iOS and Android, in Arabic and English. Fleet owners list cars and lots; verified bidders compete live; the winner reserves and pays online.</p>

<h2>The bug every auction starts with: two winners</h2>
<p>The naive version of "place a bid" reads the current price, checks the new bid is higher, and writes it. Under light traffic that works. In the final seconds of a lot it does not: two requests read the same price at the same moment, both pass the check, both write, and both bidders are told they are winning. One of them finds out later, which is the moment a marketplace loses a customer's trust.</p>
<p>Row locks in the database fix the correctness, but every bid on a hot lot now waits in line on the same row, and the wait shows up exactly when the auction is most exciting. And whatever the database does, the order must not come from the clients: their clocks drift, and their messages arrive whenever the network delivers them.</p>

<h2>Rule one: the server decides the order</h2>
<p>A client never decides that it is winning. It proposes a bid; the server accepts or rejects it, and the order in which the server accepts bids is the order of the auction. On Yelo Sale the live bid state sits in Redis and changes through atomic operations, so every accepted bid has a single, unambiguous place in that order. That is what removes lost bids and duplicate winners under final-second load.</p>
<p>The check ("is this bid high enough, is the lot still open?") and the write ("this is the new price, this is the new leader") have to be one step. In Redis, one way to make them one step is a short Lua script, which Redis runs without interleaving anything else. A simplified version of the pattern:</p>
<pre><code>-- KEYS[1]: the lot's live state (a hash: price, step, leader, ends_at, seq)
-- ARGV: bidder id, bid amount, server time
local price = tonumber(redis.call('HGET', KEYS[1], 'price'))
local step  = tonumber(redis.call('HGET', KEYS[1], 'step'))
local ends  = tonumber(redis.call('HGET', KEYS[1], 'ends_at'))
if tonumber(ARGV[3]) &gt;= ends then return {0, 'closed'} end
if tonumber(ARGV[2]) &lt; price + step then return {0, 'too_low'} end
local seq = redis.call('HINCRBY', KEYS[1], 'seq', 1)
redis.call('HSET', KEYS[1], 'price', ARGV[2], 'leader', ARGV[1])
return {seq, 'accepted'}</code></pre>
<p>The sequence number is the useful part: every accepted bid gets the next number, so anything downstream (the broadcast, the bid history, the ERP) can tell which bid came after which without trusting arrival order.</p>

<h2>Broadcast what was accepted, not what was attempted</h2>
<p>Only after the server accepts a bid does anyone hear about it. On Yelo Sale a Socket.IO layer on Node broadcasts the accepted state to everyone watching the lot, on web and mobile alike, with under 200&nbsp;ms from bid to broadcast end to end. The rule I would hold any client app to: render the state the server sends, and never show "you are winning" on its own initiative, because an optimistic winner that turns out to be wrong is worse than a short wait.</p>
<p>Keeping one API for all three clients matters here. In an Nx monorepo the web app and the mobile apps share the same contract, so a rule like "a lot that has closed refuses bids" lives in one place, not in three.</p>

<h2>Proxy bidding belongs on the server too</h2>
<p>Proxy auto-bidding lets a bidder set a ceiling and walk away: the system counters rivals on their behalf, up to that ceiling, so they win at the lowest price necessary. On Yelo Sale it runs server-side, like the bids themselves. It is tempting to treat this as a background job that "reacts" to new bids. That reintroduces the race: two proxies reacting to the same bid are two writers again.</p>
<p>The way I would structure it in any auction: resolve proxies inside the same server-side step that accepts the bid. When a new bid arrives, compare it with the standing ceilings, work out where the price settles (typically the higher ceiling wins, one step above the lower one), and record that outcome as accepted bids in order. Then broadcast once.</p>

<h2>After the hammer: the lot is a state machine</h2>
<p>Bidding is the exciting part; the money is in what happens next. Every lot on Yelo Sale moves through <i>listed → live auction → reserved → paid → delivered</i>, with admin governance at each step, and that is where payments (Amazon Payfort), PDF and QR invoices and the two-way sync with Microsoft Dynamics 365 come in. The rule I apply to anything like this: tie side effects to transitions, never to individual bids. A transition happens once or not at all, which is what keeps an ERP and a platform agreeing about which car was sold to whom.</p>
<p>Access follows the same idea of hard boundaries: admins, companies and customers each sign in behind their own guard. Separate guards are a cheap way to make sure a token issued to one kind of user is never accepted on another kind's endpoints.</p>

<h2>What I would tell a team building an auction</h2>
<ul>
  <li><b>Decide who owns the order before you write a screen.</b> If the answer is "the client" or "whoever writes last", you have a race you have not met yet.</li>
  <li><b>Make the check and the write one step.</b> An atomic script in an in-memory store is one way; a single conditional update in the database is another. Two steps with a gap between them is not.</li>
  <li><b>Keep the database out of the ordering hot path,</b> but record every accepted bid durably, with its sequence number, so the history can be rebuilt and audited.</li>
  <li><b>Resolve proxy bids in the same step</b> as the bid that triggered them.</li>
  <li><b>Load-test the last second, not the average minute.</b> The average is never where an auction fails.</li>
</ul>
`,
  },
  {
    slug: 'webhook-sync-out-of-order',
    title: 'Out-of-Order Webhooks: Keeping a Client Portal in Sync',
    crumb: 'Out-of-order webhooks',
    h1: 'Webhooks that arrive late, twice or out of order.',
    description: 'Webhooks arrive late, twice and out of order. How per-record sequence numbers keep a mirrored client portal from moving backwards, from a live platform.',
    datePublished: '2026-10-20',
    related: 'recovery-advisers',
    minutes: 5,
    lede: 'Polling is simple and wasteful. Webhooks are efficient and messy: once you push changes to another system, deliveries arrive late, they arrive twice, and they arrive out of order.',
    body: `
<p>This is the sync behind <a href="/work/recovery-advisers/">Recovery Advisers</a>, a debt-recovery and case-management platform in Dubai. An internal app runs the whole lifecycle, from lead to case, mandate, litigation, recovery and invoice. Creditors and law firms follow their cases in a separate client portal, which is a read-only mirror of the main app.</p>

<h2>From polling to push</h2>
<p>The first version of any mirror polls: every few minutes, ask the main system what changed. It is easy to build and wasteful to run, and clients still see updates late. Recovery Advisers replaced polling with webhook push: when a case changes, the main app sends the change to the client environment as an event.</p>
<p>Push is the right call, but it comes with three facts of life. Deliveries can be <b>late</b> (a retry after a timeout), <b>duplicated</b> (the sender retried, but the first attempt had already arrived) and <b>out of order</b> (two quick changes, and the second one lands first).</p>

<h2>Why "apply the latest event" moves cases backwards</h2>
<p>Picture a case that goes from <i>mandate</i> to <i>litigation</i> a few seconds later. Two events are sent. The litigation event arrives first and the portal shows litigation. Then the delayed mandate event arrives, and a handler that simply applies whatever it receives moves the case back to mandate. The client now sees their case going backwards, and nothing in the logs looks like an error.</p>

<h2>Per-record sequence numbers</h2>
<p>The fix on Recovery Advisers is a sequence number per case. Every change to a case increments its sequence, and every event carries it. The receiving side applies an event only if its sequence is higher than the one it already holds. A late event is older than what is stored, so it is ignored; a duplicate carries the same number, so it is ignored too. A mirrored case never moves backwards.</p>
<p>The check and the write should be a single statement, so two deliveries handled at the same moment cannot both pass the check. A simplified version of the receiving side in Laravel:</p>
<pre><code>// Apply an event only if it is newer than what the mirror holds.
$applied = DB::table('portal_cases')
    -&gt;where('case_id', $event['case_id'])
    -&gt;where('seq', '&lt;', $event['seq'])
    -&gt;update([
        'status'     =&gt; $event['status'],
        'payload'    =&gt; json_encode($event['case']),
        'seq'        =&gt; $event['seq'],
        'updated_at' =&gt; now(),
    ]);

// 0 rows: stale or duplicate. Acknowledge it all the same,
// so the sender stops retrying something already handled.
return response()-&gt;noContent();</code></pre>
<p>(A case the mirror has never seen needs an insert as well; that path follows the same rule.)</p>

<h2>Practices that make this hold up</h2>
<ul>
  <li><b>Send the record's current state, not a diff.</b> If every event carries the whole case as it stands, the newest event is enough on its own and a skipped one does no harm.</li>
  <li><b>Verify, acknowledge, then process.</b> Check the signature before trusting the body, answer quickly with a 2xx, and do the work in a queue. Slow handlers cause the retries that create duplicates.</li>
  <li><b>Make "already applied" a success,</b> not an error. Senders retry errors.</li>
  <li><b>Keep the sequence on the sender's side.</b> Timestamps from two machines are not an order.</li>
</ul>

<h2>The mirror only shows what each client may see</h2>
<p>Syncing data out of a system is also a decision about who sees it. On Recovery Advisers, role-based access is enforced in the data layer, not in the UI, and tenant-resolve middleware isolates every tenant: a creditor or a law firm only ever sees its own cases. Staff sign in with their company Microsoft accounts through Entra ID single sign-on.</p>

<h2>Rebuilt without stopping the business</h2>
<p>The platform was rebuilt while the team kept using it every day. That is mostly a matter of order: ship in small slices behind the workflow people already use, move one part of the lifecycle at a time, and keep the old path working until the new one has carried real traffic. The result, in the client's words, is that clients now check their own case status instead of emailing for it.</p>
`,
  },
];
