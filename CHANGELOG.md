# Changelog

## 0.1.8

- Added compatibility cards distinguishing no detected video, off-screen video, disabled embedded detection, and possible custom players.
- Added Retry, Open settings, dismiss, and Esc actions for compatibility cards.
- Embedded players now explain when optional access is needed or internal access is incomplete. Existing player-size and Exit controls remain available.
- Compatibility feedback is translated into Turkish and English and stays local to the page.
- Prepared the public source distribution, documentation, and installable unpacked ZIP. Local captures and diagnostics are excluded.

## 0.1.7

- Redesigned the floating toolbar with a translucent dark surface, SVG icons, segmented Fit / Fill, custom range tracks, and percentage steppers.
- Added keyboard, disabled-boundary, and narrow-window states for the custom controls.

## 0.1.6

- Added saved Turkish / English language selection in Options.
- Updated open video controls, access pages, notifications, accessible labels, and action tooltips when language changes.
- Added native browser locale catalogs. Restoring defaults preserves the chosen language.

## 0.1.5

- Added independent image zoom (25–300%) and player size (25–100%), with direct percentage entry and reset.
- Display changes no longer exit and re-enter the expanded view.
- Added local default scales and optional image-scaling relay for eligible embedded videos.

## 0.1.4

- Fixed unhandled action-update errors when a tab closes during background work.
- Kept unexpected failures visible while treating missing-tab races as normal lifecycle events.

## 0.1.3

- Added optional origin access for Esc relay inside selected cross-origin frames.
- Validated frame/session identity and cleaned up relays on exit.
- Added an experimental player-wrapper adapter; live compatibility is site-dependent.

## 0.1.2

- Expanded embedded-frame detection beyond a fixed provider list.
- Offered uncertain large frames for explicit selection and filtered known auxiliary frames.
- Added a canvas-player container adapter.

## 0.1.1

- Improved YouTube controls/progress geometry and handling of multiple media elements in one player.
- Added toolbar auto-hide, separate-tab Options, context-invalidation cleanup, and controller reuse.

## 0.1.0

- Initial WXT / React / TypeScript / Tailwind Manifest V3 extension with Fit / Fill, selection preferences, settings, keyboard controls, and local storage.
