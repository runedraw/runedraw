
export interface BoxInfo {
  box_id: number;
  name: string;
  price: number;
  price_golden?: number;
  image: string;
}

export interface BoxItem {
  item_id?: number;
  name: string;
  tier: string;
  value: number;
  image?: string;
  weight?: number;
  weight_golden?: number;
}

export interface UserData {
  id: string;
  balance: number;
  wagered_xp: number;
  rewards_data: Record<string, any>;
}

export interface Transaction {
    id: number;
    amount: number;
    source: string;
    balance: number;
    created_at: string;
}

export interface SoloHistoryEntry {
    id: number;
    box_name: string;
    item_name: string;
    item_value: number | null;
    cost: number | null;
    is_golden: boolean;
    tier: string;
    created_at: string;
}

export interface SpinResult {
  payout: number;
  tier: string;
  item_name: string;
  item_icon?: string;
  is_golden: boolean;
  new_balance?: number;
  cost?: number;
  id?: number; // Added to track solo history ID
}

export interface BattleRoll {
  player_index: number;
  item_name: string;
  item_value: number;
  tier: string;
  user_id?: string; 
  item_id?: number; 
}

export interface BattleRound {
  box_name: string;
  rolls: BattleRoll[];
}

export interface BattleResult {
  battle_id: number; 
  pending_battle_id?: number; 
  winner_team_id: number;
  total_pot: number;
  new_balance?: number;
  rounds: BattleRound[];
  team_scores: number[];
  player_teams: number[];
  jackpot_enabled?: boolean; 
  jackpot_ticket?: number;
  jackpot_chances?: number[];
  is_draw?: boolean;
  total_payout?: number;
  completed_at?: string; 
}

export type BattleMode = '1v1' | '1v1v1' | '1v1v1v1' | '2v2' | '2v2v2' | '3v3';
export type BattleRule = 'classic' | 'terminal' | 'less' | 'whale';

export interface BattleRoomData {
    id: number; 
    creator_id: string;
    boxes: string[];
    cost_per_player: number; 
    rule: BattleRule;
    mode: BattleMode;
    jackpot_enabled: boolean;
    players: { id: string, email: string, is_bot: boolean, team_index: number }[];
    max_players: number;
    status: 'waiting' | 'running' | 'completed' | 'cancelled';
    created_at: string;
}

export interface BattleHistoryV2Row {
  id: number;
  battle_id: number;
  created_at: string;
  mode: BattleMode;
  rule: BattleRule;
  jackpot_enabled: boolean;
  total_pot: number;
  winner_team_id: number;
  is_draw: boolean;
  round_index: number;
  player_index: number;
  team_index: number;
  user_id: string;
  is_bot: boolean;
  box_id: number;
  box_name: string;
  item_id: number;
  item_name: string;
  item_value: number;
  item_tier: string;
  payout: number;
}

export interface CoinFlipEntry {
    id: number;
    user_id: string;
    wager: number;
    chosen_side: 'heads' | 'tails';
    outcome: 'heads' | 'tails';
    won: boolean;
    payout: number;
    created_at: string;
}

export interface RewardsState {
  total_xp: number;
  statuses: UserRewardStatus[];
  history: RewardHistoryEntry[];
}

export interface RewardTierConfig {
  level: number;
  required_xp: number;
  box_id: number;
  cooldown_hours: number;
}

export interface UserRewardStatus {
  box_name: string;
  unlocked: boolean;
  last_claimed_at: string | null;
}

export interface RewardHistoryEntry {
  id: number;
  box_name: string;
  item_name: string;
  payout_value: number;
  claimed_at: string;
}

export interface UnlockEntry {
    item_name: string;
    item_tier: string;
    box_id: number;
    source_type: 'solo' | 'battle';
    created_at: string;
    related_id?: number | null;
}

export interface CoinPackage {
    id: string;
    priceUsd: number;
    coins: number;
    label?: string;
}