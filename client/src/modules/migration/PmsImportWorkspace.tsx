import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Download,
  FileInput,
  ArrowRight,
  Trash2,
  ChevronDown,
  UploadCloud,
  Check,
  House,
  Users,
  CalendarDays,
  Archive,
  X,
  ArrowLeft,
  SlidersHorizontal,
  FileSpreadsheet,
  CircleAlert,
  Star,
  Tag,
  ClipboardCheck,
  PlugZap,
  KeyRound,
  ExternalLink,
} from "../../icons/glyphs";
import { Button, Input, NativeSelect, Skeleton } from "../../components/ui";
import { useTranslation } from "../../hooks/useTranslation";
import { propertiesApi, type Property } from "../../services/api/propertiesApi";
import {
  pmsImportApi,
  PROPERTY_SCOPED_KINDS,
  type ApiVendor,
  type ImportKind,
  type ImportPlan,
  type ImportSchema,
  type ImportSummary,
  type ImportView,
} from "../../services/api/pmsImportApi";
import "./pms-import.css";
import SetupIllustration from "../../components/onboarding/SetupIllustration";
import MigrationCutover from "./MigrationCutover";

const providers = [
  "SuperHote",
  "Smoobu",
  "Guesty",
  "Hostaway",
  "Beds24",
  "OwnerRez",
  "Lodgify",
  "Hostfully",
  "Hospitable",
  "Avantio",
];
const kinds: ImportKind[] = [
  "PROPERTY",
  "GUEST",
  "RESERVATION",
  "REVIEW",
  "RATE",
  "TASK",
  "ARCHIVE",
];
const isoDay = (offsetYears: number) => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + offsetYears);
  return date.toISOString().slice(0, 10);
};

function download(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function PmsImportWorkspace({
  embedded = false,
}: { embedded?: boolean } = {}) {
  const queryClient = useQueryClient();
  const { t, currentLanguage } = useTranslation();
  const tr = (key: string, values?: Record<string, string | number>) =>
    t(`pmsImport.${key}`, values);
  const n = (value: number) =>
    new Intl.NumberFormat(
      currentLanguage === "ar" ? "ar-u-nu-arab" : currentLanguage,
    ).format(value);
  const [schema, setSchema] = useState<ImportSchema | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [recent, setRecent] = useState<ImportSummary[]>([]);
  const [source, setSource] = useState("");
  const [account, setAccount] = useState("");
  const [encoding, setEncoding] = useState("UTF-8");
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<"files" | "api">("files");
  const [vendors, setVendors] = useState<ApiVendor[]>([]);
  const [vendorId, setVendorId] = useState("");
  // Held in memory for one request only; cleared as soon as the pull returns.
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [from, setFrom] = useState(() => isoDay(-2));
  const [to, setTo] = useState(() => isoDay(2));
  const [view, setView] = useState<ImportView | null>(null);
  const [plans, setPlans] = useState<ImportPlan[]>([]);
  const [dirty, setDirty] = useState(false);
  const [stage, setStage] = useState<"mapping" | "review">("mapping");
  const [dragging, setDragging] = useState(false);
  const [expandedFields, setExpandedFields] = useState<Record<string, boolean>>(
    {},
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  const reportRef = useRef<HTMLElement>(null);

  const message = (code: string) => {
    const [key, field] = code.split(":");
    return `${t(`pmsImport.errors.${key}`, { defaultValue: tr("errors.UNKNOWN") })}${field ? ` (${t(`pmsImport.fields.${field}`, { defaultValue: field })})` : ""}`;
  };

  useEffect(() => {
    alive.current = true;
    void Promise.all([
      pmsImportApi.schema(),
      pmsImportApi.recent(),
      propertiesApi.getAll(),
    ])
      .then(([nextSchema, history, homes]) => {
        if (!alive.current) return;
        setSchema(nextSchema);
        setRecent(history);
        setProperties(homes);
      })
      .catch(() => {
        if (alive.current) setError(t("pmsImport.errors.LOAD"));
      });
    pmsImportApi
      .apiVendors()
      .then((list) => {
        if (alive.current) setVendors(list);
      })
      .catch(() => undefined);
    return () => {
      alive.current = false;
    };
  }, [t]);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      if (alive.current)
        setError(message((cause as { message?: string }).message ?? "UNKNOWN"));
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const apply = (next: ImportView) => {
    if (!alive.current) return;
    setView(next);
    setPlans(next.plans);
    setDirty(false);
    setStage(next.status === "COMPLETED" ? "review" : "mapping");
    setRecent((previous) =>
      [next, ...previous.filter((item) => item.id !== next.id)].slice(0, 20),
    );
  };
  const update = (index: number, patch: Partial<ImportPlan>) => {
    setPlans((previous) =>
      previous.map((plan, i) => (i === index ? { ...plan, ...patch } : plan)),
    );
    setDirty(true);
  };
  const completed = view?.status === "COMPLETED";
  const report = view?.report;
  const phase = !view ? 0 : completed ? 3 : stage === "review" ? 2 : 1;
  const selectFiles = (incoming: File[]) => {
    const next = [...files, ...incoming].filter(
      (file, i, all) =>
        all.findIndex(
          (other) =>
            other.name === file.name &&
            other.size === file.size &&
            other.lastModified === file.lastModified,
        ) === i,
    );
    if (
      next.length > 20 ||
      next.reduce((sum, file) => sum + file.size, 0) > 8 * 1024 * 1024
    ) {
      setError(tr("errors.FILES_TOO_LARGE"));
      return;
    }
    setError("");
    setFiles(next);
  };

  return (
    <div className="baitly-setup pms-import" aria-busy={busy}>
      {!embedded && (
        <header className="pms-import-intro">
          <div>
            <span className="pms-import-eyebrow">{tr("design.eyebrow")}</span>
            <h2>{tr("title")}</h2>
            <p>{tr("intro")}</p>
          </div>
          {!view && <SetupIllustration />}
          {view && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setView(null);
                setPlans([]);
                setFiles([]);
                setError("");
              }}
            >
              {tr("newImport")}
            </Button>
          )}
        </header>
      )}
      <ol className="pms-import-stepper" aria-label={tr("design.progress")}>
        {["files", "mapping", "review"].map((key, index) => (
          <li
            key={key}
            aria-current={phase === index ? "step" : undefined}
            data-done={phase > index || undefined}
          >
            <span>{phase > index ? <Check size={15} /> : n(index + 1)}</span>
            <strong>{tr(`design.stages.${key}`)}</strong>
          </li>
        ))}
      </ol>
      {error && (
        <div role="alert" className="pms-import-error">
          {error}
        </div>
      )}
      {!schema && !error && (
        <div aria-label={tr("loading")}>
          <Skeleton className="h-16 w-full mb-3" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}

      {!view && schema && (
        <div className="pms-import-start-layout">
          <div
            className="pms-import-mode"
            role="tablist"
            aria-label={tr("api.modeLabel")}
          >
            {(["files", "api"] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={mode === key}
                onClick={() => setMode(key)}
              >
                {key === "files" ? (
                  <UploadCloud size={16} aria-hidden="true" />
                ) : (
                  <PlugZap size={16} aria-hidden="true" />
                )}
                {tr(`api.tab.${key}`)}
              </button>
            ))}
          </div>
          {mode === "api" && (
            <form
              className="pms-import-upload pms-import-api"
              autoComplete="off"
              onSubmit={(event) => {
                event.preventDefault();
                const vendor = vendors.find((item) => item.id === vendorId);
                if (!vendor) return;
                void run(async () => {
                  try {
                    apply(
                      await pmsImportApi.pull({
                        vendor: vendor.id,
                        account: account || vendor.name,
                        credentials,
                        from,
                        to,
                      }),
                    );
                  } finally {
                    if (alive.current) setCredentials({});
                  }
                });
              }}
            >
              <h3>{tr("api.title")}</h3>
              <p className="pms-import-help">{tr("api.help")}</p>
              <div className="pms-import-form-grid">
                <label>
                  <span>{tr("api.vendor")}</span>
                  <NativeSelect
                    required
                    value={vendorId}
                    onChange={(event) => {
                      setVendorId(event.target.value);
                      setCredentials({});
                    }}
                  >
                    <option value="">{tr("api.chooseVendor")}</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
                <label>
                  <span>{tr("account")}</span>
                  <Input
                    value={account}
                    maxLength={120}
                    onChange={(event) => setAccount(event.target.value)}
                    placeholder={tr("accountPlaceholder")}
                  />
                </label>
                {vendors
                  .find((vendor) => vendor.id === vendorId)
                  ?.credentialFields.map((field) => (
                    <label key={field}>
                      <span>
                        <KeyRound size={13} aria-hidden="true" />{" "}
                        {tr(`api.credentials.${field}`)}
                      </span>
                      <Input
                        required
                        type={
                          field === "email" || field === "accountId"
                            ? "text"
                            : "password"
                        }
                        autoComplete="off"
                        spellCheck={false}
                        value={credentials[field] ?? ""}
                        onChange={(event) =>
                          setCredentials((previous) => ({
                            ...previous,
                            [field]: event.target.value,
                          }))
                        }
                      />
                    </label>
                  ))}
                <label>
                  <span>{tr("api.from")}</span>
                  <Input
                    type="date"
                    required
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                  />
                </label>
                <label>
                  <span>{tr("api.to")}</span>
                  <Input
                    type="date"
                    required
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                  />
                </label>
              </div>
              {vendorId && (
                <p className="pms-import-help">
                  <a
                    href={
                      vendors.find((vendor) => vendor.id === vendorId)?.docsUrl
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {tr("api.docs")}{" "}
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                </p>
              )}
              <ul className="pms-import-api-guarantees">
                {["readOnly", "notStored", "beta"].map((key) => (
                  <li key={key}>
                    <Check size={14} aria-hidden="true" />
                    {tr(`api.${key}`)}
                  </li>
                ))}
              </ul>
              <div className="pms-import-upload-footer">
                <small>
                  <Check size={14} />
                  {tr("design.noWriteYet")}
                </small>
                <Button
                  className="setup-primary"
                  type="submit"
                  disabled={busy || !vendorId}
                >
                  <PlugZap size={16} />
                  {busy ? tr("api.pulling") : tr("api.submit")}
                </Button>
              </div>
            </form>
          )}
          {mode === "files" && (
            <form
              className="pms-import-upload"
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  if (files.length === 0) throw new Error("FILES_REQUIRED");
                  if (
                    files.length > 20 ||
                    files.reduce((sum, file) => sum + file.size, 0) >
                      8 * 1024 * 1024
                  )
                    throw new Error("FILES_TOO_LARGE");
                  apply(
                    await pmsImportApi.upload(files, source, account, encoding),
                  );
                });
              }}
            >
              <h3>{tr("design.startTitle")}</h3>
              <p className="pms-import-help">{tr("design.startHelp")}</p>
              <div className="pms-import-form-grid">
                <div>
                  <label>
                    <span>{tr("source")}</span>
                    <Input
                      required
                      list="pms-import-providers"
                      value={source}
                      maxLength={80}
                      onChange={(event) => setSource(event.target.value)}
                      placeholder={tr("sourcePlaceholder")}
                    />
                    <datalist id="pms-import-providers">
                      {providers.map((provider) => (
                        <option key={provider} value={provider} />
                      ))}
                    </datalist>
                  </label>
                  <span className="pms-import-provider-shortcuts">
                    {["Guesty", "Smoobu", "Hostaway"].map((provider) => (
                      <button
                        type="button"
                        key={provider}
                        aria-pressed={source === provider}
                        onClick={() => setSource(provider)}
                      >
                        {provider}
                      </button>
                    ))}
                  </span>
                </div>
                <label>
                  <span>{tr("account")}</span>
                  <Input
                    required
                    value={account}
                    maxLength={120}
                    onChange={(event) => setAccount(event.target.value)}
                    placeholder={tr("accountPlaceholder")}
                  />
                  <small>{tr("accountHelp")}</small>
                </label>
              </div>
              <label
                className="pms-import-dropzone"
                data-dragging={dragging || undefined}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  if (!busy) selectFiles(Array.from(event.dataTransfer.files));
                }}
              >
                <UploadCloud size={30} strokeWidth={1.5} aria-hidden="true" />
                <strong>{tr("design.dropTitle")}</strong>
                <span>{tr("design.dropBrowse")}</span>
                <small dir="ltr">CSV, TSV, XLS, XLSX, JSON, ZIP</small>
                <Input
                  type="file"
                  multiple
                  aria-label={tr("files")}
                  disabled={busy}
                  onChange={(event) => {
                    selectFiles(Array.from(event.target.files ?? []));
                    event.target.value = "";
                  }}
                />
              </label>
              {files.length > 0 && (
                <ul className="pms-import-file-list">
                  {files.map((file, i) => (
                    <li key={`${file.name}-${i}`}>
                      <FileSpreadsheet size={18} aria-hidden="true" />
                      <bdi>{file.name}</bdi>
                      <small>
                        {n(Math.max(1, Math.round(file.size / 1024)))}{" "}
                        {tr("design.kb")}
                      </small>
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={tr("design.removeFile", {
                          name: file.name,
                        })}
                        onClick={() =>
                          setFiles((previous) =>
                            previous.filter((_, at) => at !== i),
                          )
                        }
                      >
                        <X size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <details className="pms-import-advanced">
                <summary>
                  <SlidersHorizontal size={15} />
                  {tr("design.advanced")}
                  <ChevronDown size={14} />
                </summary>
                <label>
                  <span>{tr("encoding")}</span>
                  <NativeSelect
                    value={encoding}
                    onChange={(event) => setEncoding(event.target.value)}
                  >
                    <option value="UTF-8">UTF-8</option>
                    <option value="windows-1252">Windows-1252</option>
                    <option value="UTF-16">UTF-16</option>
                  </NativeSelect>
                </label>
                <small>{tr("limits")}</small>
              </details>
              <div className="pms-import-upload-footer">
                <small>
                  <Check size={14} />
                  {tr("design.noWriteYet")}
                </small>
                <Button
                  className="setup-primary"
                  type="submit"
                  disabled={busy || files.length === 0}
                >
                  <FileInput size={16} />
                  {busy ? tr("working") : tr("analyze")}
                </Button>
              </div>
            </form>
          )}
          <aside className="pms-import-explainer">
            <h3>{tr("design.bringTitle")}</h3>
            <ul>
              {(
                [
                  ["PROPERTY", House],
                  ["GUEST", Users],
                  ["RESERVATION", CalendarDays],
                  ["REVIEW", Star],
                  ["RATE", Tag],
                  ["TASK", ClipboardCheck],
                ] as const
              ).map(([kind, Icon]) => (
                <li key={kind}>
                  <Icon size={21} strokeWidth={1.5} />
                  <div>
                    <strong>{tr(`kind.${kind}`)}</strong>
                    <p>{tr(`design.bring.${kind}`)}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="pms-import-archive-note">
              <Archive size={19} />
              <div>
                <strong>{tr("design.archiveTitle")}</strong>
                <p>{tr("design.archiveBody")}</p>
              </div>
            </div>
          </aside>
          {recent.length > 0 && (
            <section className="pms-import-history">
              <h3>{tr("recent")}</h3>
              <ul>
                {recent.map((item) => (
                  <li key={item.id}>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () =>
                          apply(await pmsImportApi.get(item.id)),
                        )
                      }
                    >
                      <span>
                        <strong>
                          <bdi>{item.source}</bdi>
                        </strong>
                        <small>
                          <bdi>{item.sourceAccount}</bdi>
                        </small>
                      </span>
                      <span>
                        {tr(`status.${item.status}`)}{" "}
                        <ArrowRight size={16} className="rtl:rotate-180" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {view && schema && (
        <>
          <div className="pms-import-batch-line">
            <span>
              <strong>
                <bdi>{view.source}</bdi>
              </strong>{" "}
              · <bdi>{view.sourceAccount}</bdi>
            </span>
            <div className="pms-import-actions">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run(async () =>
                    download(
                      await pmsImportApi.export(view.id),
                      `baitly-import-${view.id}.json`,
                    ),
                  )
                }
              >
                <Download size={16} />
                {tr("download")}
              </Button>
              {!completed && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await pmsImportApi.deleteDraft(view.id);
                      setRecent((previous) =>
                        previous.filter((item) => item.id !== view.id),
                      );
                      setView(null);
                    })
                  }
                >
                  <Trash2 size={16} />
                  {tr("deleteDraft")}
                </Button>
              )}
            </div>
          </div>
          {!completed && stage === "mapping" && (
            <>
              <div className="pms-import-mapping-intro">
                <h3>{tr("design.mappingTitle")}</h3>
                <p>{tr("design.mappingHelp")}</p>
              </div>
              <fieldset
                disabled={busy || completed}
                className="pms-import-documents"
              >
                <legend className="sr-only">{tr("mapping")}</legend>
                {view.documents.map((document, index) => {
                  const plan = plans[index];
                  if (!plan) return null;
                  const fields = schema[plan.kind];
                  const unmapped = document.columns.filter(
                    (column) => !Object.values(plan.fields).includes(column),
                  );
                  return (
                    <details
                      key={document.id}
                      className="pms-import-document"
                      open={index === 0}
                    >
                      <summary>
                        <span>
                          <bdi>{document.name}</bdi>
                          <small>
                            {document.attachment
                              ? tr("attachment")
                              : tr("rows", { count: n(document.rowCount) })}
                          </small>
                        </span>
                        <span className="pms-import-document-kind">
                          {tr(`kind.${plan.kind}`)}
                        </span>
                        <ChevronDown size={16} aria-hidden="true" />
                      </summary>
                      <div className="pms-import-document-body">
                        <div className="pms-import-form-grid">
                          <label>
                            <span>{tr("destination")}</span>
                            <NativeSelect
                              value={plan.kind}
                              onChange={(event) =>
                                update(index, {
                                  kind: event.target.value as ImportKind,
                                  fields: {},
                                  defaults: {},
                                  propertyLinks: {},
                                })
                              }
                            >
                              {kinds
                                .filter(
                                  (kind) =>
                                    !document.attachment || kind === "ARCHIVE",
                                )
                                .map((kind) => (
                                  <option key={kind} value={kind}>
                                    {tr(`kind.${kind}`)}
                                  </option>
                                ))}
                            </NativeSelect>
                          </label>
                          {PROPERTY_SCOPED_KINDS.includes(plan.kind) && (
                            <>
                              <label>
                                <span>{tr("dateFormat")}</span>
                                <NativeSelect
                                  value={plan.dateFormat}
                                  onChange={(event) =>
                                    update(index, {
                                      dateFormat: event.target
                                        .value as ImportPlan["dateFormat"],
                                    })
                                  }
                                >
                                  {["ISO", "DMY", "MDY", "EXCEL_1900"].map(
                                    (format) => (
                                      <option key={format} value={format}>
                                        {tr(`dates.${format}`)}
                                      </option>
                                    ),
                                  )}
                                </NativeSelect>
                              </label>
                              <label>
                                <span>{tr("decimal")}</span>
                                <NativeSelect
                                  value={plan.decimalSeparator}
                                  onChange={(event) =>
                                    update(index, {
                                      decimalSeparator: event.target.value as
                                        | "."
                                        | ",",
                                    })
                                  }
                                >
                                  <option value=".">{tr("point")}</option>
                                  <option value=",">{tr("comma")}</option>
                                </NativeSelect>
                              </label>
                            </>
                          )}
                        </div>
                        {plan.kind === "ARCHIVE" ? (
                          <p className="pms-import-help">{tr("archiveHelp")}</p>
                        ) : (
                          <>
                            <div
                              className="pms-import-mapping-heading"
                              aria-hidden="true"
                            >
                              <span>{tr("baitlyField")}</span>
                              <span>{tr("sourceColumn")}</span>
                              <span>{tr("exampleOrDefault")}</span>
                            </div>
                            {fields
                              .filter(
                                (field) =>
                                  field.required || expandedFields[document.id],
                              )
                              .map((field) => {
                                const selected = plan.fields[field.key] ?? "";
                                const id = `import-${document.id}-${field.key}`;
                                return (
                                  <div
                                    className="pms-import-mapping-row"
                                    key={field.key}
                                  >
                                    <label htmlFor={id}>
                                      {tr(`fields.${field.key}`)}
                                      {field.required && (
                                        <span aria-label={tr("required")}>
                                          {" "}
                                          *
                                        </span>
                                      )}
                                    </label>
                                    <NativeSelect
                                      id={id}
                                      value={selected}
                                      onChange={(event) => {
                                        const next = { ...plan.fields };
                                        if (event.target.value)
                                          next[field.key] = event.target.value;
                                        else delete next[field.key];
                                        update(index, { fields: next });
                                      }}
                                    >
                                      <option value="">
                                        {tr("constantOrEmpty")}
                                      </option>
                                      {document.columns.map((column) => (
                                        <option key={column} value={column}>
                                          {column}
                                        </option>
                                      ))}
                                    </NativeSelect>
                                    {selected ? (
                                      <bdi
                                        className="pms-import-example"
                                        title={document.sample[0]?.[selected]}
                                      >
                                        {document.sample[0]?.[selected] ||
                                          tr("empty")}
                                      </bdi>
                                    ) : (
                                      <Input
                                        aria-label={`${tr(`fields.${field.key}`)} · ${tr("defaultValue")}`}
                                        value={plan.defaults[field.key] ?? ""}
                                        placeholder={
                                          field.required
                                            ? tr("required")
                                            : tr("optional")
                                        }
                                        onChange={(event) =>
                                          update(index, {
                                            defaults: {
                                              ...plan.defaults,
                                              [field.key]: event.target.value,
                                            },
                                          })
                                        }
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            {fields.some((field) => !field.required) && (
                              <button
                                type="button"
                                className="pms-import-more-fields"
                                aria-expanded={!!expandedFields[document.id]}
                                onClick={() =>
                                  setExpandedFields((previous) => ({
                                    ...previous,
                                    [document.id]: !previous[document.id],
                                  }))
                                }
                              >
                                {tr("design.extraFields", {
                                  count: n(
                                    fields.filter((field) => !field.required)
                                      .length,
                                  ),
                                })}
                                <ChevronDown size={15} />
                              </button>
                            )}
                            {plan.kind === "PROPERTY" && (
                              <details className="pms-import-advanced">
                                <summary>
                                  {tr("design.propertyOptions")}
                                  <ChevronDown size={14} />
                                </summary>
                                <p className="pms-import-help">
                                  {tr("propertyHelp")}
                                </p>
                              </details>
                            )}
                            {PROPERTY_SCOPED_KINDS.includes(plan.kind) && (
                              <section className="pms-import-property-links">
                                <h4>{tr("propertyLinks")}</h4>
                                <p>{tr("propertyLinksHelp")}</p>
                                {document.propertyRefs.map((ref) => (
                                  <label key={ref}>
                                    <bdi>{ref}</bdi>
                                    <NativeSelect
                                      value={plan.propertyLinks[ref] ?? ""}
                                      onChange={(event) => {
                                        const next = { ...plan.propertyLinks };
                                        if (event.target.value)
                                          next[ref] = Number(
                                            event.target.value,
                                          );
                                        else delete next[ref];
                                        update(index, { propertyLinks: next });
                                      }}
                                    >
                                      <option value="">
                                        {tr("importedProperty")}
                                      </option>
                                      {properties.map((property) => (
                                        <option
                                          key={property.id}
                                          value={property.id}
                                        >
                                          {property.name}
                                        </option>
                                      ))}
                                    </NativeSelect>
                                  </label>
                                ))}
                              </section>
                            )}
                            <p className="pms-import-help">
                              {tr("preserved", { count: n(unmapped.length) })}
                            </p>
                            {unmapped.length > 0 && (
                              <p className="pms-import-columns">
                                <bdi>{unmapped.join(" · ")}</bdi>
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </details>
                  );
                })}
              </fieldset>
              {!completed && (
                <div className="pms-import-actions">
                  <Button
                    disabled={busy}
                    className="setup-primary"
                    onClick={() =>
                      void run(async () => {
                        const checked = await pmsImportApi.validate(
                          view.id,
                          plans,
                        );
                        apply(checked);
                        if (checked.report?.issueCount === 0)
                          setStage("review");
                        requestAnimationFrame(() => reportRef.current?.focus());
                      })
                    }
                  >
                    {busy ? tr("working") : tr("validate")}
                  </Button>
                  <span className="pms-import-help">
                    {dirty ? tr("dirty") : tr("validateHelp")}
                  </span>
                </div>
              )}
            </>
          )}

          {report &&
            (completed ||
              stage === "review" ||
              (!dirty && report.issueCount > 0)) && (
              <section
                className="pms-import-report"
                ref={reportRef}
                tabIndex={-1}
                aria-label={tr("report")}
              >
                <div className="pms-import-review-heading">
                  <span data-error={report.issueCount > 0 || undefined}>
                    {report.issueCount > 0 ? (
                      <CircleAlert size={23} />
                    ) : (
                      <Check size={23} />
                    )}
                  </span>
                  <div>
                    <h3>
                      {completed
                        ? tr("completed")
                        : report.issueCount > 0
                          ? tr("report")
                          : tr("design.reviewTitle")}
                    </h3>
                    <p>
                      {completed
                        ? tr("completedHelp")
                        : tr("design.reviewHelp")}
                    </p>
                  </div>
                </div>
                <dl className="pms-import-counts">
                  {[
                    ["ready", report.ready],
                    ["duplicates", report.duplicates],
                    ["archived", report.archived],
                    ...(report.skipped ? [["skipped", report.skipped]] : []),
                    ["issueCount", report.issueCount],
                  ].map(([key, count]) => (
                    <div key={key}>
                      <dt>{tr(`counts.${key}`)}</dt>
                      <dd>{n(count as number)}</dd>
                    </div>
                  ))}
                </dl>
                {Object.entries(report.totals).length > 0 && (
                  <p className="pms-import-totals">
                    {tr("totals")}:{" "}
                    {Object.entries(report.totals).map(([currency, amount]) => (
                      <bdi key={currency}>
                        {new Intl.NumberFormat(
                          currentLanguage === "ar"
                            ? "ar-u-nu-arab"
                            : currentLanguage,
                          { style: "currency", currency },
                        ).format(Number(amount))}
                      </bdi>
                    ))}
                  </p>
                )}
                {report.issues.length > 0 && (
                  <div className="pms-import-issues" role="status">
                    <p>{tr("issuesHelp")}</p>
                    <ol>
                      {report.issues.map((issue, index) => (
                        <li key={index}>
                          <strong>
                            <bdi>
                              {
                                view.documents.find(
                                  (doc) => doc.id === issue.documentId,
                                )?.name
                              }
                            </bdi>{" "}
                            · {tr("line", { number: n(issue.row) })}
                          </strong>
                          <span>{message(issue.code)}</span>
                        </li>
                      ))}
                    </ol>
                    {report.issueCount > report.issues.length && (
                      <p>{tr("issuesLimited")}</p>
                    )}
                  </div>
                )}
                <p className="pms-import-help">{tr("automationHelp")}</p>
                {!completed && (
                  <div className="pms-import-review-actions">
                    {stage === "review" && (
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => setStage("mapping")}
                      >
                        <ArrowLeft size={16} className="setup-directional" />
                        {tr("design.backMapping")}
                      </Button>
                    )}
                    <Button
                      className="setup-primary"
                      disabled={
                        busy ||
                        dirty ||
                        report.issueCount > 0 ||
                        report.ready + report.archived === 0
                      }
                      onClick={() =>
                        void run(async () => {
                          apply(
                            await pmsImportApi.commit(view.id, report.token),
                          );
                          void queryClient.invalidateQueries({
                            queryKey: ["onboarding", "me"],
                          });
                        })
                      }
                    >
                      {busy ? tr("working") : tr("commit")}
                    </Button>
                  </div>
                )}
                {completed && (
                  <p role="status">{tr("design.completedNotice")}</p>
                )}
              </section>
            )}
        </>
      )}
      {!embedded && !view && schema && <MigrationCutover />}
    </div>
  );
}
