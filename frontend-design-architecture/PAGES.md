# Page Specifications

## 8. Page-by-Page Design Specifications

### 8.1 Homepage / Marketplace (`/`)

**Layout**: Full-width with sidebar navigation

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Logo]  [Search...]                              [Create] [Connect]      │
├────────┬────────────────────────────────────────────────────────────────┤
│        │ ┌──────────────────────────────────────────────────────────┐   │
│ Home   │ │           🔥 Trending Now                                 │   │
│        │ │  [Token] [Token] [Token] [Token] [Token] →                │   │
│ New    │ └──────────────────────────────────────────────────────────┘   │
│        │                                                                 │
│ Grad.  │ ┌──────────────────────────────────────────────────────────┐   │
│        │ │ Filters: [All] [Trading] [Graduated]   Sort: [Trending ▼] │   │
│ Leader │ └──────────────────────────────────────────────────────────┘   │
│ board  │                                                                 │
│        │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                    │
│ Port-  │ │ Token  │ │ Token  │ │ Token  │ │ Token  │                    │
│ folio  │ │ Card   │ │ Card   │ │ Card   │ │ Card   │                    │
│        │ │        │ │        │ │        │ │        │                    │
│        │ └────────┘ └────────┘ └────────┘ └────────┘                    │
│        │                                                                 │
│        │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                    │
│        │ │ Token  │ │ Token  │ │ Token  │ │ Token  │                    │
│        │ │ Card   │ │ Card   │ │ Card   │ │ Card   │                    │
│        │ └────────┘ └────────┘ └────────┘ └────────┘                    │
│        │                                                                 │
│        │              [Load More / Infinite Scroll]                      │
└────────┴────────────────────────────────────────────────────────────────┘
```

**Components**:
- `Sidebar` - Fixed navigation
- `Header` - Search bar, Create button, Wallet connect
- `TrendingCarousel` - Horizontal scroll of top 10 trending tokens
- `FilterBar` - Status filter, sort options
- `TokenGrid` - Virtualized grid of token cards
- `LiveTradeBanner` - Scrolling ticker of recent trades

**Data Requirements**:
```typescript
// API Calls
GET /tokens/trending         // Top 10 for carousel (cached 30s)
GET /tokens?page=1&limit=24  // Paginated token list

// WebSocket Subscriptions
- Global room: 'token_created' events
- Global room: 'price_update' for trending tokens

// State
- tokenStore.prices (real-time price updates)
- React Query cache for token lists
```

**Performance Targets**:
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3s
- Token cards visible: 8 above fold

---

### 8.2 Token Detail Page (`/token/[address]`)

**Layout**: Three-column layout on desktop, stacked on mobile

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ← Back   [Token Name] ($SYMBOL)   [Share] [★ Favorite]   [Connect]      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│ ┌─────────────────────────────────────────┐ ┌─────────────────────────┐ │
│ │                                         │ │  💰 TRADE               │ │
│ │                                         │ │  ┌─────────────────────┐│ │
│ │         PRICE CHART                     │ │  │ [Buy] [Sell]        ││ │
│ │         (Lightweight Charts)            │ │  └─────────────────────┘│ │
│ │                                         │ │                         │ │
│ │  [1m] [5m] [15m] [1h] [4h] [1d]         │ │  Amount (PUSH)          │ │
│ │                                         │ │  ┌─────────────────────┐│ │
│ │                                         │ │  │ 0.0          [MAX] ││ │
│ │                                         │ │  └─────────────────────┘│ │
│ └─────────────────────────────────────────┘ │                         │ │
│                                             │  You receive: ~50,000   │ │
│ ┌──────────────────────────────────────┐    │  Price impact: 0.5%     │ │
│ │ Price: $0.00042  (+12.5% 24h)        │    │  Slippage: 2%          │ │
│ │ MCap: 420K PUSH  │ Vol: 50K PUSH     │    │                         │ │
│ │ Holders: 156     │ Txns: 1,204       │    │  ┌─────────────────────┐│ │
│ └──────────────────────────────────────┘    │  │    BUY $SYMBOL      ││ │
│                                             │  └─────────────────────┘│ │
│ ┌──────────────────────────────────────┐    │                         │ │
│ │ [Trades] [Holders] [Info]            │    │  Your balance: 0       │ │
│ ├──────────────────────────────────────┤    └─────────────────────────┘ │
│ │ 🟢 0x1234...5678 bought 5,000       │                                │
│ │    0.5 PUSH • 2m ago                │                                │
│ │ 🔴 0xabcd...efgh sold 10,000        │                                │
│ │    1.2 PUSH • 5m ago                │                                │
│ │ 🟢 0x9876...5432 bought 25,000      │                                │
│ │    2.1 PUSH • 8m ago                │                                │
│ └──────────────────────────────────────┘                                │
│                                                                          │
│ ┌──────────────────────────────────────────────────────────────────────┐│
│ │ 📊 GRADUATION PROGRESS                                    85% 🎓    ││
│ │ ████████████████████████████████░░░░░░                              ││
│ │ Market Cap: 850K / 1M PUSH                                          ││
│ └──────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

**Components**:
- `TokenHeader` - Name, symbol, share/favorite buttons
- `PriceChart` - Candlestick chart with interval selector
- `TokenStats` - Price, market cap, volume, holders, txns
- `TradingPanel` - Buy/Sell form with slippage settings
- `ActivityTabs` - Trades, Holders, Info tabs
- `TradeHistory` - Virtualized list of recent trades
- `HoldersList` - Top holders with percentage
- `TokenInfo` - Description, links, creator info
- `GraduationProgress` - Progress bar to DEX listing

**Data Requirements**:
```typescript
// API Calls
GET /tokens/:address                          // Token details
GET /tokens/:address/price-history?interval=1h // Chart data
GET /tokens/:address/trades?page=1&limit=50   // Trade history
GET /tokens/:address/holders?page=1&limit=20  // Holder list

// WebSocket Subscriptions
socket.emit('subscribe:token', { tokenAddress })
socket.emit('subscribe:recent', { tokenAddress })

// Events listened:
- 'price_update': Update chart, stats
- 'trade': Add to trade history
- 'new_trade': Real-time trade feed
- 'token_graduated': Show graduation modal
- 'token_listed': Redirect to DEX

// Contract Reads (for user-specific data)
Token.balanceOf(userAddress)        // User's token balance
WPUSH.balanceOf(userAddress)        // User's PUSH balance
Core.getAmountOut(...)              // Price calculation
```

**Performance Targets**:
- Chart visible: < 2s
- Trade history loaded: < 1s
- Trade execution feedback: < 200ms

---

### 8.3 Create Token Page (`/launch`)

**Layout**: Two-column with live preview

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ← Back                    Create Your Token                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│ ┌─────────────────────────────────┐ ┌─────────────────────────────────┐ │
│ │                                 │ │      LIVE PREVIEW               │ │
│ │  Token Name *                   │ │  ┌─────────────────────────────┐│ │
│ │  ┌───────────────────────────┐  │ │  │                             ││ │
│ │  │ My Awesome Token          │  │ │  │      [Token Image]          ││ │
│ │  └───────────────────────────┘  │ │  │                             ││ │
│ │                                 │ │  │   My Awesome Token          ││ │
│ │  Symbol *                       │ │  │      $AWESOME               ││ │
│ │  ┌───────────────────────────┐  │ │  │                             ││ │
│ │  │ AWESOME                   │  │ │  │   Price: ~0.00002 PUSH      ││ │
│ │  └───────────────────────────┘  │ │  │   MCap: ~1 PUSH             ││ │
│ │                                 │ │  │                             ││ │
│ │  Description                    │ │  └─────────────────────────────┘│ │
│ │  ┌───────────────────────────┐  │ │                                 │ │
│ │  │ The most awesome token   │  │ │  ┌─────────────────────────────┐│ │
│ │  │ on Push Chain!            │  │ │  │ BONDING CURVE PREVIEW       ││ │
│ │  └───────────────────────────┘  │ │  │                             ││ │
│ │                                 │ │  │   [Simple curve graphic]    ││ │
│ │  Token Image                    │ │  │                             ││ │
│ │  ┌───────────────────────────┐  │ │  │ • Supply: 1 billion         ││ │
│ │  │  [Drop image or click]    │  │ │  │ • Grad at: 1M PUSH MCap     ││ │
│ │  │        📷                 │  │ │  │ • Platform fee: 1%          ││ │
│ │  └───────────────────────────┘  │ │  └─────────────────────────────┘│ │
│ │                                 │ │                                 │ │
│ │  Social Links (optional)        │ │                                 │ │
│ │  Twitter: [________________]    │ │                                 │ │
│ │  Telegram: [_______________]    │ │                                 │ │
│ │  Website: [________________]    │ │                                 │ │
│ │                                 │ │                                 │ │
│ │  Initial Buy (optional)         │ │                                 │ │
│ │  ┌───────────────────────────┐  │ │                                 │ │
│ │  │ 0.1 PUSH                  │  │ │                                 │ │
│ │  └───────────────────────────┘  │ │                                 │ │
│ │  Be the first buyer!            │ │                                 │ │
│ │                                 │ │                                 │ │
│ │  ┌───────────────────────────┐  │ │                                 │ │
│ │  │  🚀 CREATE TOKEN          │  │ │                                 │ │
│ │  │  Deploy Fee: 0.01 PUSH    │  │ │                                 │ │
│ │  └───────────────────────────┘  │ │                                 │ │
│ │                                 │ │                                 │ │
│ └─────────────────────────────────┘ └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

**Components**:
- `CreateTokenForm` - Form with validation
- `ImageUploader` - Drag & drop with preview, IPFS upload
- `LivePreview` - Real-time preview card
- `BondingCurveInfo` - Explanation of mechanics
- `CreateButton` - With fee display and loading state

**Form Validation**:
```typescript
const schema = z.object({
  name: z.string().min(1).max(32),
  symbol: z.string().min(1).max(10).regex(/^[A-Z0-9]+$/),
  description: z.string().max(500).optional(),
  image: z.instanceof(File).optional(),
  twitter: z.string().url().optional().or(z.literal('')),
  telegram: z.string().url().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  initialBuy: z.string().regex(/^\d*\.?\d*$/).optional(),
});
```

**Flow**:
1. User fills form → Live preview updates
2. User uploads image → IPFS upload in background
3. User clicks Create:
   a. Validate form
   b. Upload metadata JSON to IPFS
   c. Call `Core.createCurve()` with IPFS URI
   d. Show pending transaction toast
   e. On confirmation → Redirect to token page

---

### 8.4 Profile Page (`/profile/[address]`)

**Layout**: User profile with editable header and content tabs

**Routes**:
- `/profile/[address]` - View any user's profile
- `/profile` - Redirects to connected user's profile (if connected)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ← Back                                                    [Connect]      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PROFILE HEADER                                                          │
│ ┌──────────────────────────────────────────────────────────────────────┐│
│ │                                                                      ││
│ │  ┌────────────┐                                                      ││
│ │  │            │   CryptoWhale                      [Edit Profile]    ││
│ │  │   AVATAR   │   0x1234...5678  [Copy]                              ││
│ │  │   (120px)  │                                                      ││
│ │  │            │   ┌────┐ ┌────┐ ┌────┐                               ││
│ │  │  [Upload]  │   │ 𝕏  │ │ ✈️ │ │ 🌐 │  Social links                  ││
│ │  └────────────┘   └────┘ └────┘ └────┘                               ││
│ │                                                                      ││
│ │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐││
│ │  │ Tokens       │ │ Holdings     │ │ Trades       │ │ Fees Earned  │││
│ │  │ Created      │ │              │ │              │ │              │││
│ │  │     5        │ │     12       │ │    156       │ │  2.5 PUSH    │││
│ │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘││
│ └──────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│ ┌──────────────────────────────────────────────────────────────────────┐│
│ │ [Created] [Holdings] [Activity] [Fees]                               ││
│ └──────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│ CREATED TOKENS (5)                                            [View All] │
│ ┌──────────────────────────────────────────────────────────────────────┐│
│ │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐     ││
│ │ │ 🖼          │ │ 🖼          │ │ 🖼          │ │ 🖼          │     ││
│ │ │ $MOON      │ │ $PEPE       │ │ $DEGEN      │ │ $HODL       │     ││
│ │ │ 420K MCap  │ │ 210K MCap   │ │ 150K MCap   │ │ 50K MCap    │     ││
│ │ │ +542% 🟢   │ │ +120% 🟢    │ │ -15% 🔴     │ │ Trading     │     ││
│ │ │ 89 holders │ │ 45 holders  │ │ 32 holders  │ │ 12 holders  │     ││
│ │ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘     ││
│ └──────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│ HOLDINGS (12)                                                 [View All] │
│ ┌──────────────────────────────────────────────────────────────────────┐│
│ │ Token        │ Balance        │ Value        │ Change      │ Action  ││
│ ├──────────────────────────────────────────────────────────────────────┤│
│ │ 🖼 $MOON     │ 1,250,000      │ 5.2 PUSH     │ +145% 🟢    │ [Trade] ││
│ │ 🖼 $PEPE     │ 500,000        │ 2.1 PUSH     │ +50% 🟢     │ [Trade] ││
│ │ 🖼 $WAGMI    │ 800,000        │ 1.8 PUSH     │ +22% 🟢     │ [Trade] ││
│ │ 🖼 $GM       │ 250,000        │ 0.8 PUSH     │ -5% 🔴      │ [Trade] ││
│ └──────────────────────────────────────────────────────────────────────┘│
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Edit Profile Modal**:

```
┌─────────────────────────────────────────────────────┐
│                   Edit Profile                   ✕  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Profile Picture                                    │
│  ┌────────────────────┐                             │
│  │                    │                             │
│  │      [AVATAR]      │  [Upload New]               │
│  │                    │  PNG, JPG, GIF (max 2MB)    │
│  │                    │                             │
│  └────────────────────┘                             │
│                                                     │
│  Display Name                                       │
│  ┌─────────────────────────────────────────────┐   │
│  │ CryptoWhale                                  │   │
│  └─────────────────────────────────────────────┘   │
│  Max 32 characters                                  │
│                                                     │
│  Bio                                                │
│  ┌─────────────────────────────────────────────┐   │
│  │ Building the future of token launches on    │   │
│  │ Push Chain. Creator of $MOON and $PEPE.     │   │
│  └─────────────────────────────────────────────┘   │
│  Max 160 characters                                 │
│                                                     │
│  ─────────── Social Links ───────────              │
│                                                     │
│  Twitter / X                                        │
│  ┌─────────────────────────────────────────────┐   │
│  │ https://twitter.com/cryptowhale             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Telegram                                           │
│  ┌─────────────────────────────────────────────┐   │
│  │ https://t.me/cryptowhale                    │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Website                                            │
│  ┌─────────────────────────────────────────────┐   │
│  │ https://cryptowhale.io                      │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │              Save Changes                    │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  To verify ownership, you'll sign a message         │
│  with your wallet.                                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Tab: Fees (for token creators)**:

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CREATOR FEES                                   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐    │
│  │   Available to Claim        │  │   Total Earned (All Time)   │    │
│  │                             │  │                             │    │
│  │      0.85 PUSH              │  │       3.2 PUSH              │    │
│  │      ≈ $17.00               │  │       ≈ $64.00              │    │
│  │                             │  │                             │    │
│  │  ┌───────────────────────┐  │  │   Already Claimed:          │    │
│  │  │    CLAIM FEES         │  │  │   2.35 PUSH                 │    │
│  │  └───────────────────────┘  │  │                             │    │
│  └─────────────────────────────┘  └─────────────────────────────┘    │
│                                                                       │
│  FEE BREAKDOWN BY TOKEN                                               │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │ Token        │ Total Volume  │ Fees Earned  │ Your Share      │   │
│  ├───────────────────────────────────────────────────────────────┤   │
│  │ 🖼 $MOON     │ 150K PUSH     │ 1.5 PUSH     │ 0.45 PUSH (30%)│   │
│  │ 🖼 $PEPE     │ 89K PUSH      │ 0.89 PUSH    │ 0.27 PUSH      │   │
│  │ 🖼 $DEGEN    │ 45K PUSH      │ 0.45 PUSH    │ 0.13 PUSH      │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  HOW CREATOR FEES WORK                                                │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │  • 1% fee on every trade                                      │   │
│  │  • 30% of fees go to token creator                            │   │
│  │  • Fees accumulate automatically                              │   │
│  │  • Claim anytime with no minimum                              │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Components**:
- `ProfileHeader` - Avatar, name, address, social links, stats
- `ProfileEditModal` - Form for editing profile
- `AvatarUpload` - Image upload with preview, crop, IPFS upload
- `SocialLinks` - Display/edit social media links
- `ProfileStats` - Stats cards (tokens created, holdings, trades, fees)
- `CreatedTokensGrid` - Grid of tokens user created
- `HoldingsTable` - Token holdings with value
- `ActivityFeed` - Recent trades and actions
- `CreatorFeesPanel` - Fee breakdown and claim button

**Data Requirements**:

```typescript
// API Calls
GET /users/:address                   // User profile (name, avatar, socials)
GET /users/:address/holdings          // Token holdings
GET /users/:address/created-tokens    // Tokens created by user
GET /users/:address/trades            // Trade history
PUT /users/:address/profile           // Update profile (authenticated)

// Request body for profile update:
{
  displayName: string;        // Max 32 chars
  bio: string;                // Max 160 chars
  avatarUri: string;          // IPFS URI
  twitter: string | null;     // Full URL or null
  telegram: string | null;
  website: string | null;
}

// Contract Reads
Factory.getCreatorFeeShare()            // Fee percentage
Factory.getAccumulatedFees(address)     // Unclaimed fees

// WebSocket
socket.emit('subscribe:wallet', { walletAddress })
- 'my_trade': Update when trade confirms
```

**Profile Form Validation**:

```typescript
// src/lib/validation/profile.ts
import { z } from 'zod';

export const profileSchema = z.object({
  displayName: z.string()
    .min(1, 'Name is required')
    .max(32, 'Name must be 32 characters or less')
    .regex(/^[a-zA-Z0-9_\-\s]+$/, 'Only letters, numbers, spaces, - and _'),

  bio: z.string()
    .max(160, 'Bio must be 160 characters or less')
    .optional(),

  avatarUri: z.string()
    .url('Invalid avatar URL')
    .optional()
    .or(z.literal('')),

  twitter: z.string()
    .url('Invalid Twitter URL')
    .regex(/^https?:\/\/(www\.)?(twitter\.com|x\.com)\//, 'Must be a Twitter/X URL')
    .optional()
    .or(z.literal('')),

  telegram: z.string()
    .url('Invalid Telegram URL')
    .regex(/^https?:\/\/(www\.)?t\.me\//, 'Must be a Telegram URL')
    .optional()
    .or(z.literal('')),

  website: z.string()
    .url('Invalid website URL')
    .optional()
    .or(z.literal('')),
});

export type ProfileFormData = z.infer<typeof profileSchema>;
```

**Profile Update Flow**:

1. User clicks "Edit Profile"
2. Modal opens with current values populated
3. User makes changes (name, bio, avatar, socials)
4. If avatar changed → Upload to IPFS in background
5. User clicks "Save Changes"
6. Frontend requests signature from wallet:
   ```
   Sign this message to update your profile on Hodl.fun:

   Timestamp: 1706380800
   Address: 0x1234...5678
   ```
7. Send signed message + profile data to API
8. Backend verifies signature matches address
9. Profile saved to database
10. UI updates optimistically

**Profile Avatar Component**:

```typescript
// src/components/profile/AvatarUpload.tsx
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { uploadToIPFS } from '@/lib/ipfs';
import { Avatar, Button, Spinner } from '@/components/ui';

interface AvatarUploadProps {
  currentUri?: string;
  onUpload: (uri: string) => void;
  editable?: boolean;
}

export function AvatarUpload({ currentUri, onUpload, editable = true }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Validate file
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    // Show preview
    setPreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      const uri = await uploadToIPFS(file);
      onUpload(uri);
      toast.success('Avatar uploaded!');
    } catch (error) {
      toast.error('Failed to upload avatar');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif'] },
    maxFiles: 1,
    disabled: !editable || uploading,
  });

  const displayUri = preview || currentUri;

  return (
    <div className="relative">
      <div
        {...getRootProps()}
        className={cn(
          'relative w-32 h-32 rounded-full overflow-hidden',
          'border-2 border-dashed border-border',
          'transition-colors cursor-pointer',
          isDragActive && 'border-primary bg-primary/10',
          editable && 'hover:border-primary',
        )}
      >
        <input {...getInputProps()} />

        {displayUri ? (
          <Avatar src={displayUri} size="xl" className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-surface-2">
            <span className="text-4xl text-text-muted">👤</span>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Spinner size="lg" />
          </div>
        )}

        {editable && !uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity">
            <span className="text-white text-sm">Change</span>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Social Links Display Component**:

```typescript
// src/components/profile/SocialLinks.tsx
import { Twitter, Send, Globe } from 'lucide-react';

interface SocialLinksProps {
  twitter?: string | null;
  telegram?: string | null;
  website?: string | null;
}

export function SocialLinks({ twitter, telegram, website }: SocialLinksProps) {
  const links = [
    { icon: Twitter, url: twitter, label: 'Twitter' },
    { icon: Send, url: telegram, label: 'Telegram' },
    { icon: Globe, url: website, label: 'Website' },
  ].filter(link => link.url);

  if (links.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {links.map(({ icon: Icon, url, label }) => (
        <a
          key={label}
          href={url!}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center',
            'bg-surface-2 text-text-secondary',
            'hover:bg-primary hover:text-white',
            'transition-colors'
          )}
          title={label}
        >
          <Icon size={18} />
        </a>
      ))}
    </div>
  );
}
```

---

### 8.5 Leaderboard Page (`/leaderboard`)

**Layout**: Tabbed leaderboards

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           🏆 LEADERBOARD                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│ ┌──────────────────────────────────────────────────────────────────────┐│
│ │ [Top Gainers] [Top Volume] [Most Holders] [Top Traders]              ││
│ └──────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│ 🚀 TOP GAINERS (24H)                                                     │
│ ┌──────────────────────────────────────────────────────────────────────┐│
│ │ Rank │ Token       │ Price        │ 24h Change  │ MCap       │ Vol   ││
│ ├──────────────────────────────────────────────────────────────────────┤│
│ │ 🥇 1 │ 🖼 $MOON    │ 0.00042      │ +542% 🟢    │ 420K       │ 150K  ││
│ │ 🥈 2 │ 🖼 $PEPE    │ 0.00021      │ +320% 🟢    │ 210K       │ 89K   ││
│ │ 🥉 3 │ 🖼 $DEGEN   │ 0.00015      │ +180% 🟢    │ 150K       │ 45K   ││
│ │   4  │ 🖼 $HODL    │ 0.00012      │ +120% 🟢    │ 120K       │ 32K   ││
│ │   5  │ 🖼 $WAGMI   │ 0.00010      │ +95% 🟢     │ 100K       │ 28K   ││
│ │  ... │ ...         │ ...          │ ...         │ ...        │ ...   ││
│ │  20  │ 🖼 $GM      │ 0.00005      │ +45% 🟢     │ 50K        │ 12K   ││
│ └──────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│ Time Filter: [1H] [24H] [7D] [30D] [All Time]                           │
└─────────────────────────────────────────────────────────────────────────┘
```

**Tabs**:
1. **Top Gainers** - Highest % price increase
2. **Top Volume** - Highest trading volume
3. **Most Holders** - Most unique holders
4. **Top Traders** - Users with highest P&L

---

## 9. Mobile Responsive Design

### 9.1 Breakpoints

```css
/* TailwindCSS Breakpoints */
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large */
```

### 9.2 Mobile Navigation

```
Mobile Layout (< 768px):
┌────────────────────────────────┐
│ [☰]  HODL.fun     [🔔] [👤]   │
├────────────────────────────────┤
│                                │
│  Content area                  │
│  (Full width)                  │
│                                │
├────────────────────────────────┤
│ [🏠] [🔥] [➕] [📊] [👤]      │
│ Home  Hot Create Stats Profile │
└────────────────────────────────┘
```

### 9.3 Mobile Token Detail

```
Mobile Token Page:
┌────────────────────────────────┐
│ ← $TOKEN                [⋮]   │
├────────────────────────────────┤
│ ┌────────────────────────────┐ │
│ │      PRICE CHART           │ │
│ │      (Full width)          │ │
│ └────────────────────────────┘ │
│                                │
│ Price: 0.00042 PUSH (+12%)    │
│ MCap: 420K │ Vol: 50K         │
│                                │
│ ┌────────────────────────────┐ │
│ │  [BUY]        [SELL]       │ │
│ └────────────────────────────┘ │
│                                │
│ [Trades] [Holders] [Info]      │
│ ┌────────────────────────────┐ │
│ │ Trade history list         │ │
│ │ (Scrollable)               │ │
│ └────────────────────────────┘ │
└────────────────────────────────┘
```

### 9.4 Touch Optimizations

```typescript
// Larger touch targets on mobile
const mobileButtonClass = `
  min-h-[44px] min-w-[44px]  /* Apple HIG minimum */
  touch-manipulation          /* Disable double-tap zoom */
`;

// Swipe gestures
// - Swipe left/right on token cards for quick actions
// - Pull-to-refresh on token lists
// - Swipe to dismiss toasts
```
