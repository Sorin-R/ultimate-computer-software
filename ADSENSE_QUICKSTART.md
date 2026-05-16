# Google AdSense Integration - Quick Start Guide

## ⚡ 5-Minute Setup

### Step 1: Start Your Application
```bash
# Terminal 1 - Start Backend
cd backend
npm run dev

# Terminal 2 - Start Frontend  
cd frontend
npm run dev
```

Both should be running:
- Backend: http://localhost:4000
- Frontend: http://localhost:5173

### Step 2: Log in as Admin
1. Go to http://localhost:5173/login
2. Log in with your admin account
3. You should see admin menu in the navbar

### Step 3: Go to AdSense Management
- Click **Admin** in the navbar
- Click **AdSense** in the sidebar (with 📢 icon)
- Or go directly to: http://localhost:5173/admin/adsense

### Step 4: Create Your First Ad Configuration
1. Click **Add New Configuration** button
2. Fill in the form:
   ```
   Display Name: Homepage Top Banner
   Placement: homepage
   Ad Type: display
   Width: 728 (optional)
   Height: 90 (optional)
   AdSense Code: [Paste your code here]
   ```
3. Click **Create**

### Step 5: See Your Ad
- Go to homepage: http://localhost:5173
- You should see the ad below the featured article

---

## 🔄 Where Ads Appear

| Page | Location |
|------|----------|
| **Homepage** | Between featured article and "Latest News" section |
| **Article Page** | After article content, before tags |
| **Dashboard** | After statistics cards, before "Recent Articles" |

---

## 📝 Getting Google AdSense Code

1. Go to [Google AdSense](https://www.google.com/adsense/)
2. Sign in to your account
3. Go to **Ads** → **By placement**
4. Click **Create new ad unit**
5. Choose your ad type and size
6. Click **Create**
7. Copy the full code snippet (looks like the example below)
8. Paste into the **AdSense Code** field in your admin panel

### Example AdSense Code:
```html
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX"></script>
<!-- Homepage Top Banner -->
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

Replace `ca-pub-XXXXXXXXXXXXXXXX` and `1234567890` with your actual values from Google AdSense.

---

## 🎯 Common Ad Sizes

**Homepage & Article Pages:**
- 728 × 90 (Leaderboard)
- 300 × 250 (Medium Rectangle)
- 336 × 280 (Large Rectangle)

**Sidebar (if added):**
- 300 × 250 (Medium Rectangle)
- 160 × 600 (Wide Skyscraper)

**Responsive:**
- Any size (Responsive ad format - fills container)

---

## 🛠️ Admin Actions

### Edit Configuration
1. Click **Edit** button on any configuration
2. Form will populate with current values
3. Make changes
4. Click **Update**

### Toggle On/Off
- Click **Active** or **Inactive** button to enable/disable ad
- Ad won't show if inactive, but configuration is saved

### Delete Configuration  
1. Click **Delete** button
2. Confirm in dialog
3. Configuration is permanently removed

---

## ✅ Verify Everything Works

1. **Backend API test:**
   ```bash
   curl http://localhost:4000/api/config/adsense
   ```
   Should return JSON with your configurations

2. **Admin panel test:**
   - Visit `/admin/adsense`
   - Should see list of configurations
   - Form should work for create/edit/delete

3. **Ad display test:**
   - Go to homepage
   - Should see ad in the middle of page (if config exists and is active)
   - Open DevTools → Network tab
   - Should see request to `/api/config/adsense` succeed
   - Should see Google AdSense script load

---

## ❌ Troubleshooting

**Ads not showing?**
- [ ] Check `/admin/adsense` - configuration exists?
- [ ] Check "Active" status - is it enabled?
- [ ] Check placement - matches the page?
- [ ] Check browser console (F12) - any errors?
- [ ] Check Network tab (F12) - `/api/config/adsense` response ok?

**Form validation errors?**
- Display name already exists → Use different name or edit existing
- Required field error → All required fields must be filled
- Invalid placement → Select from dropdown, don't type

**AdSense code not working?**
- Paste complete code snippet, not just the script tag
- Verify `client=ca-pub-XXXXX` is correct
- Verify ad slot ID is correct
- Ensure your Google AdSense account is approved

---

## 📚 More Information

- **Full Setup Guide**: Read `ADSENSE_SETUP.md`
- **Implementation Details**: Read `ADSENSE_IMPLEMENTATION_SUMMARY.md`
- **Google AdSense Help**: https://support.google.com/adsense

---

## 🚀 Next Steps

1. ✅ Start application
2. ✅ Log in as admin  
3. ✅ Go to `/admin/adsense`
4. ✅ Create first configuration
5. ✅ Verify ads appear
6. ✅ Get real Google AdSense codes
7. ✅ Replace test codes with real codes
8. ✅ Monitor earnings in Google AdSense dashboard

---

**You're all set! 🎉**

Start creating AdSense configurations in your admin panel now.
