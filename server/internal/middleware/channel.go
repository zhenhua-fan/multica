package middleware

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/internal/util"
)

type channelContextKey struct{}

type ChannelInfo struct {
	ChannelID pgtype.UUID
	Role      string
}

// WithChannelInfo embeds ChannelInfo into the request context.
func WithChannelInfo(ctx context.Context, info ChannelInfo) context.Context {
	return context.WithValue(ctx, channelContextKey{}, info)
}

// ChannelInfoFromContext extracts ChannelInfo from the request context.
func ChannelInfoFromContext(ctx context.Context) (ChannelInfo, bool) {
	info, ok := ctx.Value(channelContextKey{}).(ChannelInfo)
	return info, ok
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// RequireChannelMember validates the requester is a member of the channel
// identified by the {channelId} URL parameter. On success, the channel role
// is injected into the request context.
func RequireChannelMember(queries *db.Queries) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			channelIDStr := chi.URLParam(r, "channelId")
			if channelIDStr == "" {
				channelIDStr = r.Header.Get("X-Channel-ID")
			}
			if channelIDStr == "" {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "channel_id is required"})
				return
			}

			channelID, err := util.ParseUUID(channelIDStr)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid channel id"})
				return
			}

			userID := r.Header.Get("X-User-ID")
			if userID == "" {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "user not authenticated"})
				return
			}
			userUUID, err := util.ParseUUID(userID)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid user id"})
				return
			}

			member, err := queries.GetChannelMember(r.Context(), db.GetChannelMemberParams{
				ChannelID: channelID,
				UserID:    userUUID,
			})
			if err != nil {
				writeJSON(w, http.StatusForbidden, map[string]string{"error": "not a member of this channel"})
				return
			}

			ctx := WithChannelInfo(r.Context(), ChannelInfo{
				ChannelID: member.ChannelID,
				Role:      member.Role,
			})
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireChannelRole builds on RequireChannelMember and additionally checks
// that the member has one of the specified roles.
func RequireChannelRole(queries *db.Queries, allowedRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			info, ok := ChannelInfoFromContext(r.Context())
			if !ok {
				writeJSON(w, http.StatusForbidden, map[string]string{"error": "channel context not found"})
				return
			}
			for _, role := range allowedRoles {
				if info.Role == role {
					next.ServeHTTP(w, r)
					return
				}
			}
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "insufficient channel permissions"})
		})
	}
}
