// @ts-nocheck
import { stringify, normalizeKey, slugify, cleanFileStem, escapeHtml, formatInteger, formatCurrency, formatPercent, formatDate, formatShortDuration } from './utils';
    // Cost rates in USD per 1M tokens (input + output combined, approximate)
    // Unknown models default to MiniMax M2.7 rate
    const COST_RATES = [
      { label: "MiniMax M2.7", match: /\bminimax.*m2\.?7\b|\bm2\.?7\b/i, rate: 0.14 },
      { label: "MiniMax M2.5", match: /\bminimax.*m2\.?5\b|\bm2\.?5\b/i, rate: 0.12 },
      { label: "GPT-4o", match: /\bgpt-?4o\b/i, rate: 2.5 },
      { label: "Claude Sonnet", match: /\bsonnet\b/i, rate: 3 },
      { label: "Claude Opus", match: /\bopus\b/i, rate: 15 },
      { label: "GPT-5-codex", match: /\bgpt-?5[\d.]*.*codex\b|\bcodex\b/i, rate: 15 },
      { label: "DeepSeek Chat", match: /\bdeepseek\b/i, rate: 0.28 }
    ];

    const FIX_LIBRARY = {
      CRITICAL: {
        title: "Burning too many tokens",
        problem: "This job runs on a very short schedule with agent-turn mode, burning tokens on every single run.",
        action: "1) Run: openclaw jobs list — find this job\n2) Run: openclaw jobs edit [JOB_ID] --schedule \"*/30 * * * *\" (or any interval >= 30min)\n3) Or if it's a simple check: openclaw jobs edit [JOB_ID] --no-agent-turn\n4) Then run: openclaw export to verify the change",
        impactLabel: "cost per run"
      },
      LLM_AGENT_CRON: {
        title: "LLM-powered cron job",
        problem: "This scheduled job uses agent-turn mode — the LLM is invoked on every trigger to decide what to do, even for routine tasks. This is the single biggest source of token waste in OpenClaw.",
        action: "1) Run: openclaw jobs list — find this job\n2) Run: openclaw jobs edit [JOB_ID] --no-agent-turn\n3) Run: openclaw export to verify the change",
        impactLabel: "agent-turn overhead"
      },
      ERROR_WASTE: {
        title: "Failing repeatedly",
        problem: "This job is failing repeatedly, and each failed run burns tokens with nothing to show.",
        action: "1) Run: openclaw jobs logs [JOB_ID] --last 1 — get the first error message\n2) Fix the cause (bad credentials, missing file, wrong API key, etc.)\n3) Run: openclaw jobs edit [JOB_ID] --resume\n4) Watch: openclaw jobs logs [JOB_ID] --watch",
        impactLabel: "wasted tokens"
      },
      PREMIUM_MODEL_WASTE: {
        title: "Overpaying for simple work",
        problem: "This job uses an expensive model (Claude Opus / GPT-4o) for a simple check or monitor task.",
        action: "1) Run: openclaw jobs list — find this job\n2) Run: openclaw jobs edit [JOB_ID] --model mini-max/m2.7\n3) Run: openclaw jobs run [JOB_ID] --dry-run to verify it still works\n4) Monitor the next 3 runs to confirm output quality",
        impactLabel: "potential saving"
      },
      WARNING: {
        title: "Running too often",
        problem: "This job runs very frequently. It works, but the frequency may be unnecessary.",
        action: "1) Run: openclaw jobs list — find this job\n2) Ask: does this need to run every [SCHEDULE]? Could it run every 1h / 6h / daily?\n3) Run: openclaw jobs edit [JOB_ID] --schedule \"0 */6 * * *\" (e.g. 6h)\n4) Compare results after 3 runs before committing the new schedule",
        impactLabel: "schedule"
      },
      OK: {
        title: "Healthy — no action needed",
        problem: "No waste detected. This job is running within acceptable parameters.",
        action: "Keep monitoring. Recheck if the task changes or token usage grows.",
        impactLabel: "status"
      }
    };

    const FIX_BADGES = {
      CRITICAL: { label: "CRITICAL", color: "#ff5d73" },
      LLM_AGENT_CRON: { label: "LLM AGENT", color: "#ff9f43" },
      ERROR_WASTE: { label: "FIX FIRST", color: "#ff7849" },
      PREMIUM_MODEL_WASTE: { label: "SWITCH MODEL", color: "#f59e0b" },
      WARNING: { label: "REVIEW", color: "#f59e0b" },
      OK: { label: "OK", color: "#35d07f" }
    };

    const state = {
      report: null,
      sortKey: "cost",
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
          runBundles: []
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
        showError(error instanceof Error ? error.message : String(error));
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
      const rankedWaste = [...activeJobs]
        .filter((job) => job.badge !== "OK")
        .sort((left, right) => {
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
        let modelSavingTokens = 0;
        if (job.badge === "PREMIUM_MODEL_WASTE") {
          const premiumRate = job.rate.rate;
          const cheapRate = 0.14; // MiniMax M2.7
          modelSavingTokens = Math.round(job.totalTokens * Math.max(0, (premiumRate - cheapRate) / premiumRate));
        }
        const jobWasteTokens = errorWastedTokens + scheduleWastedTokens + modelSavingTokens;
        totalWasteTokens += jobWasteTokens;
        totalCostSaving += job.rate.rate * jobWasteTokens / 1_000_000;
      });

      const summary = {
        totalTokens,
        totalCost,
        jobCount: activeJobs.length,
        errorRate: totalRuns ? totalErrors / totalRuns : 0,
        totalWasteTokens,
        wasteRate: totalTokens ? totalWasteTokens / totalTokens : 0,
        totalCostSaving
      };

      return {
        meta: dataset.meta,
        summary,
        jobs: activeJobs,
        topWaste,
        fixes: buildFixCards(activeJobs)
      };
    }

    function normalizeJobs(jobs) {
      return jobs.map((job, index) => {
        const id = stringify(job.id != null ? job.id : `job-${index + 1}`);
        const name = stringify(job.name || job.title || `Unnamed Job ${index + 1}`);
        const schedule = job.schedule ?? job.interval ?? job.frequency ?? job.cron ?? null;
        const model = stringify(job.model || job.model_name || job.modelName || "Unknown");
        const promptText = [job.task, job.type, job.description, job.prompt, name].filter(Boolean).join(" ");
        return {
          raw: job,
          id,
          lookupId: normalizeKey(id),
          name,
          slug: slugify(name),
          schedule,
          model,
          promptText,
          synthetic: false
        };
      });
    }

    function createJobStat(job) {
      return {
        ...job,
        totalTokens: 0,
        totalRuns: 0,
        errorRuns: 0
      };
    }

    function ensureSyntheticStat(record, fileName, statsById) {
      const inferredName = stringify(record.jobName || record.job_name || record.name || cleanFileStem(fileName) || "Unmapped Job");
      const inferredId = normalizeKey(stringify(record.jobId || record.job_id || inferredName));
      const key = `synthetic:${inferredId}`;

      if (!statsById.has(key)) {
        statsById.set(key, {
          raw: {},
          id: key,
          lookupId: key,
          name: inferredName,
          slug: slugify(inferredName),
          schedule: null,
          model: stringify(record.model || record.model_name || "Unknown"),
          promptText: inferredName,
          synthetic: true,
          totalTokens: 0,
          totalRuns: 0,
          errorRuns: 0
        });
      }

      return statsById.get(key);
    }

    function resolveJob(record, fileName, indexes) {
      const fileStem = cleanFileStem(fileName);
      const idCandidates = [
        record.jobId,
        record.job_id,
        record.job && record.job.id,
        fileStem
      ].filter((value) => value != null).map((value) => normalizeKey(value));

      for (const candidate of idCandidates) {
        if (indexes.byId.has(candidate)) {
          return indexes.byId.get(candidate);
        }
      }

      const nameCandidates = [
        record.jobName,
        record.job_name,
        record.job && record.job.name,
        fileStem
      ].filter(Boolean).map((value) => slugify(value));

      for (const candidate of nameCandidates) {
        if (indexes.bySlug.has(candidate)) {
          return indexes.bySlug.get(candidate);
        }
      }

      return null;
    }

    function applyRunRecord(stat, record) {
      stat.totalRuns += 1;
      stat.totalTokens += extractTokenCount(record);
      if (isErrorRecord(record)) {
        stat.errorRuns += 1;
      }
      if ((stat.model === "Unknown" || !stat.model) && (record.model || record.model_name)) {
        stat.model = stringify(record.model || record.model_name);
      }
    }

    function finalizeStat(stat) {
      const rate = detectCostRate(stat.model);
      const errorRate = stat.totalRuns ? stat.errorRuns / stat.totalRuns : 0;
      const scheduleMinutes = parseScheduleMinutes(stat.schedule);
      const issues = classifyWaste(stat, errorRate, scheduleMinutes);
      const primary = issues[0] || "OK";
      const fixSuggestion = buildFixSuggestion(primary, scheduleMinutes);
      return {
        ...stat,
        rate,
        totalCost: (stat.totalTokens / 1_000_000) * rate.rate,
        errorRate,
        scheduleMinutes,
        frequencyLabel: formatFrequency(stat.schedule, scheduleMinutes),
        issues,
        badge: primary,
        fixSuggestion
      };
    }

    function classifyWaste(job, errorRate, scheduleMinutes) {
      const issues = [];
      const agentTurn = readBoolean(job.raw.agentTurn ?? job.raw.agent_turn ?? job.raw.agent_turn_enabled ?? false);
      const execType = isExecType(job.raw, job.promptText);
      const simpleCheck = isSimpleCheck(job.raw, job.promptText);
      const premiumModel = /opus|sonnet/i.test(job.model);
      const highFrequencyExec = execType && scheduleMinutes != null && scheduleMinutes < 60;

      if (agentTurn && execType && scheduleMinutes != null && scheduleMinutes < 30) {
        issues.push("CRITICAL");
      }
      // Scheduled + agent-turn but not CRITICAL (schedule >= 30min but still burning LLM on every trigger)
      if (agentTurn && scheduleMinutes != null && !issues.includes("CRITICAL")) {
        issues.push("LLM_AGENT_CRON");
      }
      if (errorRate > 0.1) {
        issues.push("ERROR_WASTE");
      }
      if (premiumModel && simpleCheck) {
        issues.push("PREMIUM_MODEL_WASTE");
      }
      if (highFrequencyExec && !issues.includes("CRITICAL")) {
        issues.push("WARNING");
      }

      return issues.length ? issues : ["OK"];
    }

    function buildFixSuggestion(badge, scheduleMinutes) {
      if (badge === "CRITICAL") {
        return "Reduce frequency (>= 30 min) or disable agent-turn mode.";
      }
      if (badge === "ERROR_WASTE") {
        return "Check failed run logs for the error and fix the root cause.";
      }
      if (badge === "PREMIUM_MODEL_WASTE") {
        return "Switch to a cheaper model like MiniMax M2.7 for this task type.";
      }
      if (badge === "WARNING") {
        return "Consider slowing down the schedule to save tokens.";
      }
      return "Running within acceptable parameters.";
    }

    function buildFixCards(jobs) {
      const categoryMap = new Map();

      jobs.forEach((job) => {
        const categories = job.issues[0] === "OK" ? ["OK"] : job.issues;
        categories.forEach((category) => {
          if (!categoryMap.has(category)) {
            categoryMap.set(category, []);
          }
          categoryMap.get(category).push(job);
        });
      });

      const order = ["CRITICAL", "ERROR_WASTE", "PREMIUM_MODEL_WASTE", "WARNING", "OK"];
      return order
        .filter((category) => categoryMap.has(category))
        .map((category) => ({
          category,
          config: FIX_LIBRARY[category],
          jobs: categoryMap.get(category)
            .sort((left, right) => {
              const lw = left.totalTokens * left.errorRate;
              const rw = right.totalTokens * right.errorRate;
              return rw - lw;
            })
            .slice(0, 4)
        }));
    }

    function renderReport(report) {
      emptyState.classList.add("hidden");
      reportSection.classList.remove("hidden");

      renderSummary(report.summary, report.meta);
      renderTopWaste(report.topWaste, report.summary.totalCost);
      renderJobTable(report.jobs);
      renderFixes(report.fixes);
    }

    function renderSummary(summary, meta) {
      const items = [
        {
          label: "Total Tokens",
          value: formatInteger(summary.totalTokens),
          help: "Aggregate tokens across all runs"
        },
        {
          label: "Estimated Cost",
          value: formatCurrency(summary.totalCost),
          help: "Based on model-specific token pricing",
          critical: true
        },
        {
          label: "Error Rate",
          value: formatPercent(summary.errorRate),
          help: "Failed runs across all parsed jobs"
        },
        {
          label: "Waste from Failures",
          value: formatInteger(summary.totalWasteTokens) + " (" + formatPercent(summary.wasteRate) + ")",
          help: "Tokens burned by failed runs — fix errors to reclaim",
          group: "waste"
        },
        {
          label: "Potential Saving",
          value: formatCurrency(summary.totalCostSaving),
          help: "Cost of those waste tokens at each model's rate",
          group: "waste"
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

      // Sort by absolute wasted tokens (errorTokens) descending
      const sortedWaste = [...topWaste].sort((a, b) => {
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
            <div class="meta-line">${escapeHtml(formatInteger(job.totalTokens))} tokens &mdash; ${escapeHtml(formatCurrency(job.totalCost))} &mdash; ${escapeHtml(job.model || "Unknown")}</div>
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

    function renderFixes(fixes) {
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

        return `
          <article class="panel ${cardClass}">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
              ${renderBadge(item.category)}
            </div>
            <div style="margin-bottom:8px">
              <strong style="font-size:1rem;color:#ffd5db">${escapeHtml(item.config.problem)}</strong>
            </div>
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
        const steps = [
          `openclaw jobs list`,
          `openclaw jobs edit ${idList} --schedule "*/30 * * * *"`,
          `openclaw jobs edit ${idList} --no-agent-turn`,
          `openclaw export`
        ];
        return steps.map((s, i) => `<div class="fix-step"><span class="step-num">${i + 1}.</span><div class="step-body">${cmdLine(s)}</div></div>`).join("");
      }
      if (category === "LLM_AGENT_CRON") {
        const steps = [
          { cmd: `openclaw jobs list`, label: "Find the job" },
          { cmd: `openclaw jobs edit ${idList} --no-agent-turn`, label: "Disable agent-turn (LLM will not be invoked on every run)" },
          { cmd: `openclaw jobs edit ${idList} --type cron`, label: "Convert to plain cron (skip LLM decision on every trigger)" },
          { cmd: `openclaw export`, label: "Verify changes" }
        ];
        return steps.map((s, i) => `<div class="fix-step"><span class="step-num">${i + 1}.</span><div class="step-body"><span class="step-label">${escapeHtml(s.label)}</span>${cmdLine(s.cmd)}</div></div>`).join("");
      }
      if (category === "ERROR_WASTE") {
        const steps = [
          { cmd: `openclaw jobs logs ${idList} --last 1` },
          { text: `Fix the cause (bad credentials, missing file, wrong API key, etc.)` },
          { cmd: `openclaw jobs edit ${idList} --resume` },
          { cmd: `openclaw jobs logs ${idList} --watch` }
        ];
        return steps.map((s, i) => {
          const content = s.cmd ? cmdLine(s.cmd) : `<span style="color:#a8b1d1;font-size:0.88rem">${escapeHtml(s.text)}</span>`;
          return `<div class="fix-step"><span class="step-num">${i + 1}.</span><div class="step-body">${content}</div></div>`;
        }).join("");
      }
      if (category === "PREMIUM_MODEL_WASTE") {
        const steps = [
          `openclaw jobs list`,
          `openclaw jobs edit ${idList} --model mini-max/m2.7`,
          `openclaw jobs run ${idList} --dry-run`,
          `Monitor the next 3 runs to confirm quality`
        ];
        return steps.map((s, i) => `<div class="fix-step"><span class="step-num">${i + 1}.</span><div class="step-body">${cmdLine(s)}</div></div>`).join("");
      }
      if (category === "WARNING") {
        const steps = [
          `openclaw jobs list`,
          `openclaw jobs edit ${idList} --schedule "0 */6 * * *"`,
          `Compare results after 3 runs before committing`
        ];
        return steps.map((s, i) => `<div class="fix-step"><span class="step-num">${i + 1}.</span><div class="step-body">${cmdLine(s)}</div></div>`).join("");
      }
      return `<span style="color:#a8b1d1;font-size:0.88rem">${escapeHtml(genericAction)}</span>`;
    }

    function compareJobs(left, right, key, direction) {
      let result = 0;
      if (key === "name") {
        result = left.name.localeCompare(right.name);
      } else if (key === "tokens") {
        result = left.totalTokens - right.totalTokens;
      } else if (key === "cost") {
        result = left.totalCost - right.totalCost;
      } else if (key === "frequency") {
        const leftValue = left.scheduleMinutes == null ? Number.POSITIVE_INFINITY : left.scheduleMinutes;
        const rightValue = right.scheduleMinutes == null ? Number.POSITIVE_INFINITY : right.scheduleMinutes;
        result = leftValue - rightValue;
      } else if (key === "errorRate") {
        result = left.errorRate - right.errorRate;
      }
      return direction === "asc" ? result : -result;
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

    function parseJson(text, fileName) {
      try {
        return JSON.parse(text);
      } catch (error) {
        throw new Error(`Malformed JSON in ${fileName}: ${error.message}`);
      }
    }

    function parseJsonl(text, fileName) {
      const records = [];
      const lines = text.split(/\r?\n/);

      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return;
        }

        try {
          const record = JSON.parse(trimmed);
          if (record == null || typeof record !== "object" || Array.isArray(record)) {
            throw new Error("Expected an object per line");
          }
          records.push(record);
        } catch (error) {
          throw new Error(`Malformed JSONL in ${fileName} at line ${index + 1}: ${error.message}`);
        }
      });

      return records;
    }

    async function parseZipEntries(arrayBuffer) {
      const bytes = new Uint8Array(arrayBuffer);
      const decoder = new TextDecoder();
      const eocdOffset = findEndOfCentralDirectory(bytes);

      if (eocdOffset < 0) {
        throw new Error("Unable to locate ZIP central directory.");
      }

      const totalEntries = readUint16(bytes, eocdOffset + 10);
      const centralDirOffset = readUint32(bytes, eocdOffset + 16);
      const entries = [];
      let pointer = centralDirOffset;

      for (let index = 0; index < totalEntries; index += 1) {
        if (readUint32(bytes, pointer) !== 0x02014b50) {
          throw new Error("ZIP central directory is malformed.");
        }

        const compressionMethod = readUint16(bytes, pointer + 10);
        const compressedSize = readUint32(bytes, pointer + 20);
        const fileNameLength = readUint16(bytes, pointer + 28);
        const extraLength = readUint16(bytes, pointer + 30);
        const commentLength = readUint16(bytes, pointer + 32);
        const localHeaderOffset = readUint32(bytes, pointer + 42);
        const nameBytes = bytes.slice(pointer + 46, pointer + 46 + fileNameLength);
        const fileName = decoder.decode(nameBytes);

        pointer += 46 + fileNameLength + extraLength + commentLength;

        if (fileName.endsWith("/")) {
          continue;
        }

        const text = await readZipEntryText(bytes, localHeaderOffset, compressedSize, compressionMethod);
        entries.push({ name: fileName, text });
      }

      return entries;
    }

    async function readZipEntryText(bytes, localHeaderOffset, compressedSize, compressionMethod) {
      if (readUint32(bytes, localHeaderOffset) !== 0x04034b50) {
        throw new Error("ZIP local entry header is malformed.");
      }

      const nameLength = readUint16(bytes, localHeaderOffset + 26);
      const extraLength = readUint16(bytes, localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + nameLength + extraLength;
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);

      if (compressionMethod === 0) {
        return new TextDecoder().decode(compressed);
      }

      if (compressionMethod === 8) {
        if (typeof DecompressionStream !== "function") {
          throw new Error("This browser cannot unpack deflated ZIP files. Please use a recent Chromium-based browser.");
        }

        const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        const buffer = await new Response(stream).arrayBuffer();
        return new TextDecoder().decode(buffer);
      }

      throw new Error(`ZIP compression method ${compressionMethod} is not supported by this viewer.`);
    }

    function findEndOfCentralDirectory(bytes) {
      const minOffset = Math.max(0, bytes.length - 65557);
      for (let index = bytes.length - 22; index >= minOffset; index -= 1) {
        if (readUint32(bytes, index) === 0x06054b50) {
          return index;
        }
      }
      return -1;
    }

    function readUint16(bytes, offset) {
      return bytes[offset] | (bytes[offset + 1] << 8);
    }

    function readUint32(bytes, offset) {
      return (
        bytes[offset] |
        (bytes[offset + 1] << 8) |
        (bytes[offset + 2] << 16) |
        (bytes[offset + 3] << 24)
      ) >>> 0;
    }

    function extractTokenCount(record) {
      const candidates = [
        record.tokens,
        record.total_tokens,
        record.token_count,
        record.usage && record.usage.total_tokens,
        record.usage && record.usage.tokens,
        record.metrics && record.metrics.tokens
      ];

      for (const candidate of candidates) {
        const value = Number(candidate);
        if (Number.isFinite(value) && value >= 0) {
          return value;
        }
      }
      return 0;
    }

    function isErrorRecord(record) {
      if (typeof record.error === "boolean") {
        return record.error;
      }
      if (typeof record.error === "string") {
        return record.error.trim().length > 0 && record.error.toLowerCase() !== "false";
      }
      if (record.error && typeof record.error === "object") {
        return true;
      }
      const status = stringify(record.status || record.result || "").toLowerCase();
      return status === "error" || status === "failed" || status === "failure";
    }

    function parseScheduleMinutes(schedule) {
      if (schedule == null) {
        return null;
      }

      if (typeof schedule === "object") {
        // Handle { every: "15m" } or { every: "1h" } or { every: "1d" } style objects
        const everyVal = schedule.every ?? schedule.everyInterval ?? schedule.interval ?? null;
        if (everyVal != null && everyVal !== schedule) {
          return parseScheduleMinutes(everyVal);
        }
        const nested = schedule.interval_minutes ?? schedule.intervalMinutes ?? schedule.minutes ?? schedule.cron ?? schedule.value;
        if (nested != null && nested !== schedule) {
          return parseScheduleMinutes(nested);
        }
      }

      if (typeof schedule === "number" && Number.isFinite(schedule)) {
        if (schedule >= 60_000) {
          return schedule / 60_000;
        }
        return schedule;
      }

      const text = stringify(schedule).trim().toLowerCase();
      if (!text) {
        return null;
      }

      if (/hourly/.test(text)) {
        return 60;
      }
      if (/daily/.test(text)) {
        return 1440;
      }

      let match = text.match(/every\s+(\d+)\s*(minute|min|minutes|mins|m)\b/);
      if (match) {
        return Number(match[1]);
      }

      match = text.match(/every\s+(\d+)\s*(hour|hours|hr|hrs|h)\b/);
      if (match) {
        return Number(match[1]) * 60;
      }

      match = text.match(/^(\d+)\s*(minute|min|minutes|mins|m)\b/);
      if (match) {
        return Number(match[1]);
      }

      match = text.match(/^(\d+)\s*(hour|hours|hr|hrs|h)\b/);
      if (match) {
        return Number(match[1]) * 60;
      }

      match = text.match(/^(\d+)\s*(day|days|d)\b/);
      if (match) {
        return Number(match[1]) * 1440;
      }

      const cron = text.trim().split(/\s+/);
      if (cron.length >= 5) {
        if (cron[0].startsWith("*/")) {
          return Number(cron[0].slice(2));
        }
        if (cron[0] === "0" && cron[1].startsWith("*/")) {
          return Number(cron[1].slice(2)) * 60;
        }
        if (cron[0] === "0" && cron[1] === "*") {
          return 60;
        }
        if (cron[0] === "0" && cron[1] === "0") {
          return 1440;
        }
      }

      return null;
    }

    function formatFrequency(schedule, scheduleMinutes) {
      if (scheduleMinutes != null) {
        return `Every ${formatShortDuration(scheduleMinutes)}`;
      }
      if (schedule && typeof schedule === "object") {
        const nested = schedule.label ?? schedule.cron ?? schedule.every ?? schedule.interval ?? schedule.value;
        if (nested != null) {
          return stringify(nested);
        }
      }
      return schedule ? stringify(schedule) : "Unknown";
    }


    function nextFrame() {
      return new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }
