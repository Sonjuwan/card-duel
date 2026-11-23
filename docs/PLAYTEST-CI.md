# Candidate build verification (do not publish prematurely)

Each development checkpoint (`v0.249.0`, etc.) is source-only. The latest
previously fully built offline app is **v0.197.0** until a new source candidate
has passed the complete production build and upgrade/rollback tests.

The included `.github/workflows/validate-playable.yml` can be run manually
**after pushing the latest Git source branch to the user's GitHub repository**.
Set `candidate_number` to the number in the branch HEAD subject. The workflow
fails closed if the requested number is not identical to the source commit.
It stamps that version only in the temporary CI checkout, installs locked
Node 24 dependencies, runs the typecheck, full test and React render suites, **two real-engine AI ranked matches with in-battle save/restore and progression backup/settlement**,
web and offline builds, PWA cache tests, deployment preflight, then uploads a
seven-day `playtest` artifact. It does not auto-publish a website.

**Preservation:** `data/ai-release/` contains the compatible published AI
champion for fresh CI checkout. Personal ignored `data/ai/` training history
must stay in the persistent Library source ZIP; do not overwrite the original
models with a default fallback. Verify champion identity before releasing.

**Installation:** the PWA requires HTTPS hosting or localhost. Downloading
and opening `solo-offline.html` is a separate one-file executable and does
not install a PWA. Mobile fullscreen/rotation and button reachability still
need physical-device testing. Keep v0.197 available until that succeeds.
