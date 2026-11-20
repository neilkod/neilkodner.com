# Prompt 15 — Flat Categories

Some categories don't need albums — the photos should live directly in the category folder with no sub-folder grouping. Aviation is an example: I just want one big grid of aviation photos, not a set of named albums.

## R2 bucket layout

**Flat category** (photos at the category root):
```
aviation/
  cover.jpg
  img001.jpg
  img002.jpg
```

**Album-based category** (photos in named sub-folders):
```
places/
  cover.jpg
  boston-2025/
    cover.jpg
    img001.jpg
```

If a category has both flat photos and sub-folders, the albums take precedence.

## build_catalog.py changes

In `parse_bucket()`, collect R2 keys separately by depth:
- **Depth 2** (`cat/file.jpg`) → `flat_photos` dict: `{cat_id: {"files": [filenames...], "has_cover": bool, "cover_file": str|None}}`
  — `cover.jpg` sets `has_cover=True` and `cover_file` to the actual filename; it is NOT added to `files`
- **Depth 3** (`cat/album/file.jpg`) → `cat_tree` dict (existing album logic, same cover tracking)

In `build()`, merge both sets:
```python
all_cat_ids = sorted(set(cat_tree) | set(flat_photos))
for cat_id in all_cat_ids:
    is_flat = cat_id not in cat_tree
    if is_flat:
        # Build an implicit single album with id=cat_id, folder=cat_id
        album = { "id": cat_id, "folder": cat_id, "photos": [...] }
    else:
        # Existing album-based logic
```

Store `"flat": true` in the category entry in `catalog.json`.

## app.js changes

In `hydrateCategoryTiles()`, when the category is flat, update the tile's `href` to skip the album grid and go directly to the photo page:

```js
if (cat.flat) {
  tile.setAttribute('href', `/album.html?cat=${catId}&album=${catId}`);
}
```

Do this before the early-return check for `cat.cover`.

## gallery.js changes

In `renderAlbumPage()`:

1. **Page title:** for flat categories, use the category name (not the album ID, which is the same as the category ID and reads redundantly):
   ```js
   const pageTitle = cat.flat ? cat.name : (album.title || albumId);
   ```

2. **Breadcrumbs:** for flat categories, collapse the album level — the breadcrumb should read "Photography / Aviation" with no third level, and that final item should have `aria-current="page"`:
   ```js
   if (cat.flat) {
     breadcrumbCat.textContent = cat.name;
     breadcrumbCat.setAttribute('aria-current', 'page');
     // Remove the separator and album breadcrumb items that follow
   }
   ```

## Display name overrides

Add `CATEGORY_NAMES` in `build_catalog.py` to rename folder IDs to display names (e.g. `"travel"` folder → `"Places"`):

```python
CATEGORY_NAMES = {"travel": "Places"}
```

Use it when building the category `name` field:
```python
name = CATEGORY_NAMES.get(cat_id) or folder_to_title(cat_id)
```
