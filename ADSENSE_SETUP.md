# Google AdSense Integration Setup Guide

## Overview

This guide explains how to configure and use the Google AdSense integration in the Ultimate Computer Software technology news platform. The system allows administrators to store and manage AdSense codes from the admin dashboard without hardcoding them into the application.

## Implementation Summary

### Database Changes

A new `AdSenseConfig` model was added to `prisma/schema.prisma`:

```prisma
model AdSenseConfig {
  id                    String    @id @default(cuid())
  displayName           String    @unique
  code                  String
  placement             String    // 'homepage', 'article', 'dashboard', 'sidebar'
  isActive              Boolean   @default(true)
  adType                String    @default("display") // 'display', 'in-feed', 'matched-content'
  width                 Int?
  height                Int?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@index([placement])
  @@index([isActive])
  @@map("adsense_configs")
}
```

The migration has been applied to your database.

### Backend API Endpoints

#### Admin Endpoints (ADMIN role only)

- **GET** `/api/admin/adsense` - Retrieve all AdSense configurations
- **POST** `/api/admin/adsense` - Create a new AdSense configuration
- **PUT** `/api/admin/adsense/:id` - Update an existing configuration
- **DELETE** `/api/admin/adsense/:id` - Delete a configuration

#### Public Endpoint

- **GET** `/api/config/adsense` - Retrieve only active AdSense configurations (public)

### Backend Files Modified/Created

1. **backend/prisma/schema.prisma** - Added AdSenseConfig model
2. **backend/src/controllers/adminController.ts** - Added 4 new functions:
   - `getAdSenseConfigs()` - Fetch all configs
   - `createAdSenseConfig()` - Create new config
   - `updateAdSenseConfig()` - Update config
   - `deleteAdSenseConfig()` - Delete config

3. **backend/src/routes/admin.ts** - Added 4 new routes for AdSense management
4. **backend/src/routes/config.ts** - NEW: Public route for fetching active configurations
5. **backend/src/app.ts** - Registered new config routes

### Frontend Components

#### New Component: AdBanner

**Location:** `frontend/src/components/AdBanner.tsx`

This is a reusable component that:
- Fetches active AdSense configurations from `/api/config/adsense`
- Filters configurations by placement type
- Dynamically loads Google AdSense script
- Renders the ad code safely using `dangerouslySetInnerHTML`
- Handles loading and error states gracefully

**Usage:**
```tsx
<AdBanner placement="homepage" className="my-8" />
```

**Props:**
- `placement`: Required. One of: `'homepage' | 'article' | 'dashboard' | 'sidebar'`
- `className`: Optional. CSS classes to apply to the container

#### New Page: AdminAdsense

**Location:** `frontend/src/pages/admin/AdminAdsense.tsx`

Admin interface for managing AdSense codes. Features:
- View all AdSense configurations
- Create new configurations
- Edit existing configurations
- Delete configurations
- Toggle configurations on/off (active/inactive)
- Form validation with error messages
- Responsive design

### Frontend Pages Updated

1. **HomePage** - AdBanner added with placement="homepage"
2. **ArticlePage** - AdBanner added with placement="article"
3. **DashboardHome** - AdBanner added with placement="dashboard"

### Frontend Routing

Added new admin route:
- `/admin/adsense` - AdSense management page (ADMIN only)

### Admin Navigation

Updated **AdminLayout** to include AdSense in the sidebar navigation with a Megaphone icon.

## How to Use

### Step 1: Start Your Application

Make sure both frontend and backend are running:

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### Step 2: Access Admin AdSense Page

1. Log in to your admin account
2. Navigate to `/admin/adsense` or click "AdSense" in the admin sidebar

### Step 3: Create AdSense Configuration

1. Click "Add New Configuration"
2. Fill in the form:
   - **Display Name**: A descriptive name (e.g., "Homepage Top Banner")
   - **Placement**: Choose where the ad should appear
     - `homepage` - Top of homepage
     - `article` - Within article pages
     - `dashboard` - User dashboard
     - `sidebar` - Sidebar placements
   - **Ad Type**: Type of AdSense ad
     - `display` - Standard display ads
     - `in-feed` - In-feed ads
     - `matched-content` - Matched content ads
   - **Width** (optional): Ad width in pixels
   - **Height** (optional): Ad height in pixels
   - **AdSense Code**: Full Google AdSense code (copy from Google AdSense console)

3. Click "Create"

### Step 4: Configure Google AdSense Code

To get your AdSense code:

1. Log in to [Google AdSense](https://www.google.com/adsense/start/)
2. Go to **Ads** → **By placement** or **Ad units**
3. Create or select an ad unit
4. Copy the complete ad code snippet
5. Paste it into the "AdSense Code" field in the admin panel

Example AdSense code:
```html
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX"></script>
<!-- Example Ad -->
<ins class="adsbygoogle"
     style="display:block"
     data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
     data-ad-slot="1234567890"
     data-ad-format="auto"
     data-full-width-responsive="true"></ins>
<script>
     (adsbygoogle = window.adsbygoogle || []).push({});
</script>
```

### Step 5: Manage Configurations

- **Edit**: Click "Edit" to modify a configuration
- **Toggle Active**: Click "Active"/"Inactive" to enable/disable without deleting
- **Delete**: Click "Delete" to permanently remove a configuration

## How It Works

### Frontend Flow

1. User visits a page (homepage, article, or dashboard)
2. `<AdBanner placement="..." />` component mounts
3. Component fetches active configs from `/api/config/adsense`
4. Filters configs by matching placement
5. Loads Google AdSense script dynamically (once per page)
6. Renders the ad code in a safe container

### Backend Flow

1. Admin submits form in AdminAdsense page
2. Frontend makes API call to `/api/admin/adsense` (POST/PUT/DELETE)
3. Backend validates input:
   - Required fields check
   - Unique displayName check
   - Valid placement check
   - Valid adType check
4. Database is updated
5. Frontend refetches configs list
6. Public endpoint `/api/config/adsense` automatically includes the new config for frontend display

### Security Considerations

1. **Admin-only endpoints**: All write operations are protected by ADMIN role authorization
2. **Public endpoint**: Only returns active configs, is safe for public access
3. **XSS Protection**: AdSense code is rendered via `dangerouslySetInnerHTML` (safe because admin creates the content)
4. **Input Validation**: All admin inputs are validated on both frontend and backend

## Troubleshooting

### Ads not showing on page

1. **Check if configuration exists**: Visit `/admin/adsense` and verify configs are created
2. **Check if active**: Make sure the configuration has "Active" status
3. **Check placement**: Verify placement matches the page (homepage, article, dashboard)
4. **Check AdSense code**: Ensure the code snippet is correct from Google AdSense console
5. **Check client ID**: The `client=ca-pub-XXXXXXXXXXXXXXXX` in the code must be valid
6. **Browser console**: Check browser console for any JavaScript errors
7. **Network tab**: Verify `/api/config/adsense` request succeeds and returns configs

### Form validation errors

- **"Display name already exists"**: Each display name must be unique. Edit the existing one instead or use a different name.
- **"Display name is required"**: Cannot be empty
- **"AdSense code is required"**: Cannot be empty
- **"Valid placement is required"**: Select a valid placement from dropdown

### AdSense script already loaded

The AdBanner component checks if the AdSense script is already loaded and will only load it once per page, even if multiple AdBanner components exist. This prevents duplicate script loading.

## Best Practices

1. **Use descriptive display names**: e.g., "Homepage Top Banner", "Article Post" instead of "Ad 1"
2. **Different ads for different placements**: Create separate configurations for each placement with appropriately sized ads
3. **Start with one placement**: Test with homepage first, then add to other pages
4. **Check ad sizes**: Common sizes:
   - Homepage banner: 728×90, 300×250
   - Article content: 300×250, 336×280
   - Sidebar: 300×250, 160×600
5. **Google AdSense policies**: Ensure your content and ad placements comply with Google AdSense policies
6. **Monitor performance**: Use Google AdSense reporting to track earnings and performance

## API Request Examples

### Create AdSense Configuration

```bash
curl -X POST http://localhost:4000/api/admin/adsense \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Homepage Top Banner",
    "code": "<script>...</script>",
    "placement": "homepage",
    "adType": "display",
    "width": 728,
    "height": 90
  }'
```

### Get All Configurations (Admin)

```bash
curl -X GET http://localhost:4000/api/admin/adsense \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get Active Configurations (Public)

```bash
curl -X GET http://localhost:4000/api/config/adsense
```

### Update Configuration

```bash
curl -X PUT http://localhost:4000/api/admin/adsense/ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "isActive": false
  }'
```

### Delete Configuration

```bash
curl -X DELETE http://localhost:4000/api/admin/adsense/ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Future Enhancements

Possible improvements to consider:

1. **A/B Testing**: Store multiple ads for same placement, randomly serve them
2. **Performance Analytics**: Track ad impressions and earnings directly in the admin panel
3. **Scheduled Deployment**: Schedule ads to go live at specific dates/times
4. **Placement Groups**: Group related placements together
5. **Fallback Ads**: Specify fallback ads if primary ad fails to load
6. **Custom CSS**: Allow admins to add custom styling to ad containers
7. **Ad Networks**: Support for other ad networks (AdX, Mediavine, etc.)

## Support

For issues or questions about the AdSense integration:

1. Check the troubleshooting section above
2. Review Google AdSense documentation: https://support.google.com/adsense
3. Check browser console for JavaScript errors
4. Verify network requests in DevTools
5. Ensure your Google AdSense account is approved and has active ads
