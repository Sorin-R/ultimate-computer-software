/**
 * K10: PollWidget — renders a poll with vote buttons and live results.
 * Can be embedded in an article page or used standalone.
 */
import { useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

interface PollOption {
  id: string;
  text: string;
  position: number;
  votes: number;
  percentage: number;
}

interface Poll {
  id: string;
  question: string;
  endsAt: string | null;
  isExpired: boolean;
  totalVotes: number;
  myVoteOptionId: string | null;
  options: PollOption[];
}

interface Props {
  poll: Poll;
}

export default function PollWidget({ poll: initialPoll }: Props) {
  const { user } = useAuth();
  const [poll, setPoll] = useState<Poll>(initialPoll);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(!!initialPoll.myVoteOptionId);

  const handleVote = async (optionId: string) => {
    if (!user) {
      setError("Log in to vote");
      return;
    }
    if (poll.isExpired) {
      setError("This poll has ended");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ poll: Poll }>(`/polls/${poll.id}/vote`, { optionId });
      setPoll(res.data.poll);
      setHasVoted(true);
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to vote");
    } finally {
      setLoading(false);
    }
  };

  const showResults = hasVoted || poll.isExpired;

  return (
    <div className="my-6 bg-neutral-50 border border-black/15 rounded-lg p-5 max-w-xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <span className="text-[10px] uppercase tracking-[0.1em] font-bold text-neutral-400 block mb-1">
            {poll.isExpired ? "Poll ended" : "Poll"}
          </span>
          <h3 className="font-bold text-neutral-900 text-base leading-snug">{poll.question}</h3>
        </div>
        {poll.endsAt && !poll.isExpired && (
          <span className="text-xs text-neutral-400 whitespace-nowrap shrink-0">
            Ends {new Date(poll.endsAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-700 mb-3 bg-red-50 border border-red-200 px-3 py-2 rounded">
          {error}
        </p>
      )}

      {/* Options */}
      <div className="space-y-2">
        {poll.options.map((option) => {
          const isMyVote = poll.myVoteOptionId === option.id;
          const pct = option.percentage;

          return (
            <div key={option.id} className="relative">
              {showResults ? (
                /* Result bar */
                <div className="relative overflow-hidden rounded border border-black/10 bg-white">
                  <div
                    className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                      isMyVote ? "bg-[#b5121b]/15" : "bg-neutral-100"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                  <div className="relative flex items-center justify-between px-3 py-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      {isMyVote && (
                        <span className="text-[#b5121b] font-bold text-xs">✓</span>
                      )}
                      <span className={isMyVote ? "font-semibold text-neutral-900" : "text-neutral-700"}>
                        {option.text}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-neutral-500">{option.votes} vote{option.votes !== 1 ? "s" : ""}</span>
                      <span className={`text-sm font-bold ${isMyVote ? "text-[#b5121b]" : "text-neutral-600"}`}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Vote button */
                <button
                  onClick={() => handleVote(option.id)}
                  disabled={loading || !user}
                  className="w-full text-left px-3 py-2.5 text-sm border border-black/15 rounded bg-white
                    hover:border-[#b5121b] hover:bg-[#b5121b]/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {option.text}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between text-xs text-neutral-400">
        <span>{poll.totalVotes} vote{poll.totalVotes !== 1 ? "s" : ""} total</span>
        {!showResults && !user && (
          <span className="text-neutral-500">Log in to vote</span>
        )}
        {showResults && !poll.isExpired && (
          <button
            onClick={() => setHasVoted(false)}
            className="text-[#b5121b] hover:underline"
          >
            Change vote
          </button>
        )}
      </div>
    </div>
  );
}
