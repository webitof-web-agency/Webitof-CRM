import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Chip } from "../../components/ui/Chip";
import { PageHeader } from "../../components/ui/PageHeader";
import { formatDateTime } from "../../lib/format";
import { hrm, queryString } from "./hrmApi";
import { Status } from "./HrmShared";
import { ThemedSelect } from "../../components/ui/ThemedSelect";

const STAGE_HINT = {
  Applicant: "New applications",
  Selected: "Chosen, offer not yet made",
  Offer: "Offer made",
  Joined: "Converted to employees",
  Rejected: "Not moving forward",
};

/** Recruitment pipeline: pick a job, see its candidates by stage, move them along, convert the selected ones. */
export function HrmRecruitment({ token, can }) {
  const navigate = useNavigate();
  const [jobId, setJobId] = useState(""),
    [showClosed, setShowClosed] = useState(false),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busyId, setBusyId] = useState(""),
    [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    let active = true;
    hrm(token, `/recruitment/pipeline?${queryString({ jobId, includeClosed: showClosed ? "true" : "" })}`)
      .then((r) => {
        if (!active) return;
        setData(r);
        setError("");
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [token, jobId, showClosed, tick]);

  async function move(candidate, status) {
    if (status === candidate.status) return;
    setBusyId(candidate.id);
    try {
      await hrm(token, `/candidates/${encodeURIComponent(candidate.id)}/stage`, {
        method: "POST",
        body: { status, version: candidate.version },
      });
      toast.success(`${candidate.title} moved to ${status}`);
      reload();
    } catch (e) {
      toast.error(e.message);
      reload();
    } finally {
      setBusyId("");
    }
  }

  if (error && !data)
    return (
      <Card className="p-5">
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
        <Button className="mt-3" size="sm" onClick={reload}>
          Retry
        </Button>
      </Card>
    );
  if (!data) return <Card className="h-40 animate-pulse bg-[var(--surface-2)]" />;

  const selectedJob = data.jobs.find((j) => j.id === data.selectedJobId);
  const byStage = Object.fromEntries(data.stages.map((s) => [s, []]));
  for (const candidate of data.candidates) (byStage[candidate.status] || (byStage[candidate.status] = [])).push(candidate);
  const moveOptions = data.stages.filter((s) => s !== "Joined");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Recruitment pipeline"
        description="Follow candidates from application to joining. Moving a candidate only changes the stage; joining happens through Convert to employee."
      />
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {data.jobs.map((job) => (
            <Chip key={job.id} active={data.selectedJobId === job.id} onClick={() => setJobId(job.id)}>
              {job.title}
              <span className="opacity-70">· {job.candidates}</span>
            </Chip>
          ))}
          {data.unassigned > 0 && (
            <Chip active={data.selectedJobId === "none"} onClick={() => setJobId("none")}>
              No job
              <span className="opacity-70">· {data.unassigned}</span>
            </Chip>
          )}
          {!data.jobs.length && !data.unassigned && (
            <p className="text-sm text-[var(--text-muted)]">
              No job openings or candidates yet. Add a job under <Link className="text-[var(--primary)] underline" to="/app/hrm/job">Job openings</Link>.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--primary)]"
              checked={showClosed}
              onChange={(e) => setShowClosed(e.target.checked)}
            />
            Show closed jobs
          </label>
          {selectedJob && (
            <span className="flex flex-wrap items-center gap-2">
              <Status value={selectedJob.status} />
              {selectedJob.details?.openings ? `${selectedJob.details.openings} open position(s)` : null}
              {` · ${selectedJob.joined} joined of ${selectedJob.candidates} candidate(s)`}
            </span>
          )}
        </div>
      </Card>
      {error && (
        <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Could not refresh ({error}). Showing the last data.
        </p>
      )}
      {data.selectedJobId && data.candidates.length === 0 ? (
        <Card className="p-5 text-sm text-[var(--text-muted)]">
          No candidates for this job yet. Add them under{" "}
          <Link className="text-[var(--primary)] underline" to="/app/hrm/candidate">
            Candidates
          </Link>
          , linking each to the job.
        </Card>
      ) : (
        <div className="grid auto-cols-[17rem] grid-flow-col gap-3 overflow-x-auto pb-2">
          {data.stages.map((stage) => (
            <section key={stage} aria-label={`${stage} candidates`} className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-2">
              <header className="mb-2 flex items-center justify-between px-1">
                <h3 className="text-xs font-bold text-[var(--text-main)]" title={STAGE_HINT[stage]}>
                  {stage}
                </h3>
                <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-muted)]">
                  {byStage[stage]?.length || 0}
                </span>
              </header>
              <div className="space-y-2">
                {(byStage[stage] || []).map((candidate) => (
                  <article key={candidate.id} className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-main)]" title={candidate.title}>
                        {candidate.title}
                      </p>
                      <p className="truncate text-xs text-[var(--text-muted)]">
                        {[candidate.details?.email, candidate.details?.phone, candidate.details?.source].filter(Boolean).join(" · ") || "No contact details"}
                      </p>
                    </div>
                    {candidate.interviewId && (
                      <p className="rounded-lg bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--text-muted)]">
                        Interview {candidate.interviewStatus?.toLowerCase()}
                        {candidate.interviewAt ? ` · ${formatDateTime(candidate.interviewAt)}` : ""}
                        {candidate.interviewer ? ` · ${candidate.interviewer}` : ""}
                      </p>
                    )}
                    {stage === "Joined" ? (
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">Joined as an employee</p>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <ThemedSelect
                          aria-label={`Stage for ${candidate.title}`}
                          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--text-main)] disabled:opacity-50"
                          value={candidate.status}
                          disabled={busyId === candidate.id}
                          onChange={(e) => move(candidate, e.target.value)}
                        >
                          {moveOptions.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </ThemedSelect>
                        {["Selected", "Offer"].includes(candidate.status) && can("manage_employees") && (
                          <Button
                            size="xs"
                            onClick={() =>
                              navigate(`/app/hrm/employees/new?candidate=${encodeURIComponent(candidate.id)}`, {
                                state: { candidate },
                              })
                            }
                          >
                            Convert
                          </Button>
                        )}
                      </div>
                    )}
                  </article>
                ))}
                {!(byStage[stage] || []).length && <p className="px-1 py-3 text-center text-xs text-[var(--text-muted)]">Empty</p>}
              </div>
            </section>
          ))}
        </div>
      )}
      {data.truncated && <p className="text-xs text-[var(--text-muted)]">Showing the 300 most recently updated candidates for this job.</p>}
    </div>
  );
}
