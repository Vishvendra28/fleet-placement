"use client";
import { useEffect, useState, useCallback } from "react";
import {
  ISSUE_CATEGORY_LABELS, ISSUE_STATUS_LABELS, ISSUE_VALUE_LABELS,
} from "@/lib/constants";
import BackButton from "@/components/BackButton";

type Issue = {
  id: string;
  issueCategory: string;
  issueValue: string;
  status: string;
  eta: string | null;
  raisedAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  placement: {
    id: string; date: string;
    client: { name: string };
    route: { name: string };
    vehicle: { vehicleNumber: string } | null;
  };
  raisedBy: { name: string; role: string };
  resolvedBy: { name: string } | null;
};

type Comment = {
  id: string;
  comment: string;
  createdAt: string;
  user: { name: string; role: string };
};

const CAT_BORDER: Record<string, string> = {
  DRIVER: "border-l-orange-400",
  MAINTENANCE: "border-l-pink-400",
  EQUIPMENT: "border-l-blue-400",
};
const STATUS_BADGE: Record<string, string> = {
  OPEN: "bg-red-100 text-red-700 border-red-200",
  IN_PROGRESS: "bg-amber-100 text-amber-700 border-amber-200",
  RESOLVED: "bg-emerald-100 text-emerald-700 border-emerald-200",
};
const CAT_BADGE: Record<string, string> = {
  DRIVER: "bg-orange-100 text-orange-700",
  MAINTENANCE: "bg-pink-100 text-pink-700",
  EQUIPMENT: "bg-blue-100 text-blue-700",
};
const selectCls = "border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 text-slate-700";

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

function EtaModal({ onConfirm, onCancel, revisionMode }: { onConfirm: (eta: string, comment: string) => void; onCancel: () => void; revisionMode?: boolean }) {
  const [etaDate, setEtaDate] = useState(new Date().toISOString().split("T")[0]);
  const [etaHour, setEtaHour] = useState("12");
  const [etaMinute, setEtaMinute] = useState("00");
  const [etaAmPm, setEtaAmPm] = useState<"AM" | "PM">("PM");
  const [comment, setComment] = useState("");

  function buildEta() {
    let h = parseInt(etaHour);
    if (etaAmPm === "PM" && h !== 12) h += 12;
    if (etaAmPm === "AM" && h === 12) h = 0;
    return `${etaDate}T${String(h).padStart(2, "0")}:${etaMinute}:00`;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-1">{revisionMode ? "Revise ETA" : "Mark In Progress"}</h3>
        <p className="text-sm text-slate-500 mb-5">{revisionMode ? "Update the expected resolution time" : "Set an ETA and describe what’s being done"}</p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Date</label>
            <input
              type="date"
              value={etaDate}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => setEtaDate(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Time</label>
            <div className="flex items-center gap-2">
              <select value={etaHour} onChange={(e) => setEtaHour(e.target.value)}
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              <span className="text-slate-400 font-bold text-lg">:</span>
              <select value={etaMinute} onChange={(e) => setEtaMinute(e.target.value)}
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className="flex rounded-xl overflow-hidden border border-slate-200 flex-shrink-0">
                <button type="button" onClick={() => setEtaAmPm("AM")}
                  className={`px-3 py-2 text-sm font-semibold transition-colors ${etaAmPm === "AM" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                  AM
                </button>
                <button type="button" onClick={() => setEtaAmPm("PM")}
                  className={`px-3 py-2 text-sm font-semibold transition-colors ${etaAmPm === "PM" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                  PM
                </button>
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
              {revisionMode ? "Reason for revision" : "What's being done"}{" "}
              {!revisionMode && <span className="text-red-500 normal-case font-normal">* required</span>}
              {revisionMode && <span className="text-slate-400 normal-case font-normal">(optional)</span>}
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={revisionMode ? "e.g. Work taking longer than expected…" : "e.g. Arranging replacement driver, vehicle sent to workshop…"}
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button
            type="button"
            disabled={!etaDate || (!revisionMode && !comment.trim())}
            onClick={() => onConfirm(buildEta(), comment.trim())}
            className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors disabled:opacity-40">
            {revisionMode ? "Update ETA" : "Set ETA & Start"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResolveModal({ onConfirm, onCancel }: { onConfirm: (note: string) => void; onCancel: () => void }) {
  const [note, setNote] = useState("");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Resolve Issue</h3>
        <p className="text-sm text-slate-500 mb-5">Describe how this issue was resolved</p>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
            Resolution note <span className="text-red-500 normal-case font-normal">* required</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Replaced with backup driver, vehicle repaired and cleared…"
            rows={4}
            autoFocus
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button
            type="button"
            disabled={!note.trim()}
            onClick={() => onConfirm(note.trim())}
            className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-40">
            Mark Resolved
          </button>
        </div>
      </div>
    </div>
  );
}

function IssueCard({ issue, onUpdate }: { issue: Issue; onUpdate: () => void }) {
  const [saving, setSaving] = useState(false);
  const [showEtaModal, setShowEtaModal] = useState(false);
  const [showReviseEtaModal, setShowReviseEtaModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [expandComments, setExpandComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  async function loadComments() {
    if (commentsLoaded) return;
    const res = await fetch(`/api/issues/${issue.id}/comments`);
    if (res.ok) setComments(await res.json());
    setCommentsLoaded(true);
  }

  async function toggleComments() {
    if (!expandComments) await loadComments();
    setExpandComments(!expandComments);
  }

  async function markInProgress(eta: string, comment: string) {
    setSaving(true);
    await fetch(`/api/issues/${issue.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "IN_PROGRESS", eta }),
    });
    const r = await fetch(`/api/issues/${issue.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
    });
    if (r.ok && commentsLoaded) {
      const c = await r.json();
      setComments((prev) => [...prev, c]);
    }
    setSaving(false);
    onUpdate();
  }

  async function reviseEta(eta: string, comment: string) {
    setSaving(true);
    await fetch(`/api/issues/${issue.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "IN_PROGRESS", eta }),
    });
    if (comment.trim()) {
      const r = await fetch(`/api/issues/${issue.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: `ETA revised: ${comment.trim()}` }),
      });
      if (r.ok && commentsLoaded) {
        const c = await r.json();
        setComments((prev) => [...prev, c]);
      }
    }
    setSaving(false);
    onUpdate();
  }

  async function resolveIssue(resolutionNote: string) {
    setSaving(true);
    await fetch(`/api/issues/${issue.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "RESOLVED", resolutionNote }),
    });
    setSaving(false);
    onUpdate();
  }

  async function addComment() {
    if (!newComment.trim()) return;
    setPostingComment(true);
    const res = await fetch(`/api/issues/${issue.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: newComment.trim() }),
    });
    if (res.ok) {
      const c = await res.json();
      setComments((prev) => [...prev, c]);
      setNewComment("");
    }
    setPostingComment(false);
  }

  return (
    <>
      {showEtaModal && (
        <EtaModal
          onConfirm={(eta, comment) => { setShowEtaModal(false); markInProgress(eta, comment); }}
          onCancel={() => setShowEtaModal(false)}
        />
      )}
      {showReviseEtaModal && (
        <EtaModal
          revisionMode
          onConfirm={(eta, comment) => { setShowReviseEtaModal(false); reviseEta(eta, comment); }}
          onCancel={() => setShowReviseEtaModal(false)}
        />
      )}
      {showResolveModal && (
        <ResolveModal
          onConfirm={(note) => { setShowResolveModal(false); resolveIssue(note); }}
          onCancel={() => setShowResolveModal(false)}
        />
      )}

      <div className={`bg-white rounded-2xl border-2 border-slate-100 border-l-4 ${CAT_BORDER[issue.issueCategory]} shadow-sm overflow-hidden`}>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CAT_BADGE[issue.issueCategory]}`}>
                {ISSUE_CATEGORY_LABELS[issue.issueCategory]}
              </span>
              <span className="text-sm font-semibold text-slate-900">
                {ISSUE_VALUE_LABELS[issue.issueValue] ?? issue.issueValue}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_BADGE[issue.status]}`}>
                {ISSUE_STATUS_LABELS[issue.status]}
              </span>
              {issue.status === "IN_PROGRESS" && issue.eta && (
                <>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    ETA: {new Date(issue.eta).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowReviseEtaModal(true)}
                    disabled={saving}
                    className="text-xs px-2.5 py-1 bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-full font-semibold hover:bg-indigo-200 transition-colors disabled:opacity-50"
                  >
                    Revise ETA
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mt-2 text-xs text-slate-500 space-y-0.5">
            <p>
              <span className="font-medium text-slate-700">{issue.placement.client.name}</span>
              {" · "}{issue.placement.route.name}
              {" · "}{issue.placement.vehicle?.vehicleNumber ?? "—"}
            </p>
            <p>Date: {new Date(issue.placement.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
            <p>
              Raised by <span className="font-medium">{issue.raisedBy.name}</span>
              {" at "}{new Date(issue.raisedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
            {issue.resolvedBy && (
              <p className="text-emerald-600">
                Resolved by <span className="font-medium">{issue.resolvedBy.name}</span>
                {" at "}{new Date(issue.resolvedAt!).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>

          {issue.status !== "RESOLVED" && (
            <div className="mt-3 flex gap-2 flex-wrap items-center">
              {issue.status === "OPEN" && (
                <button
                  type="button"
                  onClick={() => setShowEtaModal(true)}
                  disabled={saving}
                  className="text-xs px-3 py-1.5 bg-amber-100 text-amber-700 border border-amber-200 rounded-lg font-semibold hover:bg-amber-200 transition-colors disabled:opacity-50"
                >
                  Mark In Progress
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowResolveModal(true)}
                disabled={saving}
                className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {saving ? "…" : "Resolve"}
              </button>
            </div>
          )}

          {issue.resolutionNote && issue.status === "RESOLVED" && (
            <p className="mt-2 text-xs text-slate-500 italic bg-slate-50 rounded-lg px-3 py-2">
              {issue.resolutionNote}
            </p>
          )}
        </div>

        {/* Comment thread */}
        <div className="border-t border-slate-100">
          <button
            type="button"
            onClick={toggleComments}
            className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {commentsLoaded && comments.length > 0
              ? `${comments.length} comment${comments.length > 1 ? "s" : ""}`
              : "Timeline & comments"}
            <span className="ml-auto text-slate-400">{expandComments ? "▲" : "▼"}</span>
          </button>

          {expandComments && (
            <div className="px-4 pb-4 space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <span>Issue opened · {new Date(issue.raisedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                {issue.resolvedAt && (
                  <div className="flex items-center gap-2 text-xs text-emerald-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Resolved by {issue.resolvedBy?.name} · {new Date(issue.resolvedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                )}
              </div>

              {comments.length > 0 && (
                <div className="space-y-2">
                  {comments.map((c) => (
                    <div key={c.id} className="bg-slate-50 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-slate-700">{c.user.name}</span>
                        <span className="text-xs text-slate-400">
                          {new Date(c.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">{c.comment}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addComment(); } }}
                  placeholder="Add a comment or update…"
                  className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <button
                  type="button"
                  onClick={addComment}
                  disabled={postingComment || !newComment.trim()}
                  className="text-xs px-3 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors whitespace-nowrap"
                >
                  {postingComment ? "…" : "Post"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function IssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [vehicleFilter, setVehicleFilter] = useState("");

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const v = sp.get("vehicle");
    if (v) setVehicleFilter(v);
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/issues?status=ALL");
    if (res.ok) setIssues(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const open = issues.filter((i) => i.status === "OPEN").length;
  const inProgress = issues.filter((i) => i.status === "IN_PROGRESS").length;
  const resolved = issues.filter((i) => i.status === "RESOLVED").length;

  const displayed = issues.filter((i) => {
    if (statusFilter !== "ALL" && i.status !== statusFilter) return false;
    if (typeFilter !== "ALL" && i.issueCategory !== typeFilter) return false;
    if (vehicleFilter && !(i.placement.vehicle?.vehicleNumber ?? "").toLowerCase().includes(vehicleFilter.toLowerCase())) return false;
    return true;
  });

  if (loading) return (
    <div className="flex items-center justify-center py-24 gap-3">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-slate-400">Loading issues…</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Issues</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track and resolve operational issues</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Open", count: open, cls: "border-red-200 bg-red-50 text-red-700", val: "OPEN" },
          { label: "In Progress", count: inProgress, cls: "border-amber-200 bg-amber-50 text-amber-700", val: "IN_PROGRESS" },
          { label: "Resolved", count: resolved, cls: "border-emerald-200 bg-emerald-50 text-emerald-700", val: "RESOLVED" },
        ].map((s) => (
          <button key={s.val} onClick={() => setStatusFilter(statusFilter === s.val ? "ALL" : s.val)}
            className={`border-2 rounded-2xl p-4 text-left transition-all hover:scale-[1.02] active:scale-95 shadow-sm ${s.cls} ${statusFilter === s.val ? "ring-2 ring-offset-1 ring-current" : ""}`}>
            <p className="text-2xl font-bold">{s.count}</p>
            <p className="text-xs font-semibold mt-0.5 opacity-75">{s.label}</p>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 flex-wrap bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
        <span className="text-sm font-semibold text-slate-500">Filter by</span>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
        <div className="hidden sm:block w-px h-5 bg-slate-200" />
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Type</label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={selectCls}>
            <option value="ALL">All Types</option>
            <option value="DRIVER">Driver</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="EQUIPMENT">Equipment</option>
          </select>
        </div>
        <div className="hidden sm:block w-px h-5 bg-slate-200" />
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Vehicle</label>
          <div className="relative">
            <input
              type="text"
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              placeholder="Search vehicle…"
              className={`${selectCls} pl-7 w-36`}
            />
            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
            </svg>
          </div>
        </div>
        {(statusFilter !== "ALL" || typeFilter !== "ALL" || vehicleFilter) && (
          <button onClick={() => { setStatusFilter("ALL"); setTypeFilter("ALL"); setVehicleFilter(""); }}
            className="text-xs text-slate-400 hover:text-slate-600 underline transition-colors">
            Clear all
          </button>
        )}
        <span className="ml-auto text-sm font-medium text-slate-500">
          {displayed.length} result{displayed.length !== 1 ? "s" : ""}
        </span>
      </div>

      {displayed.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200">
          <p className="text-base font-semibold text-slate-600">No issues match this filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayed.map((issue) => (
            <IssueCard key={issue.id} issue={issue} onUpdate={load} />
          ))}
        </div>
      )}
    </div>
  );
}
