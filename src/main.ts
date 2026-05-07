// @ts-nocheck
import { stringify, normalizeKey, slugify, cleanFileStem, escapeHtml, formatInteger, formatCurrency, formatPercent, formatDate, formatShortDuration } from './utils';
import { FIX_BADGES } from './constants';
import { detectCostRate } from './pricing';
import { parseJson, parseJsonl, parseZipEntries, detectImportSource, buildReadinessGaps } from './parser';
import { classifyWaste, buildWasteEvidence, extractTokenCount, isErrorRecord, isJobLike, isMetaLike, isRunLike, isSimpleCheck, buildFixSuggestion, normalizeJobs, createJobStat, ensureSyntheticStat, resolveJob, applyRunRecord, parseScheduleMinutes, formatFrequency, compareJobs, estimateWastePerRun, estimateDailyWasteTokens } from './domain';
import { buildFixCards, formatEvidenceBlurb } from './fixes';

    const state = {
      report: null,
      sortKey: "tokens",
      sortDir: "desc"
    };

    const dropzone = document.getElementById("dropzone");
    const fileInput = document.getElementById("fileInput");
    const browseButton = document.getElementById("browseButton");
    const step2Btn = document.getElementById("step2Btn");
    const loadingMessage = document.getElementById("loadingMessage");
    const loadingText = document.getElementById("loadingText");
    const errorMessage = document.getElementById("errorMessage");
    const emptyState = document.getElementById("emptyState");
    const reportSection = document.getElementById("report");
    const summaryGrid = document.getElementById("summaryGrid");
    const wasteList = document.getElementById("wasteList");
    const jobTableBody = document.getElementById("jobTableBody");
    const fixGrid = document.getElementById("fixGrid");

    bindEvents();
    updateSortIndicators();

    function bindEvents() {
      browseButton.addEventListener("click", () => fileInput.click());
      step2Btn && step2Btn.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", (event) => handleFiles(event.target.files));
      dropzone.addEventListener("click", (event) => {
        if (event.target !== browseButton) {
          fileInput.click();
        }
      });
      dropzone.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          fileInput.click();
        }
      });

      ["dragenter", "dragover"].forEach((type) => {
        dropzone.addEventListener(type, (event) => {
          event.preventDefault();
          event.stopPropagation();
          dropzone.classList.add("dragover");
        });
      });

      ["dragleave", "dragend", "drop"].forEach((type) => {
        dropzone.addEventListener(type, (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (type !== "drop") {
            dropzone.classList.remove("dragover");
          }
        });
      });

      dropzone.addEventListener("drop", (event) => {
        dropzone.classList.remove("dragover");
        handleFiles(event.dataTransfer.files);
      });

      document.querySelectorAll("[data-sort]").forEach((button) => {
        button.addEventListener("click", () => {
          const key = button.dataset.sort;
          if (state.sortKey === key) {
            state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
          } else {
            state.sortKey = key;
            state.sortDir = key === "name" ? "asc" : "desc";
          }
          updateSortIndicators();
          if (state.report) {
            renderJobTable(state.report.jobs);
          }
        });
      });

      document.getElementById("toggleTable").addEventListener("click", () => {
        const wrap = document.getElementById("tableWrap");
        const btn = document.getElementById("toggleTable");
        const indicator = btn.querySelector(".sort-indicator");
        const isHidden = wrap.style.display === "none";
        wrap.style.display = isHidden ? "block" : "none";
        indicator.innerHTML = isHidden ? "&#9660;" : "&#9658;";
      });
    }

    async function handleFiles(fileList) {
      const files = Array.from(fileList || []).filter(Boolean);
      if (!files.length) {
        return;
      }

      clearError();
      setLoading("Preparing files...");

      try {
        const dataset = {
          jobs: [],
          meta: null,
          runBundles: [],
          fileCount: files.length
        };

        await nextFrame();

        for (let index = 0; index < files.length; index += 1) {
          const file = files[index];
          setLoading(`Reading ${file.name} (${index + 1}/${files.length})...`);
          await nextFrame();

          if (/\.zip$/i.test(file.name)) {
            await ingestZipFile(file, dataset);
          } else {
            await ingestLooseFile(file, dataset);
          }
        }

        setLoading("Analyzing job waste...");
        await nextFrame();

        const report = analyzeDataset(dataset);
        state.report = report;
        renderReport(report);
      } catch (error) {
        showError(mapErrorMessage(error instanceof Error ? error.message : String(error)));
      } finally {
        hideLoading();
        fileInput.value = "";
      }
    }

    async function ingestLooseFile(file, dataset) {
      const fileName = file.name;
      const text = await file.text();

      if (/\.jsonl$/i.test(fileName)) {
        dataset.runBundles.push({
          fileName,
          records: parseJsonl(text, fileName)
        });
        return;
      }

      if (/\.json$/i.test(fileName)) {
        const payload = parseJson(text, fileName);
        ingestStructuredPayload(payload, fileName, dataset);
        return;
      }

      throw new Error(`Unsupported file type: ${fileName}. Please use .zip, .json, or .jsonl.`);
    }

    async function ingestZipFile(file, dataset) {
      setLoading(`Unpacking ${file.name}...`);
      await nextFrame();
      const arrayBuffer = await file.arrayBuffer();
      const entries = await parseZipEntries(arrayBuffer);

      const jobsEntry = entries.find((entry) => /(^|\/)jobs\.json$/i.test(entry.name));
      const metaEntry = entries.find((entry) => /(^|\/)meta\.json$/i.test(entry.name));
      const runEntries = entries.filter((entry) => /(^|\/)run[s]?\//i.test(entry.name) && /\.jsonl$/i.test(entry.name));

      if (!jobsEntry && !runEntries.length) {
        throw new Error("The ZIP file does not contain jobs.json or run/*.jsonl files.");
      }

      if (jobsEntry) {
        setLoading(`Parsing ${jobsEntry.name}...`);
        await nextFrame();
        ingestStructuredPayload(parseJson(jobsEntry.text, jobsEntry.name), jobsEntry.name, dataset);
      }

      if (metaEntry) {
        ingestStructuredPayload(parseJson(metaEntry.text, metaEntry.name), metaEntry.name, dataset);
      }

      for (let index = 0; index < runEntries.length; index += 1) {
        const entry = runEntries[index];
        setLoading(`Parsing ${entry.name} (${index + 1}/${runEntries.length})...`);
        await nextFrame();
        dataset.runBundles.push({
          fileName: entry.name,
          records: parseJsonl(entry.text, entry.name)
        });
      }
    }

    function ingestStructuredPayload(payload, fileName, dataset) {
      if (payload == null) {
        throw new Error(`Empty JSON payload in ${fileName}.`);
      }

      if (Array.isArray(payload)) {
        if (payload.every(isJobLike)) {
          dataset.jobs.push(...payload);
          return;
        }

        if (payload.every(isRunLike)) {
          dataset.runBundles.push({ fileName, records: payload });
          return;
        }

        throw new Error(`Unable to recognize JSON array format in ${fileName}.`);
      }

      if (typeof payload !== "object") {
        throw new Error(`Unsupported JSON structure in ${fileName}.`);
      }

      const recognized =
        Array.isArray(payload.jobs) ||
        Array.isArray(payload.runs) ||
        isJobLike(payload) ||
        isRunLike(payload) ||
        isMetaLike(payload) ||
        (payload.meta && isMetaLike(payload.meta));

      if (!recognized) {
        throw new Error(`Unable to recognize JSON object format in ${fileName}.`);
      }

      if (Array.isArray(payload.jobs)) {
        dataset.jobs.push(...payload.jobs);
      } else if (isJobLike(payload)) {
        dataset.jobs.push(payload);
      }

      if (Array.isArray(payload.runs)) {
        dataset.runBundles.push({ fileName, records: payload.runs });
      } else if (isRunLike(payload)) {
        dataset.runBundles.push({ fileName, records: [payload] });
      }

      if (payload.meta && isMetaLike(payload.meta)) {
        dataset.meta = payload.meta;
      } else if (isMetaLike(payload)) {
        dataset.meta = payload;
      }
    }

    function analyzeDataset(dataset) {
      const normalizedJobs = normalizeJobs(dataset.jobs);
      const statsById = new Map();
      const indexes = {
        byId: new Map(),
        bySlug: new Map()
      };

      normalizedJobs.forEach((job) => {
        indexes.byId.set(job.lookupId, job);
        indexes.bySlug.set(job.slug, job);
        statsById.set(job.lookupId, createJobStat(job));
      });

      dataset.runBundles.forEach((bundle) => {
        bundle.records.forEach((record) => {
          const targetJob = resolveJob(record, bundle.fileName, indexes);
          const stat = targetJob ? statsById.get(targetJob.lookupId) : ensureSyntheticStat(record, bundle.fileName, statsById);
          applyRunRecord(stat, record);
        });
      });

      const jobs = Array.from(statsById.values()).map((stat) => finalizeStat(stat));
      const activeJobs = jobs.filter((job) => job.totalRuns > 0 || !job.synthetic);

      // Get cheapRate once for all waste computations
      const minimaxRef = detectCostRate("MiniMax M2.7");
      const cheapRate = (minimaxRef.pricingSource === "known-local" && isFinite(minimaxRef.rate) && minimaxRef.rate > 0)
        ? minimaxRef.rate
        : undefined;

      // Three-tier sort:
      // Tier 1: jobs with estimatedDailyWasteTokens !== null → sort desc
      // Tier 2: jobs with estimatedWastePerRun !== null but estimatedDailyWasteTokens === null → sort desc
      // Tier 3: remaining → current totalTokens × errorRate desc
      const rankedWaste = [...activeJobs]
        .filter((job) => job.badge !== "OK")
        .sort((left, right) => {
          const leftDaily = estimateDailyWasteTokens(left, cheapRate);
          const rightDaily = estimateDailyWasteTokens(right, cheapRate);
          // Tier 1: positive estimatedDailyWasteTokens (> 0, not merely non-null)
          if (leftDaily !== null && leftDaily > 0 && rightDaily !== null && rightDaily > 0) return rightDaily - leftDaily;
          if (leftDaily !== null && leftDaily > 0) return -1;
          if (rightDaily !== null && rightDaily > 0) return 1;
          const leftPerRun = estimateWastePerRun(left, cheapRate);
          const rightPerRun = estimateWastePerRun(right, cheapRate);
          // Tier 2: positive estimatedWastePerRun (> 0, not merely non-null)
          if (leftPerRun !== null && leftPerRun > 0 && rightPerRun !== null && rightPerRun > 0) return rightPerRun - leftPerRun;
          if (leftPerRun !== null && leftPerRun > 0) return -1;
          if (rightPerRun !== null && rightPerRun > 0) return 1;
          const lw = left.totalTokens * left.errorRate;
          const rw = right.totalTokens * right.errorRate;
          return rw - lw;
        });
      // Fallback: if no waste jobs, show by wasted tokens (which is 0 - means all OK)
      const topWaste = (rankedWaste.length ? rankedWaste : [...activeJobs].sort((left, right) => {
        const lw = left.totalTokens * left.errorRate;
        const rw = right.totalTokens * right.errorRate;
        return rw - lw;
      })).slice(0, 5);
      const totalTokens = activeJobs.reduce((sum, job) => sum + job.totalTokens, 0);
      const totalCost = activeJobs.reduce((sum, job) => sum + job.totalCost, 0);
      const hasConservativeEstimates = activeJobs.some((job) => job.pricingSource === 'conservative-estimate');
      const knownLocalCost = activeJobs.reduce((sum, job) => job.pricingSource === 'known-local' ? sum + job.totalCost : sum, 0);
      const conservativeEstimateCost = activeJobs.reduce((sum, job) => job.pricingSource === 'conservative-estimate' ? sum + job.totalCost : sum, 0);
      const totalRuns = activeJobs.reduce((sum, job) => sum + job.totalRuns, 0);
      const totalErrors = activeJobs.reduce((sum, job) => sum + job.errorRuns, 0);

      // Possible savings: tokens burned by failed runs that would be eliminated by fixing the error cause
      // Potential saving: if all waste jobs ran at <=5% error rate, how much would be saved?
      // For ERROR_WASTE jobs: all tokens from runs above 5% error rate count as waste
      // For CRITICAL / WARNING: wasted = tokens from runs above 5% frequency threshold (proxy for over-scheduling)
      // For PREMIUM_MODEL_WASTE: savings = cost difference between premium model and MiniMax M2.7
      const wasteJobs = activeJobs.filter((job) => job.badge !== "OK");
      let totalWasteTokens = 0;
      let totalCostSaving = 0;
      wasteJobs.forEach((job) => {
        const errorWastedTokens = Math.round(job.totalTokens * Math.max(0, job.errorRate - 0.05));
        let scheduleWastedTokens = 0;
        if (job.scheduleMinutes != null && job.scheduleMinutes < 60) {
          // If it runs more than every 60min and it's not an LLM task, schedule waste is proportional
          const simpleCheck = isSimpleCheck(job.raw, job.promptText);
          if (simpleCheck && job.scheduleMinutes < 60) {
            scheduleWastedTokens = Math.round(job.totalTokens * Math.max(0, (60 - job.scheduleMinutes) / 60));
          }
        }
        // Premium model saving: difference between current model rate and MiniMax M2.7 rate
        // Conservative-estimate jobs are included in totalWasteTokens but excluded from totalCostSaving
        const isConservativeEstimate = job.pricingSource === 'conservative-estimate';
        let modelSavingTokens = 0;
        if (!isConservativeEstimate && job.badge === "PREMIUM_MODEL_WASTE") {
          const premiumRate = job.rate.rate;
          // Dynamic MiniMax M2.7 reference rate — decoupled from hardcoded literal
          const minimaxRef = detectCostRate("MiniMax M2.7");
          const cheapRate = (minimaxRef.pricingSource === "known-local" && isFinite(minimaxRef.rate) && minimaxRef.rate > 0)
            ? minimaxRef.rate
            : null;
          if (cheapRate !== null) {
            modelSavingTokens = Math.round(job.totalTokens * Math.max(0, (premiumRate - cheapRate) / premiumRate));
          }
        }
        const jobWasteTokens = errorWastedTokens + scheduleWastedTokens + modelSavingTokens;
        totalWasteTokens += jobWasteTokens;
        if (!isConservativeEstimate) {
          totalCostSaving += job.rate.rate * jobWasteTokens / 1_000_000;
        }
      });

      const summary = {
        totalTokens,
        totalCost,
        jobCount: activeJobs.length,
        errorRate: totalRuns ? totalErrors / totalRuns : 0,
        totalWasteTokens,
        wasteRate: totalTokens ? totalWasteTokens / totalTokens : 0,
        totalCostSaving,
        hasConservativeEstimates,
        knownLocalCost,
        conservativeEstimateCost
      };

      const importSummary = detectImportSource(dataset);
      const readinessGaps = buildReadinessGaps(importSummary);

      return {
        meta: dataset.meta,
        summary,
        importSummary,
        readinessGaps,
        jobs: activeJobs,
        topWaste,
        fixes: buildFixCards(activeJobs)
      };
    }

    function finalizeStat(stat) {
      const rate = detectCostRate(stat.model);
      const errorRate = stat.totalRuns ? stat.errorRuns / stat.totalRuns : 0;
      const scheduleMinutes = parseScheduleMinutes(stat.schedule);
      const issues = classifyWaste(stat, errorRate, scheduleMinutes);
      const evidence = buildWasteEvidence(stat, errorRate, scheduleMinutes);
      const primary = issues[0] || "OK";
      const fixSuggestion = buildFixSuggestion(primary, scheduleMinutes);
      return {
        ...stat,
        rate,
        pricingSource: rate.pricingSource,
        totalCost: (stat.totalTokens / 1_000_000) * rate.rate,
        errorRate,
        scheduleMinutes,
        frequencyLabel: formatFrequency(stat.schedule, scheduleMinutes),
        issues,
        badge: primary,
        fixSuggestion,
        evidence
      };
    }

    function renderReport(report) {
      emptyState.classList.add("hidden");
      reportSection.classList.remove("hidden");

      renderImportSummary(report.importSummary, report.readinessGaps);
      renderSummary(report.summary, report.meta);
      renderTopWaste(report.topWaste, report.summary.totalCost);
      renderJobTable(report.jobs);
      renderFixes(report.fixes, report.importSummary, report.readinessGaps);
    }

    function renderImportSummary(summary, readinessGaps) {
      const container = document.getElementById("importSummary");
      if (!container) return;

      const sourceLabel = {
        'openclaw-like': 'OpenClaw Export',
        'jsonl-records': 'JSONL Run Records',
        'zip-mixed': 'Mixed Export (ZIP)',
        'generic-json': 'Generic JSON',
        'unknown': 'Unknown Source'
      }[summary.detectedSource] || summary.detectedSource;

      const confidenceLabel = {
        'high': 'High confidence',
        'medium': 'Medium confidence',
        'low': 'Low confidence'
      }[summary.confidence] || summary.confidence;

      const ruleHintLabel = {
        'full': 'Strong audit readiness',
        'partial': 'Partial audit evidence',
        'limited': 'Limited audit evidence',
        'unavailable': 'No audit evidence detected'
      }[summary.supportedRuleHint] || summary.supportedRuleHint;

      // Present evidence tags
      const presentTags = [];
      if (summary.evidenceHint.hasJobs) presentTags.push('Jobs');
      if (summary.evidenceHint.hasRuns) presentTags.push('Runs');
      if (summary.evidenceHint.hasTokens) presentTags.push('Tokens');
      if (summary.evidenceHint.hasErrors) presentTags.push('Errors');
      if (summary.evidenceHint.hasSchedules) presentTags.push('Schedules');
      if (summary.evidenceHint.hasModels) presentTags.push('Models');

      // Missing evidence tags
      const missingTags = [];
      if (!summary.evidenceHint.hasJobs) missingTags.push('Jobs missing');
      if (!summary.evidenceHint.hasRuns) missingTags.push('Runs missing');
      if (!summary.evidenceHint.hasTokens) missingTags.push('Tokens missing');
      if (!summary.evidenceHint.hasErrors) missingTags.push('Errors missing');
      if (!summary.evidenceHint.hasSchedules) missingTags.push('Schedules missing');
      if (!summary.evidenceHint.hasModels) missingTags.push('Models missing');

      // Build gap sections
      const gapSections = readinessGaps.map((gap) => `
        <div class="gap-section">
          <div class="gap-label">${escapeHtml(gap.label)}</div>
          <div class="gap-diagnostics">
            ${gap.affectedDiagnostics.map((d) => `<div class="gap-diag-item">• ${escapeHtml(d)}</div>`).join('')}
          </div>
          <div class="gap-next-step">
            <span class="gap-next-label">Next step:</span> ${escapeHtml(gap.manualNextStep)}
          </div>
        </div>
      `).join('');

      // OpenClaw import tip
      const importTip = `
        <div class="import-tip">
          <span class="gap-next-label">Tip:</span>
          Re-import <code>~/.openclaw/cron/jobs.json</code> (and re-drop the run JSONL folder) after any config changes to see the latest jobs, schedules, and model fields.
        </div>
      `;

      // Audit strength framing — contextual explanation of what the evidence quality means
      const hasPresentEvidence = presentTags.length > 0;
      const hasMissingEvidence = missingTags.length > 0;
      let auditStrengthNote = '';
      if (hasPresentEvidence || hasMissingEvidence) {
        if (summary.supportedRuleHint === 'full') {
          auditStrengthNote = 'Full evidence detected — core diagnostics have the strongest available evidence.';
        } else if (summary.supportedRuleHint === 'partial') {
          auditStrengthNote = 'Partial evidence detected — most diagnostics are available, but some may be weakened.';
        } else if (summary.supportedRuleHint === 'limited') {
          auditStrengthNote = 'Limited evidence detected — only basic diagnostics available. Import more record types to strengthen the audit.';
        } else {
          auditStrengthNote = 'Minimal evidence detected — audit strength is limited. Import run history, schedules, and model fields for stronger diagnostics.';
        }
      }

      container.innerHTML = `
        <div class="import-summary">
          <div class="import-summary-header">
            <span class="import-source">${escapeHtml(sourceLabel)}</span>
            <span class="import-meta">${summary.recordCount} records · ${summary.fileCount} file(s)</span>
          </div>
          <div class="import-summary-row">
            <span class="import-badge confidence-${escapeHtml(summary.confidence)}">${escapeHtml(confidenceLabel)}</span>
            <span class="import-badge">${escapeHtml(ruleHintLabel)}</span>
          </div>
          ${presentTags.length > 0 ? `<div class="import-tags">${presentTags.map(t => `<span class="import-tag present">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
          ${missingTags.length > 0 ? `<div class="import-tags missing-tags">${missingTags.map(t => `<span class="import-tag missing">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
          ${auditStrengthNote ? `<div class="gap-section" style="margin-top:8px"><span class="gap-next-label">Audit strength:</span> ${escapeHtml(auditStrengthNote)} Fix cards below are evidence-backed — they are manual CLI guidance only, not auto-applied changes.</div>` : ''}
          ${gapSections.length > 0 ? `<div class="gap-list">${gapSections}</div>` : ''}
          ${gapSections.length > 0 ? importTip : ''}
          <div class="import-privacy-note">All analysis stays on your device — no data is sent anywhere.</div>
        </div>
      `;
    }

    function renderSummary(summary, meta) {
      const items = summary.hasConservativeEstimates
        ? [
            {
              label: "Avoidable Token Burn",
              value: formatInteger(summary.totalWasteTokens) + " (" + formatPercent(summary.wasteRate) + ")",
              help: "Tokens burned by avoidable waste — fix the root cause to reclaim",
              group: "waste"
            },
            {
              label: "Total Tokens",
              value: formatInteger(summary.totalTokens),
              help: "Aggregate tokens across all runs"
            },
            {
              label: "Error Rate",
              value: formatPercent(summary.errorRate),
              help: "Failed runs across all parsed jobs"
            },
            {
              label: "Approx. Avoidable Cost Exposure",
              value: formatCurrency(summary.totalCostSaving),
              help: "Approximate recoverable cost from known-local waste only; excludes conservative unknown exposure.",
              group: "waste"
            },
            {
              label: "Known Local (Approx.)",
              value: formatCurrency(summary.knownLocalCost),
              help: "Based on identified models — cost is approximate; token waste is the primary signal",
              critical: true
            },
            {
              label: "Unknown Model (Conservative Est.)",
              value: formatCurrency(summary.conservativeEstimateCost),
              help: "Estimated cost for unknown models — may be high; cost is approximate",
              critical: true
            },
            {
              label: "Approx. Cost Exposure",
              value: formatCurrency(summary.totalCost),
              help: "Total across all models — cost is approximate; token waste is the primary signal",
              critical: true
            }
          ]
        : [
            {
              label: "Total Tokens",
              value: formatInteger(summary.totalTokens),
              help: "Aggregate tokens across all runs",
              critical: true
            },
            {
              label: "Error Rate",
              value: formatPercent(summary.errorRate),
              help: "Failed runs across all parsed jobs"
            },
            {
              label: "Avoidable Token Burn",
              value: formatInteger(summary.totalWasteTokens) + " (" + formatPercent(summary.wasteRate) + ")",
              help: "Tokens burned by avoidable waste — fix the root cause to reclaim",
              group: "waste"
            },
            {
              label: "Approx. Avoidable Cost Exposure",
              value: formatCurrency(summary.totalCostSaving),
              help: "Approximate cost of avoidable token waste — not a precise figure",
              group: "waste"
            },
            {
              label: "Approx. Cost Exposure",
              value: formatCurrency(summary.totalCost),
              help: "Based on model-specific token pricing — cost is approximate; token waste is the primary signal",
              critical: true
            }
          ];

      summaryGrid.innerHTML = items.map((item) => `
        <article class="panel summary-card">
          <div class="summary-label">${escapeHtml(item.label)}</div>
          <div class="summary-value${item.critical ? " critical" : item.savings ? " savings" : ""}">${escapeHtml(item.value)}</div>
          <div class="summary-help">${escapeHtml(item.help)}</div>
        </article>
      `).join("");

      if (meta && (meta.openclaw_version || meta.export_date)) {
        const footer = document.createElement("div");
        footer.className = "meta-footer";
        footer.textContent = `OpenClaw ${meta.openclaw_version || "unknown"} - Exported ${formatDate(meta.export_date)}`;
        summaryGrid.appendChild(footer);
      }
    }

    function renderTopWaste(topWaste, totalCost) {
      if (!topWaste.length) {
        wasteList.innerHTML = `<div class="panel waste-card"><div>No jobs found in the loaded export.</div></div>`;
        renderPieChart([], 0);
        return;
      }

      // Get cheapRate once for tier-sort comparisons
      const minimaxRef = detectCostRate("MiniMax M2.7");
      const cheapRate = (minimaxRef.pricingSource === "known-local" && isFinite(minimaxRef.rate) && minimaxRef.rate > 0)
        ? minimaxRef.rate
        : undefined;

      // Tier 1: positive estimatedDailyWasteTokens (> 0, not merely non-null)
      // Tier 2: positive estimatedWastePerRun (> 0, not merely non-null)
      // Tier 3: totalTokens × errorRate desc
      const sortedWaste = [...topWaste].sort((a, b) => {
        const aDaily = estimateDailyWasteTokens(a, cheapRate);
        const bDaily = estimateDailyWasteTokens(b, cheapRate);
        if (aDaily !== null && aDaily > 0 && bDaily !== null && bDaily > 0) return bDaily - aDaily;
        if (aDaily !== null && aDaily > 0) return -1;
        if (bDaily !== null && bDaily > 0) return 1;
        const aPerRun = estimateWastePerRun(a, cheapRate);
        const bPerRun = estimateWastePerRun(b, cheapRate);
        if (aPerRun !== null && aPerRun > 0 && bPerRun !== null && bPerRun > 0) return bPerRun - aPerRun;
        if (aPerRun !== null && aPerRun > 0) return -1;
        if (bPerRun !== null && bPerRun > 0) return 1;
        const wasteA = a.totalTokens * a.errorRate;
        const wasteB = b.totalTokens * b.errorRate;
        return wasteB - wasteA;
      });

      wasteList.innerHTML = sortedWaste.map((job, rank) => {
        const wastedTokens = Math.round(job.totalTokens * job.errorRate);
        const wastedCost = (wastedTokens / 1_000_000) * job.rate.rate;
        return `
        <article class="panel waste-card">
          <div class="rank-chip">#${rank + 1}</div>
          <div>
            <h3>${escapeHtml(job.name)}</h3>
            <div class="meta-line">${escapeHtml(formatInteger(job.totalTokens))} tokens &mdash; ~${escapeHtml(formatCurrency(job.totalCost))} approx. &mdash; ${escapeHtml(job.model || "Unknown")}</div>
            ${wastedTokens > 0 ? `<div class="meta-line" style="color:#ff7849">~${escapeHtml(formatInteger(wastedTokens))} tokens wasted (~${escapeHtml(formatCurrency(wastedCost))})</div>` : ""}
          </div>
          <div>${renderBadge(job.badge)}</div>
        </article>
      `}).join("");

      renderPieChart(sortedWaste, totalCost);
    }

    function renderPieChart(topWaste, totalCost) {
      const pieChart = document.getElementById("pieChart");
      const pieLegend = document.getElementById("pieLegend");
      if (!pieChart || !pieLegend) return;

      if (!topWaste.length || totalCost <= 0) {
        pieChart.innerHTML = "";
        pieLegend.innerHTML = "";
        return;
      }

      // Rank by wasted tokens (error tokens), not by total cost
      const top10 = [...topWaste].sort((a, b) => {
        const wastedA = a.totalTokens * a.errorRate;
        const wastedB = b.totalTokens * b.errorRate;
        return wastedB - wastedA;
      }).slice(0, 10);
      const palette = ["#ff5d73", "#ff7849", "#ff9f43", "#35d07f", "#61dafb", "#a78bfa", "#f472b6", "#34d399", "#60a5fa", "#818cf8"];
      let cumulative = 0;
      const slices = top10.map((job, i) => {
        const wastedTokens = job.totalTokens * job.errorRate;
        // Use wasted cost as the pie slice metric, fallback to totalCost if no waste
        const metric = wastedTokens > 0 ? wastedTokens * job.rate.rate / 1_000_000 : job.totalCost;
        const totalMetric = totalCost > 0 ? totalCost : 1;
        const pct = totalMetric > 0 ? metric / totalMetric : 0;
        const startAngle = cumulative * 360;
        cumulative += pct;
        return { job, pct, metric, color: palette[i % palette.length], startAngle };
      });

      const size = 220;
      const cx = size / 2;
      const r = size / 2 - 8;

      let svgParts = [`<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="display:block;margin:0 auto">`];
      if (slices.length === 1) {
        svgParts.push(`<circle cx="${cx}" cy="${cx}" r="${r}" fill="${slices[0].color}" />`);
      } else {
        slices.forEach((slice, i) => {
          if (slice.pct <= 0) return;
          const endAngle = slice.startAngle + slice.pct * 360 - 0.5;
          const large = slice.pct > 0.5 ? 1 : 0;
          const sa = (slice.startAngle - 90) * Math.PI / 180;
          const ea = (endAngle - 90) * Math.PI / 180;
          const x1 = (cx + r * Math.cos(sa)).toFixed(2);
          const y1 = (cx + r * Math.sin(sa)).toFixed(2);
          const x2 = (cx + r * Math.cos(ea)).toFixed(2);
          const y2 = (cx + r * Math.sin(ea)).toFixed(2);
          if (i === 0 && slice.pct >= 0.999) {
            svgParts.push(`<circle cx="${cx}" cy="${cx}" r="${r}" fill="${slice.color}" />`);
          } else {
            svgParts.push(`<path d="M${cx},${cx} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z" fill="${slice.color}" stroke="rgba(0,0,0,0.2)" stroke-width="1.5" />`);
          }
        });
      }
      svgParts.push("</svg>");
      pieChart.innerHTML = svgParts.join("");

      pieLegend.innerHTML = slices.map((slice) => `
        <div class="legend-item">
          <div class="legend-dot" style="background:${slice.color}"></div>
          <div class="legend-label" title="${escapeHtml(slice.job.name)}">${escapeHtml(slice.job.name)}</div>
          <div class="legend-pct">${(slice.pct * 100).toFixed(1)}%</div>
        </div>
      `).join("");
    }

    function renderJobTable(jobs) {
      const sorted = [...jobs].sort((left, right) => compareJobs(left, right, state.sortKey, state.sortDir));
      jobTableBody.innerHTML = sorted.map((job) => `
        <tr>
          <td>
            <div class="job-name">
              <strong>${escapeHtml(job.name)}</strong>
              <span class="job-model">${escapeHtml(job.model || "Unknown model")}</span>
              ${renderBadge(job.badge)}
            </div>
          </td>
          <td>${escapeHtml(formatInteger(job.totalTokens))}</td>
          <td>${escapeHtml(formatCurrency(job.totalCost))}</td>
          <td>${escapeHtml(job.frequencyLabel)}</td>
          <td>${escapeHtml(formatPercent(job.errorRate))}</td>
        </tr>
      `).join("");
    }


    function cmdLine(text) {
      // Render a single CLI command line with a copy button
      return `<div class="cmd-line">
        <code>${escapeHtml(text)}</code>
        <button class="copy-btn" onclick="copyCmd(this)" title="Copy">📋</button>
      </div>`;
    }

    function renderFixes(fixes, importSummary, readinessGaps) {
      // If BOTH job definitions AND run history are missing, suppress fix cards.
      // Jobs without runs → show fixes (job-level evidence is present).
      // Runs without jobs → show fixes (usage evidence is present).
      if (!importSummary.evidenceHint.hasJobs && !importSummary.evidenceHint.hasRuns) {
        fixGrid.innerHTML = `
          <div class="panel fix-card restraint-card">
            <div class="restraint-message">
              Fix cards need at least job definitions or run history to show evidence-backed recommendations.<br>
              Import a full ZIP, jobs.json, or run-history JSONL to unlock manual fix guidance.<br>
              Any fix guidance shown by TokenSave is CLI text only — no changes are applied automatically.
            </div>
          </div>
        `;
        return;
      }

      fixGrid.innerHTML = fixes.map((item) => {
        const isRed = ["CRITICAL", "ERROR_WASTE"].includes(item.category);
        const isGreen = item.category === "OK";
        const cardClass = isRed ? "fix-card red-header" : isGreen ? "fix-card green-header" : "fix-card";
        const tagClass = isRed ? "red" : "green";
        const jobTags = item.jobs.slice(0, 5).map((job) =>
          `<span class="fix-job-tag ${tagClass}">${escapeHtml(job.name)}</span>`
        ).join("");
        const more = item.jobs.length > 5 ? `<span class="fix-job-tag ${tagClass}" style="opacity:0.5">+${item.jobs.length - 5} more</span>` : "";

        // Build action steps with real job IDs
        const jobIds = item.jobs.map((j) => j.jobId || j.id || j.name).filter(Boolean);
        const idList = jobIds.join(" ");
        const actionHtml = buildFixSteps(item.category, idList, item.config.action);
        const evidenceBlurb = formatEvidenceBlurb(item.jobs, item.category);

        return `
          <article class="panel ${cardClass}">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
              ${renderBadge(item.category)}
            </div>
            <div style="margin-bottom:8px">
              <strong style="font-size:1rem;color:#ffd5db">${escapeHtml(item.config.problem)}</strong>
            </div>
            ${evidenceBlurb ? `<div class="fix-evidence">Why: ${escapeHtml(evidenceBlurb)}</div>` : ''}
            <div class="fix-action">${actionHtml}</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:12px">${jobTags}${more}</div>
          </article>
`;
      }).join("");

      // Add copy function to window so inline onclick works
      if (!window.copyCmd) {
        window.copyCmd = function(btn) {
          const text = btn.parentElement.querySelector('code').textContent;
          navigator.clipboard.writeText(text).then(() => {
            btn.textContent = '✓';
            setTimeout(() => { btn.textContent = '📋'; }, 1200);
          });
        };
      }
    }

    function buildFixSteps(category, idList, genericAction) {
      // Build step-by-step HTML with real job IDs, one command per line with copy button
      if (category === "CRITICAL") {
        // One command per job ID to avoid multi-ID risk
        const idLines = idList.split(',').map(id => id.trim()).filter(Boolean);
        const editSteps = idLines.map(id => `openclaw cron edit ${id} --every 30m`);
        const disableSteps = idLines.map(id => `openclaw cron disable ${id}`);
        const steps = [
          `openclaw cron list --all`,
          ...editSteps,
          ...disableSteps,
          `Re-import ~/.openclaw/cron/jobs.json to verify`
        ];
        return steps.map((s, i) => `<div class="fix-step"><span class="step-num">${i + 1}.</span><div class="step-body">${cmdLine(s)}</div></div>`).join("");
      }
      if (category === "LLM_AGENT_CRON") {
        const idLines = idList.split(',').map(id => id.trim()).filter(Boolean);
        const steps = [
          { cmd: `openclaw cron list --all`, label: "Find the job" },
          ...idLines.map(id => ({ cmd: `openclaw cron disable ${id}`, label: `Stop waste for ${id.slice(0,8)}…` })),
          { cmd: `Re-import ~/.openclaw/cron/jobs.json`, label: "Verify changes" }
        ];
        return steps.map((s, i) => `<div class="fix-step"><span class="step-num">${i + 1}.</span><div class="step-body"><span class="step-label">${escapeHtml(s.label)}</span>${cmdLine(s.cmd)}</div></div>`).join("");
      }
      if (category === "ERROR_WASTE") {
        const idLines = idList.split(',').map(id => id.trim()).filter(Boolean);
        const runsShowSteps = idLines.flatMap(id => [
          `openclaw cron show ${id}`,
          `openclaw cron runs --id ${id} --limit 5`
        ]);
        const enableSteps = idLines.map(id => `openclaw cron edit ${id} --enable`);
        const steps = [
          ...runsShowSteps,
          { text: `Fix the cause (bad credentials, missing file, wrong API key, etc.)` },
          ...enableSteps,
          ...idLines.map(id => `openclaw cron runs --id ${id} --limit 10`)
        ];
        return steps.map((s, i) => {
          const content = typeof s === 'string' ? cmdLine(s) : `<span style="color:#a8b1d1;font-size:0.88rem">${escapeHtml(s.text)}</span>`;
          return `<div class="fix-step"><span class="step-num">${i + 1}.</span><div class="step-body">${content}</div></div>`;
        }).join("");
      }
      if (category === "PREMIUM_MODEL_WASTE") {
        const idLines = idList.split(',').map(id => id.trim()).filter(Boolean);
        const editSteps = idLines.map(id => `openclaw cron edit ${id} --model mini-max/m2.7`);
        const runSteps = idLines.map(id => `openclaw cron run ${id}`);
        const steps = [
          `openclaw cron list --all`,
          ...editSteps,
          ...runSteps,
          `Monitor the next 3 runs to confirm quality`
        ];
        return steps.map((s, i) => `<div class="fix-step"><span class="step-num">${i + 1}.</span><div class="step-body">${cmdLine(s)}</div></div>`).join("");
      }
      if (category === "WARNING") {
        const idLines = idList.split(',').map(id => id.trim()).filter(Boolean);
        const editSteps = idLines.map(id => `openclaw cron edit ${id} --every 6h`);
        const steps = [
          `openclaw cron list --all`,
          ...editSteps,
          `Compare results after 3 runs before committing`
        ];
        return steps.map((s, i) => `<div class="fix-step"><span class="step-num">${i + 1}.</span><div class="step-body">${cmdLine(s)}</div></div>`).join("");
      }
      return `<span style="color:#a8b1d1;font-size:0.88rem">${escapeHtml(genericAction)}</span>`;
    }

    function updateSortIndicators() {
      document.querySelectorAll("[data-sort]").forEach((button) => {
        const indicator = button.querySelector(".sort-indicator");
        if (!indicator) {
          return;
        }
        if (button.dataset.sort === state.sortKey) {
          indicator.textContent = state.sortDir === "asc" ? "^" : "v";
        } else {
          indicator.textContent = "<>";
        }
      });
    }

    function renderBadge(badge) {
      const config = FIX_BADGES[badge] || { label: badge, color: "#35d07f" };
      return `<span class="badge" style="color:${config.color};border-color:${config.color}80;background:${config.color}18">${escapeHtml(config.label)}</span>`;
    }

    function setLoading(message) {
      loadingText.textContent = message;
      loadingMessage.classList.add("visible");
    }

    function hideLoading() {
      loadingMessage.classList.remove("visible");
    }

    function mapErrorMessage(raw) {
      const msg = String(raw);
      if (msg.includes("Malformed JSON in") && !msg.includes("JSONL")) {
        return "This JSON file could not be parsed. Re-export from OpenClaw or check the file is not corrupted.";
      }
      if (msg.includes("Malformed JSONL")) {
        return "Each JSONL line must be a valid JSON object. Re-export run history if needed.";
      }
      if (msg.includes("does not contain jobs.json or run")) {
        return "This ZIP does not contain jobs.json or run/*.jsonl. Export a full OpenClaw diagnostic ZIP.";
      }
      if (msg.includes("Unsupported file type")) {
        return "Use a .zip, .json, or .jsonl file from your OpenClaw export.";
      }
      return msg;
    }

    function showError(message) {
      emptyState.classList.remove("hidden");
      reportSection.classList.add("hidden");
      errorMessage.textContent = message;
      errorMessage.classList.add("visible");
    }

    function clearError() {
      errorMessage.textContent = "";
      errorMessage.classList.remove("visible");
    }

    function nextFrame() {
      return new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }
