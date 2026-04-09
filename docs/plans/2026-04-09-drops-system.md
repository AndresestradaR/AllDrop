# Drops System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Gate all AI tools behind a drops balance — users need a paid plan to use image/video generation. Admins bypass everything.

**Architecture:** Centralized `ADMIN_EMAILS` constant + `consumeDrops()` service function called after successful AI generation in each API route. Frontend checks balance before allowing execution and shows translated error if insufficient.

**Tech Stack:** Next.js 14, Supabase (profiles.drops + credit_transactions), Stripe (already integrated), React context for drops balance.

---

### Task 1: Unify Admin Emails

**Files:**
- Create: `lib/admin.ts`
- Modify: `app/(dashboard)/layout.tsx:34`
- Modify: `app/(dashboard)/dashboard/settings/page.tsx:9`

**Step 1: Create admin constant**

Create `lib/admin.ts`:
```typescript
export const ADMIN_EMAILS = ['infoalldrop@gmail.com', 'danibg8000@gmail.com']
export const isAdmin = (email: string | null | undefined) => 
  !!email && ADMIN_EMAILS.includes(email)
```

**Step 2: Update layout.tsx**

Replace line 34:
```typescript
const ADMIN_EMAIL = 'infoalldrop@gmail.com'
```
With:
```typescript
import { isAdmin as isAdminEmail } from '@/lib/admin'
```
And replace all `userEmail === ADMIN_EMAIL` with `isAdminEmail(userEmail)`.

**Step 3: Update settings/page.tsx**

Replace line 9:
```typescript
const ADMIN_EMAIL = 'trucosecomydrop@gmail.com'
```
With:
```typescript
import { isAdmin as isAdminEmail } from '@/lib/admin'
```
And replace `data.user?.email === ADMIN_EMAIL` with `isAdminEmail(data.user?.email)`.

**Step 4: Hide Settings from non-admins in sidebar**

In layout.tsx, the `otherNavigation` array contains Settings. Wrap it so it only shows for admins:
```typescript
const otherNavigation = [
  { name: t.nav.alldropShop, href: '/constructor/', icon: ShoppingBag, external: true },
  ...(isAdminEmail(userEmail) ? [{ name: t.nav.settings, href: '/dashboard/settings', icon: Settings }] : []),
]
```

**Step 5: Commit**
```bash
git add lib/admin.ts app/(dashboard)/layout.tsx app/(dashboard)/dashboard/settings/page.tsx
git commit -m "feat: unify admin emails + hide Settings for non-admins"
```

---

### Task 2: Create consumeDrops service

**Files:**
- Create: `lib/drops/service.ts`

**Step 1: Create the service**

Create `lib/drops/service.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Check if user has enough drops. Admins always return true.
 */
export async function hasEnoughDrops(
  userId: string, 
  email: string | null, 
  cost: number
): Promise<{ enough: boolean; current: number }> {
  if (isAdmin(email)) return { enough: true, current: 999999 }
  
  const { data } = await supabase
    .from('profiles')
    .select('drops')
    .eq('id', userId)
    .single()
  
  const current = data?.drops || 0
  return { enough: current >= cost, current }
}

/**
 * Deduct drops after successful generation. Admins skip deduction.
 * Returns new balance.
 */
export async function consumeDrops(
  userId: string,
  email: string | null,
  amount: number,
  type: 'image' | 'video' | 'banner' | 'tool'
): Promise<number> {
  if (isAdmin(email)) return 999999

  const { data: profile } = await supabase
    .from('profiles')
    .select('drops')
    .eq('id', userId)
    .single()

  const current = profile?.drops || 0
  const newBalance = Math.max(0, current - amount)

  await supabase
    .from('profiles')
    .update({ drops: newBalance })
    .eq('id', userId)

  await supabase
    .from('credit_transactions')
    .insert({
      user_id: userId,
      amount: -amount,
      type: `consume_${type}`,
    })

  return newBalance
}
```

**Step 2: Update DROP_COSTS in constants.ts**

The current costs are: banner=9, image=18, video=250. Per user request, image generation = 9 drops (not 18). Update:
```typescript
export const DROP_COSTS = {
  image: 9,
  video: 250,
} as const
```

**Step 3: Commit**
```bash
git add lib/drops/service.ts lib/drops/constants.ts
git commit -m "feat: create consumeDrops service + update drop costs"
```

---

### Task 3: Add drop deduction to generate-image route

**Files:**
- Modify: `app/api/studio/generate-image/route.ts`

**Step 1: Add drops check + deduction**

At the top of the POST handler, after auth check, add:
```typescript
import { hasEnoughDrops, consumeDrops } from '@/lib/drops/service'
import { DROP_COSTS } from '@/lib/drops/constants'
```

Before image generation starts:
```typescript
const { enough } = await hasEnoughDrops(user.id, user.email, DROP_COSTS.image)
if (!enough) {
  return NextResponse.json({ error: 'Insufficient drops' }, { status: 402 })
}
```

After successful generation (right before returning success response):
```typescript
await consumeDrops(user.id, user.email, DROP_COSTS.image, 'image')
```

**Step 2: Commit**
```bash
git add app/api/studio/generate-image/route.ts
git commit -m "feat: deduct drops on image generation"
```

---

### Task 4: Add drop deduction to generate-video route

**Files:**
- Modify: `app/api/studio/generate-video/route.ts`

**Step 1: Same pattern as Task 3 but with DROP_COSTS.video (250)**

Before video task creation:
```typescript
const { enough } = await hasEnoughDrops(user.id, user.email, DROP_COSTS.video)
if (!enough) {
  return NextResponse.json({ error: 'Insufficient drops' }, { status: 402 })
}
```

After successful video generation (when status polling returns completed):
```typescript
await consumeDrops(user.id, user.email, DROP_COSTS.video, 'video')
```

**Note:** Video generation is async (creates task, polls). The deduction should happen when the video-status endpoint detects completion, OR at task creation time. Since user wants deduction AFTER success, and video polling happens client-side, deduct at task creation but refund if it fails. Alternative: deduct at creation (simpler).

**Decision:** Deduct at video task creation (since we can't deduct during client-side polling). The DROP_COSTS.video cost is the price of attempting generation.

**Step 2: Commit**
```bash
git add app/api/studio/generate-video/route.ts
git commit -m "feat: deduct drops on video generation"
```

---

### Task 5: Add drop deduction to tools route

**Files:**
- Modify: `app/api/studio/tools/route.ts`

**Step 1: Add drops check at the start of POST handler**

Tools that generate images (variations, upscale, remove-bg, camera-angle, mockup) cost DROP_COSTS.image (9).
Tools that generate video (lip-sync, deep-face) cost DROP_COSTS.video (250).
Calculadora = free (not in this route).

```typescript
const videoCostTools = ['lip-sync', 'deep-face']
const dropCost = videoCostTools.includes(toolType) ? DROP_COSTS.video : DROP_COSTS.image

const { enough } = await hasEnoughDrops(user.id, user.email, dropCost)
if (!enough) {
  return NextResponse.json({ error: 'Insufficient drops' }, { status: 402 })
}
```

After successful tool execution (before returning result):
```typescript
await consumeDrops(user.id, user.email, dropCost, videoCostTools.includes(toolType) ? 'video' : 'tool')
```

**Step 2: Commit**
```bash
git add app/api/studio/tools/route.ts
git commit -m "feat: deduct drops on tool usage"
```

---

### Task 6: Add drop deduction to other AI routes

**Files:**
- Modify: `app/api/generate-landing/route.ts` (banner generation — 9 drops per banner)
- Modify: `app/api/edit-section/route.ts` (section edit — 9 drops)
- Modify: `app/api/studio/generate-audio/route.ts` (removed from UI but still accessible — block it)

**Step 1: Same pattern for each route**

generate-landing: deduct DROP_COSTS.image per banner generated.
edit-section: deduct DROP_COSTS.image per edit.
generate-audio: return 404 or "feature disabled".

**Step 2: Commit**
```bash
git commit -m "feat: deduct drops on landing/edit routes"
```

---

### Task 7: Frontend gate — insufficient drops error

**Files:**
- Modify: `lib/i18n/translations.ts` (add error message in 6 languages)
- Modify: `components/studio/ImageGenerator.tsx`
- Modify: `components/studio/VideoGenerator.tsx`
- Modify: `components/studio/ToolsGrid.tsx`
- Modify: `components/studio/DropshippingGrid.tsx`

**Step 1: Add translation key**

In all 6 languages under `studio`:
```typescript
insufficientDrops: 'No tienes saldo suficiente para usar esta herramienta',
// EN: 'You don\'t have enough drops to use this tool'
// FR: 'Vous n\'avez pas assez de drops pour utiliser cet outil'
// etc.
```

**Step 2: Handle 402 response in each generator**

In the catch/error handler of each generate function, check for status 402:
```typescript
if (err.response?.status === 402) {
  toast.error(t.studio.insufficientDrops)
  return
}
```

**Step 3: Refresh drops balance after successful generation**

After successful generation, fetch updated drops from the API and update the sidebar balance. This requires either:
- A drops context/provider that can be refreshed
- Or re-fetching the profile after each generation

**Step 4: Commit**
```bash
git commit -m "feat: frontend insufficient drops error + balance refresh"
```

---

### Task 8: Connect alldrop.io domain

**Step 1: Add domain in Vercel dashboard**

Go to Vercel → Project alldrop → Settings → Domains → Add `alldrop.io` and `www.alldrop.io`.

**Step 2: Update DNS records**

Point alldrop.io A record to Vercel's IP (76.76.21.21) or CNAME to cname.vercel-dns.com.

**Step 3: Verify in Vercel dashboard**

Wait for SSL certificate provisioning.

**Step 4: Commit any vercel.json changes if needed**

---

## File Reference

| File | Purpose |
|------|---------|
| `lib/admin.ts` | ADMIN_EMAILS constant + isAdmin() |
| `lib/drops/constants.ts` | DROP_COSTS, PLANS, TOPUPS |
| `lib/drops/service.ts` | consumeDrops(), hasEnoughDrops() |
| `app/api/studio/generate-image/route.ts` | Image generation + drops |
| `app/api/studio/generate-video/route.ts` | Video generation + drops |
| `app/api/studio/tools/route.ts` | Tools + drops |
| `app/(dashboard)/layout.tsx` | Sidebar admin gate |
| `app/(dashboard)/dashboard/settings/page.tsx` | Settings admin gate |
| `lib/i18n/translations.ts` | insufficientDrops message |
