# Script Name: diastolic_microsim.R
# Author: Kurt Hu (kuhu@mcw.edu)
# Date: 2026-09-23
# Description: Figures and tables for the Diastolic lab virtual cohort (grades 0-IV): fluid and
#   diuresis, afterload and AF tolerance, the volume window, and the fluid-then-diuresis course.
#
# Inputs (written by tools/diastolic_cohort.mjs): R/diastolic_cohort_long.csv,
#   R/diastolic_cohort_summary.csv, R/diastolic_course.csv
# Outputs: R/outputs/figures/*.png (+ .pdf), R/outputs/tables/*.csv
# Run from the repository root: Rscript R/diastolic_microsim.R

#' Load the packages this script uses, through pacman when it is installed.
#'
#' @param pkgs Character vector of package names.
#' @return Invisibly, TRUE when every package is available.
load_project_libraries <- function(pkgs = c("dplyr", "tidyr", "readr", "ggplot2", "patchwork", "here", "scales")) {
  if (file.exists("renv/activate.R")) source("renv/activate.R")
  if (requireNamespace("pacman", quietly = TRUE)) {
    pacman::p_load(char = pkgs, character.only = TRUE)
  } else {
    missing <- pkgs[!vapply(pkgs, requireNamespace, logical(1), quietly = TRUE)]
    if (length(missing)) stop("Install these packages first: ", paste(missing, collapse = ", "))
  }
  invisible(TRUE)
}

#' Build the paths and study constants for this analysis.
#'
#' @return Named list of input files, output directories and constants.
build_analysis_config <- function() {
  root <- here::here()
  list(
    long_csv    = file.path(root, "R", "diastolic_cohort_long.csv"),
    summary_csv = file.path(root, "R", "diastolic_cohort_summary.csv"),
    course_csv  = file.path(root, "R", "diastolic_course.csv"),
    fig_dir     = file.path(root, "R", "outputs", "figures"),
    tab_dir     = file.path(root, "R", "outputs", "tables"),
    lap_wet     = 18,   # mmHg, congested (Forrester 1976)
    grade_labels = c("Normal", "Grade I", "Grade II", "Grade III", "Grade IV"),
    # normal in gray, grades I-IV as one ordinal blue ramp (the site's palette)
    palette = c("Normal" = "#9AA3A0", "Grade I" = "#86B6EF", "Grade II" = "#3987E5",
                "Grade III" = "#1C5CAB", "Grade IV" = "#0D366B")
  )
}

#' Create the output directories.
#'
#' @param config List from build_analysis_config().
#' @return Invisibly, the config.
initialize_output_dirs <- function(config) {
  dir.create(config$fig_dir, recursive = TRUE, showWarnings = FALSE)
  dir.create(config$tab_dir, recursive = TRUE, showWarnings = FALSE)
  invisible(config)
}

#' House ggplot theme.
#'
#' @param base_size Base font size.
#' @return A ggplot2 theme.
khu_theme <- function(base_size = 11) {
  ggplot2::theme_classic(base_size = base_size) +
    ggplot2::theme(plot.title = ggplot2::element_text(hjust = 0.5), legend.position = "bottom")
}

#' Read the three cohort files and label the grades.
#'
#' @param config List from build_analysis_config().
#' @return List with tibbles long, summary and course.
load_cohort <- function(config) {
  lab <- function(g) factor(config$grade_labels[g + 1], levels = config$grade_labels)
  list(
    long    = readr::read_csv(config$long_csv, show_col_types = FALSE) |> dplyr::mutate(grade = lab(grade)),
    summary = readr::read_csv(config$summary_csv, show_col_types = FALSE) |> dplyr::mutate(grade = lab(grade)),
    course  = readr::read_csv(config$course_csv, show_col_types = FALSE) |> dplyr::mutate(grade = lab(grade))
  )
}

#' Median and interquartile range of one variable along one protocol, by grade.
#'
#' @param long Long cohort tibble.
#' @param which Protocol name ("volume", "afterload", "af").
#' @param var Unquoted variable to summarize.
#' @param change If TRUE, summarize the change from the patient's baseline (volume 0).
#' @return Tibble with grade, x, med, lo, hi.
summarize_protocol <- function(long, which, var, change = FALSE) {
  base <- long |>
    dplyr::filter(protocol == "volume", x == 0) |>
    dplyr::select(id, base = {{ var }})
  long |>
    dplyr::filter(protocol == which, ref == 0) |>
    dplyr::left_join(base, by = "id") |>
    dplyr::mutate(y = if (change) {{ var }} - base else {{ var }}) |>
    dplyr::group_by(grade, x) |>
    dplyr::summarise(med = stats::median(y, na.rm = TRUE),
                     lo = stats::quantile(y, 0.25, na.rm = TRUE),
                     hi = stats::quantile(y, 0.75, na.rm = TRUE), .groups = "drop")
}

#' Median line with an interquartile band for each grade.
#'
#' @param df Tibble from summarize_protocol().
#' @param config Analysis config (palette).
#' @param xlab,ylab,title Axis labels and title.
#' @param hline Optional y reference line.
#' @return A ggplot.
plot_band <- function(df, config, xlab, ylab, title, hline = NULL) {
  p <- ggplot2::ggplot(df, ggplot2::aes(x = x, y = med, color = grade, fill = grade)) +
    ggplot2::geom_ribbon(ggplot2::aes(ymin = lo, ymax = hi), alpha = 0.15, color = NA) +
    ggplot2::geom_line(linewidth = 0.8) +
    ggplot2::scale_color_manual(values = config$palette) +
    ggplot2::scale_fill_manual(values = config$palette) +
    ggplot2::labs(x = xlab, y = ylab, title = title, color = NULL, fill = NULL) +
    khu_theme()
  if (!is.null(hline)) p <- p + ggplot2::geom_hline(yintercept = hline, linetype = "dashed", color = "#9A6B12")
  p
}

#' Save a plot as PNG (300 dpi) and PDF.
#'
#' @param plot A ggplot or patchwork object.
#' @param path Output path without extension.
#' @param width,height Size in inches.
#' @return Invisibly, the PNG path.
khu_save_plot <- function(plot, path, width, height) {
  ggplot2::ggsave(paste0(path, ".png"), plot = plot, width = width, height = height, dpi = 300)
  ggplot2::ggsave(paste0(path, ".pdf"), plot = plot, width = width, height = height)
  invisible(paste0(path, ".png"))
}

#' Median [IQR] of each tolerance summary by grade.
#'
#' @param summary Patient summary tibble.
#' @return Wide tibble, one row per measure and one column per grade.
tolerance_table <- function(summary) {
  measures <- c(LAP = "LA pressure as found (mmHg)", CO = "Cardiac output as found (L/min)",
                window = "Volume window (mL)", lap1000 = "LAP rise, 1 L fluid (mmHg)",
                co500 = "CO gain, 500 mL (L/min)", lapDiur = "LAP change, 1 L removed (mmHg)",
                coDiur = "CO change, 1 L removed (L/min)", aftLAP = "LAP rise, SVR x 1.5 (mmHg)",
                aftSVpct = "SV change, SVR x 1.5 (%)", surgeLAP = "LAP rise, sympathetic surge (mmHg)",
                af70CO = "CO change, AF 70/min (%)", af130CO = "CO change, AF 130/min (%)",
                af130LAP = "LAP change, AF 130/min (mmHg)")
  summary |>
    dplyr::filter(ref == 0) |>
    tidyr::pivot_longer(dplyr::all_of(names(measures)), names_to = "measure") |>
    dplyr::group_by(measure, grade) |>
    dplyr::summarise(txt = sprintf("%.2f (%.2f, %.2f)", stats::median(value, na.rm = TRUE),
                                   stats::quantile(value, 0.25, na.rm = TRUE), stats::quantile(value, 0.75, na.rm = TRUE)),
                     .groups = "drop") |>
    tidyr::pivot_wider(names_from = grade, values_from = txt) |>
    dplyr::mutate(measure = factor(measures[measure], levels = measures)) |>
    dplyr::arrange(measure)
}

#' Run the whole analysis: figures and tables.
#'
#' @return Invisibly, the list of plots.
run_diastolic_microsim <- function() {
  load_project_libraries()
  config <- initialize_output_dirs(build_analysis_config())
  d <- load_cohort(config)

  p_lap <- plot_band(summarize_protocol(d$long, "volume", LAP), config,
                     "Volume given (+) or removed (-), mL", "LA pressure (mmHg)", "Fluid and diuresis: LAP", config$lap_wet)
  p_co <- plot_band(summarize_protocol(d$long, "volume", CO), config,
                    "Volume given (+) or removed (-), mL", "Cardiac output (L/min)", "Fluid and diuresis: CO")
  p_aft <- plot_band(summarize_protocol(d$long, "afterload", LAP, change = TRUE), config,
                     "SVR, multiple of baseline", "Change in LAP (mmHg)", "Afterload")
  p_af <- plot_band(summarize_protocol(d$long, "af", LAP, change = TRUE), config,
                    "Ventricular rate in AF (/min)", "Change in LAP from sinus (mmHg)", "Atrial fibrillation")
  fig1 <- (p_lap | p_co) / (p_aft | p_af) + patchwork::plot_layout(guides = "collect") +
    patchwork::plot_annotation(tag_levels = "a") & ggplot2::theme(legend.position = "bottom")
  khu_save_plot(fig1, file.path(config$fig_dir, "diastolic_tolerance"), 10, 8)

  win <- d$summary |>
    dplyr::filter(ref == 0) |>
    dplyr::group_by(grade) |>
    dplyr::mutate(k = dplyr::row_number() / dplyr::n()) |>
    dplyr::ungroup()
  p_win <- ggplot2::ggplot(dplyr::filter(win, window > 0),
                           ggplot2::aes(y = as.numeric(grade) + 0.7 * (k - 0.5), color = grade)) +
    ggplot2::geom_segment(ggplot2::aes(x = winLo, xend = winHi, yend = as.numeric(grade) + 0.7 * (k - 0.5)), linewidth = 0.4) +
    ggplot2::geom_vline(xintercept = 0, linetype = "dotted") +
    ggplot2::scale_y_continuous(breaks = seq_along(config$grade_labels), labels = config$grade_labels, trans = "reverse") +
    ggplot2::scale_color_manual(values = config$palette, guide = "none") +
    ggplot2::labs(x = "Intravascular volume change from the patient as found (mL)", y = NULL,
                  title = "Volume window: LAP < 18 mmHg and CO within 10% of plateau") +
    khu_theme()
  khu_save_plot(p_win, file.path(config$fig_dir, "diastolic_volume_window"), 8, 4.5)

  course_long <- d$course |>
    dplyr::select(grade, t_min, LAP, CO, EA) |>
    tidyr::pivot_longer(c(LAP, CO, EA), names_to = "var") |>
    dplyr::mutate(var = factor(var, levels = c("LAP", "CO", "EA"),
                               labels = c("LA pressure (mmHg)", "Cardiac output (L/min)", "Mitral E/A")))
  p_course <- ggplot2::ggplot(course_long, ggplot2::aes(t_min, value, color = grade)) +
    ggplot2::annotate("rect", xmin = 0, xmax = 30, ymin = -Inf, ymax = Inf, alpha = 0.08) +
    ggplot2::annotate("rect", xmin = 60, xmax = 240, ymin = -Inf, ymax = Inf, alpha = 0.08, fill = "#9A6B12") +
    ggplot2::geom_line(linewidth = 0.8) +
    ggplot2::facet_wrap(~var, scales = "free_y", nrow = 1) +
    ggplot2::scale_color_manual(values = config$palette) +
    ggplot2::labs(x = "Minutes (1 L crystalloid 0-30 min; diuresis 500 mL/h 60-240 min)", y = NULL,
                  title = "Give fluid, then diurese", color = NULL) +
    khu_theme()
  khu_save_plot(p_course, file.path(config$fig_dir, "diastolic_course"), 11, 4)

  tab <- tolerance_table(d$summary)
  readr::write_csv(tab, file.path(config$tab_dir, "diastolic_tolerance_by_grade.csv"))
  if (requireNamespace("flextable", quietly = TRUE)) {
    ft <- flextable::flextable(tab) |> flextable::theme_booktabs() |> flextable::autofit() |>
      flextable::align(j = 1, align = "left", part = "all") |>
      flextable::align(j = -1, align = "center", part = "all")
    flextable::save_as_docx(ft, path = file.path(config$tab_dir, "diastolic_tolerance_by_grade.docx"))
  }
  print(tab, width = Inf)
  invisible(list(tolerance = fig1, window = p_win, course = p_course))
}

if (identical(environment(), globalenv()) && !interactive()) run_diastolic_microsim()
