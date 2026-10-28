# WonderCMS files for serving them through a CDN
- includes theme and plugins json list (which is cached by your WonderCMS)
- includes admin CSS and JS files

This repository serves the wcms-admin.js file, which provides a cached version of the themes/plugins list - faster experience for admins for logging in and checking for updates.

## Listing a theme or plugin (standard since 2026-10-28)

- A module is listed only from a repository the WonderCMS project controls: fork it under
  `github.com/robiso/`, review the source (no remote code loading, no tracking without a
  clear opt-in, entry file named after the folder), then add the fork's URL to
  `themes-list.json` or `plugins-list.json`.
- Two entries predate this rule and are not yet under project control: `GregCustom` is listed
  from `NorfolkGreg/GregCustom`, and `wcms-bs5` is listed from the robiso fork but its
  `wcms-modules.json` points the zip at `joho1968/wcms-bs5`. They stay listed as a recorded exception
  (Robert, 2026-10-28): both predate the rule and both are maintained by their authors.
- The module's `wcms-modules.json` key must equal its folder name and its entry file
  (`plugins/<key>/<key>.php`, `themes/<key>/theme.php`), case included.
- `wcms-modules.json` is rebuilt from those lists once a day by the workflow in
  `.github/workflows/` (GitHub pauses scheduled workflows after 60 days without a commit;
  check it is enabled after quiet periods). Every listed module should pass `php -l`.
