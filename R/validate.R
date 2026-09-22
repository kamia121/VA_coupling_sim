# =============================================================================
# validate.R
# Runs every scenario through the R model, writes R/presets_R.csv, and if the
# browser engine's output exists (tests/presets_js.csv, written by
# `node tests/export_presets.mjs`) reports the largest relative difference.
#
# Usage (from the repository root):
#   node tests/export_presets.mjs
#   Rscript R/validate.R
# =============================================================================

args <- commandArgs(trailingOnly = FALSE)
here <- dirname(normalizePath(sub("^--file=", "", args[grep("^--file=", args)])))
source(file.path(here, "va_model.R"))

presets <- va_presets()
rows <- lapply(names(presets), function(id) {
  r <- va_simulate(presets[[id]])
  cbind(id = id, converged = r$converged, va_summary(r))
})
out <- do.call(rbind, rows)
write.csv(out, file.path(here, "presets_R.csv"), row.names = FALSE)
print(format(out, digits = 3), row.names = FALSE)

js_file <- file.path(here, "..", "tests", "presets_js.csv")
if (file.exists(js_file)) {
  js <- read.csv(js_file)
  js <- js[match(out$id, js$id), ]
  cols <- setdiff(names(out), c("id", "converged"))
  rel <- abs(as.matrix(out[cols]) - as.matrix(js[cols])) / pmax(abs(as.matrix(js[cols])), 1e-6)
  worst <- max(rel)
  cat(sprintf("\nLargest relative difference R vs JS: %.4f%% (%s, %s)\n",
              100 * worst, out$id[which(rel == worst, arr.ind = TRUE)[1, 1]],
              cols[which(rel == worst, arr.ind = TRUE)[1, 2]]))
  if (worst > 0.01) { cat("FAIL: R and JS disagree by more than 1%\n"); quit(status = 1) }
  cat("OK: R and JS agree within 1%\n")
} else {
  cat("\n(tests/presets_js.csv not found; run `node tests/export_presets.mjs` to cross-check)\n")
}
