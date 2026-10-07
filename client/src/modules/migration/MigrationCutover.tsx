import { useEffect, useRef, useState } from "react";
import { CalendarClock, Check, Download, PackageCheck } from "lucide-react";
import { Button, Input } from "../../components/ui";
import { useTranslation } from "../../hooks/useTranslation";
import {
  pmsImportApi,
  type MigrationPlan,
} from "../../services/api/pmsImportApi";

/**
 * Published notice periods (vendor terms, checked 2026-10). A suggestion the host can change:
 * their own contract always wins.
 */
const KNOWN_NOTICE_DAYS: Record<string, number> = {
  guesty: 30,
  hostaway: 30,
  amenitiz: 90,
};

/** Cutover plan for leaving the previous PMS, and the full export for leaving Baitly. */
export default function MigrationCutover() {
  const { t, currentLanguage } = useTranslation();
  const tr = (key: string, values?: Record<string, string | number>) =>
    t(`pmsImport.${key}`, values);
  const [plan, setPlan] = useState<MigrationPlan | null>(null);
  const [draft, setDraft] = useState({
    sourcePms: "",
    contractEndDate: "",
    noticeDays: "",
  });
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState("");
  const alive = useRef(true);

  const load = (next: MigrationPlan) => {
    setPlan(next);
    setDraft({
      sourcePms: next.sourcePms ?? "",
      contractEndDate: next.contractEndDate ?? "",
      noticeDays: next.noticeDays == null ? "" : String(next.noticeDays),
    });
    setChecked(
      Object.fromEntries(
        next.steps.filter((s) => !s.derived).map((s) => [s.key, s.done]),
      ),
    );
  };

  useEffect(() => {
    alive.current = true;
    pmsImportApi
      .plan()
      .then((next) => alive.current && load(next))
      .catch(() => undefined);
    return () => {
      alive.current = false;
    };
  }, []);

  const date = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(currentLanguage, {
          dateStyle: "long",
          timeZone: "UTC",
        }).format(new Date(`${value}T12:00:00Z`))
      : "—";

  const save = async (nextChecked = checked) => {
    setBusy(true);
    setStatus("");
    try {
      const saved = await pmsImportApi.savePlan({
        sourcePms: draft.sourcePms || null,
        contractEndDate: draft.contractEndDate || null,
        noticeDays: draft.noticeDays === "" ? null : Number(draft.noticeDays),
        checklist: nextChecked,
      });
      if (alive.current) {
        load(saved);
        setStatus(tr("plan.saved"));
      }
    } catch {
      if (alive.current) setStatus(tr("errors.PLAN_INVALID"));
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  return (
    <div className="pms-cutover">
      <section className="pms-cutover-plan" aria-labelledby="pms-plan-title">
        <header>
          <CalendarClock size={22} aria-hidden="true" />
          <div>
            <h3 id="pms-plan-title">{tr("plan.title")}</h3>
            <p>{tr("plan.intro")}</p>
          </div>
        </header>
        <form
          className="pms-import-form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label>
            <span>{tr("plan.sourcePms")}</span>
            <Input
              value={draft.sourcePms}
              maxLength={80}
              onChange={(event) => {
                const sourcePms = event.target.value;
                const known = KNOWN_NOTICE_DAYS[sourcePms.trim().toLowerCase()];
                setDraft((previous) => ({
                  ...previous,
                  sourcePms,
                  noticeDays:
                    previous.noticeDays === "" && known
                      ? String(known)
                      : previous.noticeDays,
                }));
              }}
            />
          </label>
          <label>
            <span>{tr("plan.contractEnd")}</span>
            <Input
              type="date"
              value={draft.contractEndDate}
              onChange={(event) =>
                setDraft((previous) => ({
                  ...previous,
                  contractEndDate: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>{tr("plan.noticeDays")}</span>
            <Input
              type="number"
              min={0}
              max={730}
              value={draft.noticeDays}
              onChange={(event) =>
                setDraft((previous) => ({
                  ...previous,
                  noticeDays: event.target.value,
                }))
              }
            />
          </label>
          <div className="pms-cutover-save">
            <Button type="submit" variant="outline" disabled={busy}>
              {tr("plan.save")}
            </Button>
          </div>
        </form>
        {plan?.contractEndDate && (
          <dl className="pms-cutover-deadlines">
            <div>
              <dt>{tr("plan.noticeDeadline")}</dt>
              <dd>{date(plan.noticeDeadline)}</dd>
            </div>
            <div>
              <dt>{tr("plan.exportDeadline")}</dt>
              <dd>
                {date(plan.exportDeadline)}
                {plan.daysUntilExportDeadline != null && (
                  <small
                    data-urgent={
                      plan.daysUntilExportDeadline <= 14 || undefined
                    }
                  >
                    {plan.daysUntilExportDeadline >= 0
                      ? tr("plan.daysLeft", {
                          count: plan.daysUntilExportDeadline,
                        })
                      : tr("plan.overdue")}
                  </small>
                )}
              </dd>
            </div>
          </dl>
        )}
        <ol className="pms-cutover-steps">
          {(plan?.steps ?? []).map((step) => {
            const done = step.derived ? step.done : !!checked[step.key];
            return (
              <li key={step.key} data-done={done || undefined}>
                <label>
                  <input
                    type="checkbox"
                    checked={done}
                    disabled={step.derived || busy}
                    onChange={(event) => {
                      const next = {
                        ...checked,
                        [step.key]: event.target.checked,
                      };
                      setChecked(next);
                      void save(next);
                    }}
                  />
                  <span>
                    {tr(`plan.steps.${step.key}`)}
                    {step.derived && <small>{tr("plan.derived")}</small>}
                  </span>
                </label>
              </li>
            );
          })}
        </ol>
        <p className="pms-import-help" role="status">
          {status}
        </p>
      </section>

      <section
        className="pms-cutover-export"
        aria-labelledby="pms-export-title"
      >
        <header>
          <PackageCheck size={22} aria-hidden="true" />
          <div>
            <h3 id="pms-export-title">{tr("accountExport.title")}</h3>
            <p>{tr("accountExport.body")}</p>
          </div>
        </header>
        <ul>
          {["csv", "json", "files", "manifest"].map((key) => (
            <li key={key}>
              <Check size={14} aria-hidden="true" />
              {tr(`accountExport.contents.${key}`)}
            </li>
          ))}
        </ul>
        <Button
          className="setup-primary"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            try {
              await pmsImportApi.downloadAccountExport();
            } catch {
              if (alive.current) setStatus(tr("accountExport.failed"));
            } finally {
              if (alive.current) setExporting(false);
            }
          }}
        >
          <Download size={16} />
          {exporting ? tr("accountExport.working") : tr("accountExport.button")}
        </Button>
        <small>{tr("accountExport.note")}</small>
      </section>
    </div>
  );
}
