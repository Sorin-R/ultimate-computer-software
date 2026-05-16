import { useState } from "react";
import api from "../api/client";

type ReportTargetType = "ARTICLE" | "COMMENT" | "USER" | "DM";

type ReportReason =
  | "SPAM"
  | "HARASSMENT"
  | "HATE_SPEECH"
  | "MISINFORMATION"
  | "OFF_TOPIC"
  | "OTHER";

interface ReportModalProps {
  open: boolean;
  targetType: ReportTargetType;
  targetId: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

const REPORT_OPTIONS: { value: ReportReason; label: string }[] = [
  { value: "SPAM", label: "Spam or advertising" },
  { value: "HARASSMENT", label: "Harassment or bullying" },
  { value: "HATE_SPEECH", label: "Hate speech" },
  { value: "MISINFORMATION", label: "Misinformation" },
  { value: "OFF_TOPIC", label: "Off-topic" },
  { value: "OTHER", label: "Other" },
];

export default function ReportModal({
  open,
  targetType,
  targetId,
  onClose,
  onSubmitted,
}: ReportModalProps) {
  const [reason, setReason] = useState<ReportReason>("SPAM");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const submit = async () => {
    setError("");
    setSubmitting(true);
    try {
      await api.post("/reports", {
        targetType,
        targetId,
        reason,
        description,
      });
      setDescription("");
      setReason("SPAM");
      onSubmitted?.();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-black/20 p-5">
        <h2 className="text-xl font-semibold mb-3">Report Content</h2>

        {error && (
          <div className="mb-3 p-2 text-sm bg-red-50 border border-red-200 text-red-700">{error}</div>
        )}

        <div className="space-y-2 mb-3">
          {REPORT_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="report-reason-modal"
                value={option.value}
                checked={reason === option.value}
                onChange={() => setReason(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
          placeholder="Additional details (optional)"
          rows={3}
          className="w-full border border-black/20 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
        />

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-1.5 border border-black/25 text-sm hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="px-3 py-1.5 bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Report"}
          </button>
        </div>
      </div>
    </div>
  );
}
