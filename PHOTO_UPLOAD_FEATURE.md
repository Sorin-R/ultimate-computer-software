# Article Photo Upload Feature

## Overview
Article photo upload has been fully integrated into the Ultimate Computer Software platform. Users can now upload photos when creating or editing articles. Photos are optimized to 600×600px square format and displayed as thumbnails on article cards and as hero images on article pages.

---

## Backend Implementation

### Database
- **Field Added:** `Article.imageUrl` (String, nullable)
- **Storage:** Local filesystem in `/backend/uploads/`
- **File Optimization:** Converted to WebP format via Sharp

### New Files Created

#### 1. **src/middleware/upload.ts**
- Multer configuration for file uploads
- Accepts: JPEG, PNG, WebP, GIF
- Max file size: 3MB
- Stores in `/uploads` directory with unique timestamps

#### 2. **src/controllers/uploadController.ts**
- `uploadArticleImage()` function
- Processes uploaded files with Sharp
- Optimizes images to 600×600px square format
- Converts to WebP for better compression
- Returns relative URL path

#### 3. **src/routes/upload.ts**
- `POST /api/upload/article-image` - Authenticated upload endpoint
- Requires user authentication
- Returns JSON with `imageUrl` and `success` status

### Updated Files

#### **src/app.ts**
- Added static file serving from `/uploads` directory
- Registered upload routes
- Increased JSON limit to 10MB for form data

#### **src/controllers/articleController.ts**
- Updated `createArticle()` to accept and save `imageUrl`
- Updated `updateArticle()` to allow updating photo
- Added `imageUrl` to all relevant SELECT queries:
  - `getPublishedArticles()`
  - `getArticleBySlug()` (related articles)
  - `getUserArticles()`

### Dependencies Added
- **multer** (^5.2.0) - File upload middleware
- **sharp** - Image optimization and conversion
- **@types/multer** - TypeScript types for multer

---

## Frontend Implementation

### New Files Created

#### **src/pages/dashboard/ArticleEditor** (Updated)
Photo upload section with:
- Drag-and-drop file input
- File validation (3MB max, image only)
- Progress indicator during upload
- Photo preview with remove button
- Error handling and user feedback

### Updated Components

#### **ArticleCard.tsx**
- Added `imageUrl` prop (String | null)
- Displays 48px square photo thumbnail above article title
- Proper fallback for articles without images
- Full height card layout with flexbox for consistent spacing

#### **ArticlePage.tsx** (Public Article View)
- Added `imageUrl` prop to Article interface
- Displays large hero image (h-96) above article content
- Responsive image with lazy loading
- Mobile-friendly with overflow handling

#### **CategoryPage.tsx**
- Added `imageUrl` to Article interface
- Passes imageUrl to ArticleCard components

#### **HomePage.tsx**
- Added `imageUrl` to Article interface
- Supports photo display in latest articles grid

### API Client Integration
- Uses authenticated POST to `/api/upload/article-image`
- FormData for multipart file upload
- Proper error handling and user feedback
- File input reset after upload

---

## User Workflow

### Creating/Editing Articles
1. User navigates to `/dashboard/articles/new` or edit page
2. Fills in article details (title, body, category, etc.)
3. **Photo Upload Section:**
   - Clicks dashed border area or "Upload Photo" button
   - Selects image file (JPEG, PNG, WebP, GIF, max 3MB)
   - File is uploaded to backend via FormData
   - Backend optimizes to 600×600px WebP
   - Frontend displays photo preview
   - User can remove photo if needed

### Viewing Articles
1. **Home Page:** Articles display with photo thumbnails (if available)
2. **Category Pages:** Articles in grid show photos above title
3. **Article Page:** Hero image displays above article title and metadata

---

## Technical Specifications

### Image Optimization
- **Input Formats:** JPEG, PNG, WebP, GIF
- **Output Format:** WebP (better compression)
- **Output Size:** 600×600px square
- **Cropping:** Center-focused with 'cover' fit
- **Compression Quality:** 80%
- **Max Input Size:** 3MB

### File Storage
- **Location:** `/backend/uploads/`
- **Filename Pattern:** `article-{timestamp}-{random}.webp`
- **URL Path:** `/uploads/{filename}` (served as static)
- **Cleanup:** Original files deleted after optimization

### API Response
```json
{
  "success": true,
  "imageUrl": "/uploads/article-1715000000000-123456789.webp",
  "message": "Image uploaded and optimized successfully"
}
```

---

## Database Migration

The database schema was updated with:
```sql
ALTER TABLE articles ADD COLUMN "imageUrl" TEXT;
```

All existing articles have `imageUrl = NULL` by default.

---

## Security Considerations

✅ **File Type Validation:** Only images allowed (mime type check)
✅ **File Size Limit:** 3MB maximum
✅ **Authentication Required:** Endpoint requires logged-in user
✅ **Filename Sanitization:** Timestamps + random + extension only
✅ **Original File Cleanup:** Originals deleted after optimization
✅ **WebP Conversion:** Removes metadata, reduces file size
✅ **URL Path:** Relative paths prevent directory traversal

---

## Testing Checklist

- [ ] Upload JPEG image to article
- [ ] Upload PNG image to article
- [ ] Verify file size validation (reject >3MB)
- [ ] Verify file type validation (reject non-images)
- [ ] Check image displays on article page
- [ ] Check image thumbnail on article card
- [ ] Check image on category page
- [ ] Check image on home page
- [ ] Verify edit article updates image
- [ ] Test removing image from article
- [ ] Verify images persist after page refresh
- [ ] Check mobile responsiveness

---

## Future Enhancements

- [ ] Image cropping tool before upload
- [ ] Drag-and-drop image reordering in article body
- [ ] Image gallery support
- [ ] CDN integration for image serving
- [ ] Image caching headers optimization
- [ ] Fallback placeholder images
- [ ] Image alt text required field
- [ ] WebP to AVIF conversion for newer browsers
