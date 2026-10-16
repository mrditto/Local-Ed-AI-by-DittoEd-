# Development launch configuration

On October 16, 2026, the repository folder `.claude` was renamed to `.dev-launch` at the owner's request. The contents of `launch.json` were not changed.

This is development-tool configuration, not application or MSIX runtime content. Repository searches found no app/build-workflow references to the original path. Tools expecting `.claude/launch.json` may no longer automatically discover these launch entries.

If development launch discovery stops working, restore the original name with `git mv .dev-launch .claude`, review the resulting diff and commit the restoration. This does not require changing the application code or teacher data.
