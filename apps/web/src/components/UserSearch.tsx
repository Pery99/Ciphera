import { FormEvent, useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import type { UserProfile } from "@ciphera/types";
import { api } from "../api.ts";
import { tapHaptic } from "../haptics.ts";
import { BitmojiAvatar } from "./BitmojiAvatar.tsx";

type UserSearchProps = {
  onSelect: (user: UserProfile) => void;
};

export function UserSearch({ onSelect }: UserSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const term = query.trim().replace(/^@/, "");
    if (term.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    const timer = window.setTimeout(() => {
      api
        .search(term)
        .then((users) => {
          if (!cancelled) setResults(users);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setIsSearching(false);
        });
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (results[0]) {
      tapHaptic();
      onSelect(results[0]);
      setQuery("");
      setResults([]);
    }
  }

  return (
    <div className="user-search">
      <form className="home-search" onSubmit={handleSubmit}>
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search people"
          autoComplete="off"
        />
        {isSearching && <Loader2 size={16} className="spin user-search-spinner" />}
      </form>

      {query.trim().length >= 2 && (
        <div className="user-search-results">
          {isSearching ? (
            <div className="user-search-empty">Searching...</div>
          ) : results.length === 0 ? (
            <div className="user-search-empty">No people found</div>
          ) : (
            results.map((user) => (
              <button
                type="button"
                key={user.id}
                className="user-search-item tap-spring"
                onClick={() => {
                  tapHaptic();
                  onSelect(user);
                  setQuery("");
                  setResults([]);
                }}
              >
                <BitmojiAvatar user={user} />
                <span className="user-search-copy">
                  <strong>{user.name}</strong>
                  <small>@{user.username}</small>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}