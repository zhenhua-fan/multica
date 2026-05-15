export type ChannelMemberRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Channel {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  description: string;
  avatar_url: string;
  owner_id: string;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChannelMember {
  id: string;
  channel_id: string;
  user_id: string;
  role: ChannelMemberRole;
  display_name?: string;
  avatar_url?: string;
  email?: string;
  joined_at: string;
}

export interface CreateChannelRequest {
  name: string;
  slug: string;
  description?: string;
}

export interface UpdateChannelRequest {
  name?: string;
  description?: string;
  avatar_url?: string;
}

export interface AddMemberRequest {
  user_id: string;
  role?: ChannelMemberRole;
}

export interface UpdateMemberRoleRequest {
  role: ChannelMemberRole;
}

export interface ChannelListResponse {
  success: boolean;
  data: Channel[];
}

export interface ChannelResponse {
  success: boolean;
  data: Channel;
}

export interface ChannelMemberListResponse {
  success: boolean;
  data: ChannelMember[];
}
