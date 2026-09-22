# =============================================================================
# va_model.R
# Reference implementation of the ventricular–arterial coupling model used by
# the website (site/js/engine.js). Base R only, same equations, same fixed-step
# RK4 integrator, so results should agree with the browser to rounding error.
#
# Units: time s, volume mL, pressure mmHg, resistance mmHg·s/mL,
#        compliance mL/mmHg.
# =============================================================================

WU  <- 0.06            # 1 Wood unit in mmHg·s/mL
DYN <- 1 / 1333.22     # 1 dyn·s·cm^-5 in mmHg·s/mL

#' Normal adult parameter set (mirrors NORMAL in engine.js)
va_normal <- function() {
  list(
    hr = 70,
    lvEes = 2.3, lvV0 = 10, lvA = 0.22, lvBeta = 0.029,
    rvEes = 0.50, rvV0 = 15, rvA = 0.25, rvBeta = 0.026,
    svr = 0.95, cSys = 1.3, zcAo = 0.035, cSv = 45, rTv = 0.004,
    pvr = 0.8 * WU, cPa = 3.4, zcPa = 0.012, cPv = 16, rMv = 0.004,
    vStressed = 740
  )
}

#' Double-Hill activation normalised to a peak of 1 (Stergiopulos 1996)
va_activation <- function(T) {
  tmax <- 0.2 + 0.15 * T
  tau1 <- 0.67 * tmax; tau2 <- 1.13 * tmax; m1 <- 1.32; m2 <- 27.4
  raw <- function(t) {
    g1 <- (t / tau1)^m1; g2 <- (t / tau2)^m2
    (g1 / (1 + g1)) * (1 / (1 + g2))
  }
  tt <- seq(0, T, by = T / 4000)
  v <- raw(tt)
  list(e = function(t) raw(t) / max(v), tPeak = tt[which.max(v)])
}

va_ventP <- function(V, e, Ees, V0, A, beta) {
  e * Ees * (V - V0) + (1 - e) * A * (exp(beta * (V - V0)) - 1)
}

# state s = c(Vlv, Vsa, Vsv, Vrv, Vpa, Vpv)
va_pressures <- function(s, e, p) {
  Plv <- va_ventP(s[1], e, p$lvEes, p$lvV0, p$lvA, p$lvBeta)
  Prv <- va_ventP(s[4], e, p$rvEes, p$rvV0, p$rvA, p$rvBeta)
  Psa <- s[2] / p$cSys; Psv <- s[3] / p$cSv
  Ppa <- s[5] / p$cPa;  Ppv <- s[6] / p$cPv
  list(
    Plv = Plv, Prv = Prv, Psa = Psa, Psv = Psv, Ppa = Ppa, Ppv = Ppv,
    Qao = if (Plv > Psa) (Plv - Psa) / p$zcAo else 0,
    Qmv = if (Ppv > Plv) (Ppv - Plv) / p$rMv else 0,
    Qpv = if (Prv > Ppa) (Prv - Ppa) / p$zcPa else 0,
    Qtv = if (Psv > Prv) (Psv - Prv) / p$rTv else 0,
    Qsys = (Psa - Psv) / p$svr,
    Qpul = (Ppa - Ppv) / p$pvr
  )
}

va_deriv <- function(s, e, p) {
  q <- va_pressures(s, e, p)
  c(q$Qmv - q$Qao, q$Qao - q$Qsys, q$Qsys - q$Qtv,
    q$Qtv - q$Qpv, q$Qpv - q$Qpul, q$Qpul - q$Qmv)
}

va_initial_state <- function(p) {
  s <- c(p$lvV0 + 100, 150, 0, p$rvV0 + 110, 60, 0)
  rest <- p$vStressed - (s[1] - p$lvV0) - s[2] - (s[4] - p$rvV0) - s[5]
  s[3] <- rest * 0.8; s[6] <- rest * 0.2
  s
}

va_beat <- function(s, p, act, T, dt, record = FALSE) {
  n <- round(T / dt)
  if (record) rec <- matrix(NA_real_, n, 9,
    dimnames = list(NULL, c("t", "Vlv", "Plv", "Pao", "Vrv", "Prv", "Ppa", "Psv", "Ppv")))
  for (i in seq_len(n)) {
    t <- (i - 1) * dt
    if (record) {
      q <- va_pressures(s, act$e(t), p)
      rec[i, ] <- c(t, s[1], q$Plv, q$Psa + q$Qao * p$zcAo, s[4], q$Prv,
                    q$Ppa + q$Qpv * p$zcPa, q$Psv, q$Ppv)
    }
    e1 <- act$e(t); e2 <- act$e(t + dt / 2); e3 <- act$e(t + dt)
    k1 <- va_deriv(s, e1, p)
    k2 <- va_deriv(s + dt / 2 * k1, e2, p)
    k3 <- va_deriv(s + dt / 2 * k2, e2, p)
    k4 <- va_deriv(s + dt * k3, e3, p)
    s <- s + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4)
  }
  list(s = s, rec = if (record) as.data.frame(rec) else NULL)
}

va_loop_area <- function(V, P) {
  j <- c(seq_along(V)[-1], 1)
  abs(sum(V * P[j] - V[j] * P)) / 2
}

va_ventricle_metrics <- function(V, P, Part, iEs, Ees, V0, hr) {
  EDV <- max(V); ESV <- min(V); SV <- EDV - ESV
  Pes <- P[iEs]; Ea <- Pes / SV
  SW <- va_loop_area(V, P); PE <- 0.5 * Pes * (ESV - V0)
  list(EDV = EDV, ESV = ESV, SV = SV, EF = SV / EDV, CO = SV * hr / 1000,
       Pes = Pes, Ees = Ees, Ea = Ea, EaEes = Ea / Ees, EesEa = Ees / Ea,
       SW = SW, PVA = SW + PE, eff = SW / (SW + PE), svEsv = SV / ESV,
       artMax = max(Part), artMin = min(Part), artMean = mean(Part))
}

#' Run the model to beat-to-beat steady state
#'
#' @param params named list overriding va_normal()
#' @param dt integration step (s)
#' @param max_beats,tol convergence controls (tol in mL, max state change per beat)
#' @return list with lv, rv (ventricle metrics), hemo (haemodynamics), rec (last beat)
va_simulate <- function(params = list(), dt = 0.0005, max_beats = 200, tol = 0.05) {
  p <- utils::modifyList(va_normal(), params)
  T <- 60 / p$hr
  act <- va_activation(T)
  s <- va_initial_state(p)
  beats <- 0; converged <- FALSE
  while (beats < max_beats) {
    s1 <- va_beat(s, p, act, T, dt)$s
    d <- max(abs(s1 - s)); s <- s1
    if (d < tol) { converged <- TRUE; break }
    beats <- beats + 1
  }
  rec <- va_beat(s, p, act, T, dt, record = TRUE)$rec
  iEs <- round(act$tPeak / dt) + 1   # R is 1-indexed
  lv <- va_ventricle_metrics(rec$Vlv, rec$Plv, rec$Pao, iEs, p$lvEes, p$lvV0, p$hr)
  rv <- va_ventricle_metrics(rec$Vrv, rec$Prv, rec$Ppa, iEs, p$rvEes, p$rvV0, p$hr)
  RAP <- mean(rec$Psv); LAP <- mean(rec$Ppv); CO <- lv$CO
  hemo <- list(
    SBP = lv$artMax, DBP = lv$artMin, MAP = lv$artMean,
    PASP = rv$artMax, PADP = rv$artMin, mPAP = rv$artMean,
    RAP = RAP, LAP = LAP, CO = CO,
    SVR_dyn = (lv$artMean - RAP) / CO * 80,
    PVR_WU = (rv$artMean - LAP) / CO,
    PAC = rv$SV / (rv$artMax - rv$artMin)
  )
  list(params = p, beats = beats, converged = converged, lv = lv, rv = rv, hemo = hemo, rec = rec)
}

#' Scenario parameter sets (mirror site/js/presets.js)
va_presets <- function() {
  list(
    normal        = list(),
    hfpef         = list(lvEes = 4.5, lvBeta = 0.042, lvA = 0.3, svr = 1.5, cSys = 0.7, zcAo = 0.06, vStressed = 820),
    hfref         = list(lvEes = 0.8, lvV0 = 40, lvBeta = 0.021, lvA = 0.3, svr = 1.2, hr = 85, vStressed = 760),
    vasoplegia    = list(svr = 0.36, cSys = 1.8, hr = 110, vStressed = 700),
    septicCM      = list(lvEes = 1.0, svr = 0.62, cSys = 1.6, hr = 110, vStressed = 760),
    highAfterload = list(svr = 1.7, cSys = 0.8),
    pahComp       = list(pvr = 7 * WU, cPa = 1.0, zcPa = 0.03, rvEes = 1.05, rvBeta = 0.028, rvA = 0.3, vStressed = 820),
    pahDecomp     = list(pvr = 12 * WU, cPa = 0.7, zcPa = 0.035, rvEes = 0.55, rvV0 = 45, rvBeta = 0.024, rvA = 0.3, hr = 95, vStressed = 860),
    acutePE       = list(pvr = 6 * WU, cPa = 1.4, zcPa = 0.03),
    cpcph         = list(lvEes = 4.5, lvBeta = 0.042, lvA = 0.3, svr = 1.5, cSys = 0.7, zcAo = 0.06, vStressed = 1080, pvr = 3.5 * WU, cPa = 1.8)
  )
}

#' One-row summary of a simulation, used for tables and cross-checks
va_summary <- function(r) {
  data.frame(
    LV_EDV = r$lv$EDV, LV_ESV = r$lv$ESV, LV_EF = r$lv$EF, LV_EaEes = r$lv$EaEes,
    SBP = r$hemo$SBP, DBP = r$hemo$DBP, LAP = r$hemo$LAP, CO = r$hemo$CO,
    RV_EDV = r$rv$EDV, RV_ESV = r$rv$ESV, RV_EesEa = r$rv$EesEa, RV_svEsv = r$rv$svEsv,
    mPAP = r$hemo$mPAP, RAP = r$hemo$RAP, PVR_WU = r$hemo$PVR_WU
  )
}
