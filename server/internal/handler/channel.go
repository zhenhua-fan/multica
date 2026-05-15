package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/internal/util"
)

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

type ChannelResponse struct {
	ID            string `json:"id"`
	WorkspaceID   string `json:"workspace_id"`
	Name          string `json:"name"`
	Slug          string `json:"slug"`
	Description   string `json:"description"`
	AvatarURL     string `json:"avatar_url"`
	OwnerID       string `json:"owner_id"`
	MemberCount   int    `json:"member_count"`
	CreatedAt     string `json:"created_at"`
	UpdatedAt     string `json:"updated_at"`
}

type CreateChannelRequest struct {
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description,omitempty"`
}

type UpdateChannelRequest struct {
	Name        *string          `json:"name,omitempty"`
	Description *string          `json:"description,omitempty"`
	AvatarURL   *string          `json:"avatar_url,omitempty"`
	Settings    *json.RawMessage `json:"settings,omitempty"`
}

type ChannelMemberResponse struct {
	ID          string `json:"id"`
	ChannelID   string `json:"channel_id"`
	UserID      string `json:"user_id"`
	Role        string `json:"role"`
	DisplayName string `json:"display_name,omitempty"`
	AvatarURL   string `json:"avatar_url,omitempty"`
	Email       string `json:"email,omitempty"`
	JoinedAt    string `json:"joined_at"`
}

type AddMemberRequest struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"`
}

type UpdateMemberRoleRequest struct {
	Role string `json:"role"`
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func channelToResponse(c db.Channel, memberCount int) ChannelResponse {
	return ChannelResponse{
		ID:          util.UUIDToString(c.ID),
		WorkspaceID: util.UUIDToString(c.WorkspaceID),
		Name:        c.Name,
		Slug:        c.Slug,
		Description: c.Description,
		AvatarURL:   c.AvatarUrl,
		OwnerID:     util.UUIDToString(c.OwnerID),
		MemberCount: memberCount,
		CreatedAt:   util.TimestampToString(c.CreatedAt),
		UpdatedAt:   util.TimestampToString(c.UpdatedAt),
	}
}

func channelMemberToResponse(m db.ListChannelMembersRow) ChannelMemberResponse {
	return ChannelMemberResponse{
		ID:          util.UUIDToString(m.ID),
		ChannelID:   util.UUIDToString(m.ChannelID),
		UserID:      util.UUIDToString(m.UserID),
		Role:        m.Role,
		DisplayName: m.DisplayName,
		AvatarURL:   util.TextOrDefault(m.AvatarUrl),
		Email:       m.Email,
		JoinedAt:    util.TimestampToString(m.JoinedAt),
	}
}

// ---------------------------------------------------------------------------
// Channel Handlers
// ---------------------------------------------------------------------------

// ListChannels handles GET /api/channels
func (h *Handler) ListChannels(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	workspaceID := h.resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}
	_ = userID // workspace membership already checked by middleware

	wsUUID, _ := util.ParseUUID(workspaceID)
	channels, err := h.Queries.ListChannels(r.Context(), wsUUID)
	if err != nil {
		slog.Error("failed to list channels", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to list channels")
		return
	}

	counts := make(map[string]int, len(channels))
	for _, ch := range channels {
		c, err := h.Queries.CountChannelMembers(r.Context(), ch.ID)
		if err == nil {
			counts[util.UUIDToString(ch.ID)] = int(c)
		}
	}

	resp := make([]ChannelResponse, 0, len(channels))
	for _, ch := range channels {
		resp = append(resp, channelToResponse(ch, counts[util.UUIDToString(ch.ID)]))
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data":    resp,
	})
}

// CreateChannel handles POST /api/channels
func (h *Handler) CreateChannel(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	workspaceID := h.resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	var req CreateChannelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" || req.Slug == "" {
		writeError(w, http.StatusBadRequest, "name and slug are required")
		return
	}

	wsUUID, _ := util.ParseUUID(workspaceID)
	userUUID, _ := util.ParseUUID(userID)

	channel, err := h.Queries.CreateChannel(r.Context(), db.CreateChannelParams{
		WorkspaceID: wsUUID,
		Name:        req.Name,
		Slug:        req.Slug,
		Description: req.Description,
		OwnerID:     userUUID,
		AvatarUrl:   pgtype.Text{String: "", Valid: true},
		Settings:    []byte("{}"),
	})
	if err != nil {
		if isUniqueViolation(err) {
			writeError(w, http.StatusConflict, "a channel with this slug already exists")
			return
		}
		slog.Error("failed to create channel", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to create channel")
		return
	}

	// Auto-add creator as owner
	_, err = h.Queries.AddChannelMember(r.Context(), db.AddChannelMemberParams{
		ChannelID: channel.ID,
		UserID:    userUUID,
		Role:      "owner",
		AddedBy:   userUUID,
	})
	if err != nil {
		slog.Error("failed to add channel owner", "error", err)
	}

	memberCount := 1
	resp := channelToResponse(channel, memberCount)
	writeJSON(w, http.StatusCreated, map[string]any{
		"success": true,
		"data":    resp,
	})
}

// GetChannel handles GET /api/channels/{channelId}
func (h *Handler) GetChannel(w http.ResponseWriter, r *http.Request) {
	channelID := chi.URLParam(r, "channelId")
	if channelID == "" {
		writeError(w, http.StatusBadRequest, "channel_id is required")
		return
	}

	channelUUID, ok := parseUUIDOrBadRequest(w, channelID, "channel id")
	if !ok {
		return
	}

	channel, err := h.Queries.GetChannel(r.Context(), channelUUID)
	if err != nil {
		writeError(w, http.StatusNotFound, "channel not found")
		return
	}

	count, _ := h.Queries.CountChannelMembers(r.Context(), channel.ID)
	resp := channelToResponse(channel, int(count))
	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data":    resp,
	})
}

// UpdateChannel handles PATCH /api/channels/{channelId}
func (h *Handler) UpdateChannel(w http.ResponseWriter, r *http.Request) {
	channelID := chi.URLParam(r, "channelId")
	if channelID == "" {
		writeError(w, http.StatusBadRequest, "channel_id is required")
		return
	}

	channelUUID, ok := parseUUIDOrBadRequest(w, channelID, "channel id")
	if !ok {
		return
	}

	workspaceID := h.resolveWorkspaceID(r)
	wsUUID, _ := util.ParseUUID(workspaceID)

	var req UpdateChannelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	channel, err := h.Queries.UpdateChannel(r.Context(), db.UpdateChannelParams{
		ID:          channelUUID,
		WorkspaceID: wsUUID,
		Name:        util.PtrToText(req.Name),
		Description: util.PtrToText(req.Description),
		AvatarUrl:   util.PtrToText(req.AvatarURL),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "channel not found")
		return
	}

	count, _ := h.Queries.CountChannelMembers(r.Context(), channel.ID)
	resp := channelToResponse(channel, int(count))
	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data":    resp,
	})
}

// ArchiveChannel handles DELETE /api/channels/{channelId}
func (h *Handler) ArchiveChannel(w http.ResponseWriter, r *http.Request) {
	channelID := chi.URLParam(r, "channelId")
	if channelID == "" {
		writeError(w, http.StatusBadRequest, "channel_id is required")
		return
	}

	channelUUID, ok := parseUUIDOrBadRequest(w, channelID, "channel id")
	if !ok {
		return
	}

	workspaceID := h.resolveWorkspaceID(r)
	wsUUID, _ := util.ParseUUID(workspaceID)

	_, err := h.Queries.ArchiveChannel(r.Context(), db.ArchiveChannelParams{
		ID:          channelUUID,
		WorkspaceID: wsUUID,
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "channel not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data":    map[string]string{"status": "archived"},
	})
}

// ---------------------------------------------------------------------------
// Channel Member Handlers
// ---------------------------------------------------------------------------

// ListChannelMembers handles GET /api/channels/{channelId}/members
func (h *Handler) ListChannelMembers(w http.ResponseWriter, r *http.Request) {
	channelID := chi.URLParam(r, "channelId")
	channelUUID, ok := parseUUIDOrBadRequest(w, channelID, "channel id")
	if !ok {
		return
	}

	members, err := h.Queries.ListChannelMembers(r.Context(), channelUUID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list members")
		return
	}

	resp := make([]ChannelMemberResponse, 0, len(members))
	for _, m := range members {
		resp = append(resp, channelMemberToResponse(m))
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data":    resp,
	})
}

// AddChannelMember handles POST /api/channels/{channelId}/members
func (h *Handler) AddChannelMember(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	channelID := chi.URLParam(r, "channelId")
	channelUUID, ok := parseUUIDOrBadRequest(w, channelID, "channel id")
	if !ok {
		return
	}

	var req AddMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.UserID == "" {
		writeError(w, http.StatusBadRequest, "user_id is required")
		return
	}
	if req.Role == "" {
		req.Role = "member"
	}

	targetUUID, _ := util.ParseUUID(req.UserID)
	actorUUID, _ := util.ParseUUID(userID)

	member, err := h.Queries.AddChannelMember(r.Context(), db.AddChannelMemberParams{
		ChannelID: channelUUID,
		UserID:    targetUUID,
		Role:      req.Role,
		AddedBy:   actorUUID,
	})
	if err != nil {
		if isUniqueViolation(err) {
			writeError(w, http.StatusConflict, "user is already a member")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to add member")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"success": true,
		"data": map[string]any{
			"id":       util.UUIDToString(member.ID),
			"user_id":  util.UUIDToString(member.UserID),
			"role":     member.Role,
			"added_by": util.UUIDToString(member.AddedBy),
			"joined_at": util.TimestampToString(member.JoinedAt),
		},
	})
}

// UpdateChannelMember handles PATCH /api/channels/{channelId}/members/{memberId}
func (h *Handler) UpdateChannelMember(w http.ResponseWriter, r *http.Request) {
	channelID := chi.URLParam(r, "channelId")
	channelUUID, ok := parseUUIDOrBadRequest(w, channelID, "channel id")
	if !ok {
		return
	}

	memberID := chi.URLParam(r, "memberId")
	if _, ok := parseUUIDOrBadRequest(w, memberID, "member id"); !ok {
		return
	}

	var req UpdateMemberRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// We need to find the user_id by member_id. The UpdateChannelMember sqlc
	// query uses (channel_id, user_id), but our URL has member_id. We'll
	// look up the member to resolve user_id.
	allMembers, err := h.Queries.ListChannelMembers(r.Context(), channelUUID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list members")
		return
	}

	var targetUserID pgtype.UUID
	found := false
	for _, m := range allMembers {
		if util.UUIDToString(m.ID) == memberID {
			targetUserID = m.UserID
			found = true
			break
		}
	}
	if !found {
		writeError(w, http.StatusNotFound, "member not found")
		return
	}

	member, err := h.Queries.UpdateChannelMember(r.Context(), db.UpdateChannelMemberParams{
		ChannelID: channelUUID,
		UserID:    targetUserID,
		Role:      util.PtrToText(&req.Role),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "member not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data": map[string]string{
			"id":   util.UUIDToString(member.ID),
			"role": member.Role,
		},
	})
}

// RemoveChannelMember handles DELETE /api/channels/{channelId}/members/{memberId}
func (h *Handler) RemoveChannelMember(w http.ResponseWriter, r *http.Request) {
	channelID := chi.URLParam(r, "channelId")
	channelUUID, ok := parseUUIDOrBadRequest(w, channelID, "channel id")
	if !ok {
		return
	}

	memberID := chi.URLParam(r, "memberId")

	allMembers, err := h.Queries.ListChannelMembers(r.Context(), channelUUID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list members")
		return
	}

	var targetUserID pgtype.UUID
	found := false
	for _, m := range allMembers {
		if util.UUIDToString(m.ID) == memberID {
			targetUserID = m.UserID
			found = true
			break
		}
	}
	if !found {
		writeError(w, http.StatusNotFound, "member not found")
		return
	}

	err = h.Queries.RemoveChannelMember(r.Context(), db.RemoveChannelMemberParams{
		ChannelID: channelUUID,
		UserID:    targetUserID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to remove member")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data":    map[string]string{"status": "removed"},
	})
}
